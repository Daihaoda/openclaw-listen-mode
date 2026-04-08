import type { InboundMessage, OutboundMessage } from './types/message.js';
import type { GatewayContext, OpenClawPlugin } from './types/plugin-api.js';
import type { DeepPartial, ListenModeConfig } from './types/config.js';
import type { TimerFactory } from './utils/timer.js';
import { buildConfig } from './config/merger.js';
import { StateMachine } from './core/state-machine.js';
import { splitReply } from './delivery/reply-splitter.js';
import { DeliveryQueue } from './delivery/delivery-queue.js';
import { PersonaManager } from './core/persona.js';
import { ListenSessionManager } from './core/listen-session.js';
import { StatsCollector } from './core/stats.js';

export class ListenModePlugin implements OpenClawPlugin {
  readonly name = 'listen-mode';

  private ctx!: GatewayContext;
  private config!: ListenModeConfig;
  private stateMachine!: StateMachine;
  private globalDeliveryQueue!: DeliveryQueue;
  private timerFactory?: TimerFactory;

  /** Public access to persona manager for switching */
  personaManager!: PersonaManager;
  /** Public access to stats for querying */
  statsCollector!: StatsCollector;
  /** Public access to session manager */
  sessionManager!: ListenSessionManager;

  constructor(
    private readonly userConfig?: DeepPartial<ListenModeConfig>,
    options?: { timerFactory?: TimerFactory },
  ) {
    this.timerFactory = options?.timerFactory;
  }

  async init(ctx: GatewayContext): Promise<void> {
    this.ctx = ctx;
    this.config = buildConfig(this.userConfig);

    // Initialize Phase 3 managers
    this.personaManager = new PersonaManager(this.config.persona);
    this.sessionManager = new ListenSessionManager(this.config.session);
    this.statsCollector = new StatsCollector(this.config.stats);

    this.stateMachine = new StateMachine(
      this.config,
      ctx,
      this.timerFactory,
      undefined, // use DEFAULT_DYNAMIC_TIMEOUT from dynamic-timeout.ts
      this.personaManager,
      this.sessionManager,
      this.statsCollector,
    );

    this.globalDeliveryQueue = new DeliveryQueue();

    ctx.logger.info('Listen mode plugin initialized', {
      triggerMode: this.config.triggerMode,
      silenceTimeout: this.config.silenceTimeoutMs,
      intentClassification: this.config.intelligence.intentClassification,
      persona: this.config.persona.default,
    });
  }

  async onInboundMessage(message: InboundMessage): Promise<'passthrough' | 'handled'> {
    // Skip non-text/voice messages (images, video, files)
    if (message.type && message.type !== 'text' && message.type !== 'voice') {
      return 'passthrough';
    }

    // Group chat: only process messages that @ the bot
    if (message.groupId && !message.mentionsBot) {
      return 'passthrough';
    }

    // Check for persona switch command
    if (this.config.persona.allowSwitch) {
      const switchTarget = this.personaManager.detectPersonaSwitch(message.content);
      if (switchTarget) {
        this.personaManager.switchPersona(message.senderId, switchTarget);
        const persona = this.personaManager.getPersona(message.senderId);
        const lang = message.content.match(/[\u4e00-\u9fff]/) ? 'zh' : 'en';
        const name = persona.name[lang] ?? persona.name['en'];
        await this.ctx.sendToUser(
          message.senderId,
          lang === 'zh' ? `好的，已切换到「${name}」模式` : `Switched to "${name}" mode`,
        );
        return 'handled';
      }
    }

    return this.stateMachine.handleInbound(message);
  }

  async onOutboundMessage(message: OutboundMessage): Promise<OutboundMessage | OutboundMessage[]> {
    // If split is disabled, pass through as-is
    if (!this.config.reply.splitEnabled) {
      return message;
    }

    // Check for split markers in the content
    if (!message.content.includes('<<<SPLIT>>>')) {
      return message;
    }

    // Split and return as multiple messages (including stickers)
    const splitMessages = splitReply(message.content);
    return splitMessages.map((m) => {
      if (m.type === 'sticker') {
        return {
          senderId: message.senderId,
          content: '',
          type: 'sticker' as const,
          stickerCategory: m.category,
        };
      }
      return {
        senderId: message.senderId,
        content: m.content,
        type: 'text' as const,
      };
    });
  }

  async destroy(): Promise<void> {
    this.stateMachine.destroy();
    this.globalDeliveryQueue.cancelAll();
    this.sessionManager.clearAll();
    this.personaManager.clearAll();
    this.ctx.logger.info('Listen mode plugin destroyed');
  }
}
