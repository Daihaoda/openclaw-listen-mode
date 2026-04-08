import type { InboundMessage } from '../types/message.js';
import type { ListenModeConfig } from '../types/config.js';
import type { GatewayContext } from '../types/plugin-api.js';
import type { SessionState, DetectedLanguage, TriggerType, ExitReason } from '../types/state.js';
import { ListenState } from '../types/state.js';
import { MessageBuffer } from './message-buffer.js';
import { detectTrigger } from './trigger-detector.js';
import { detectExit } from './exit-detector.js';
import { detectLanguage } from './language-detector.js';
import { mergeMessages } from './message-merger.js';
import { getEntryResponse } from '../ack/entry-responder.js';
import { shouldSendInterimAck, getInterimAck, nextAckThreshold } from '../ack/interim-responder.js';
import { splitReply } from '../delivery/reply-splitter.js';
import { DeliveryQueue } from '../delivery/delivery-queue.js';
import { ResettableTimer, type TimerFactory } from '../utils/timer.js';
import { calculateDynamicTimeout, type DynamicTimeoutConfig, DEFAULT_DYNAMIC_TIMEOUT } from './dynamic-timeout.js';
import { aggregateEmotionScore, getEmotionHintSuffix } from './emotion-scorer.js';
import { AnalyticsEmitter, type ListenSessionEvent } from './analytics.js';
import { classifyIntent } from './intent-classifier.js';
import { checkCompleteness, type CompletenessCheckConfig, DEFAULT_COMPLETENESS_CONFIG } from './completeness-checker.js';
import type { PersonaManager } from './persona.js';
import type { ListenSessionManager } from './listen-session.js';
import type { StatsCollector } from './stats.js';

export class StateMachine {
  private sessions = new Map<string, SessionState>();
  private silenceTimers = new Map<string, ResettableTimer>();
  private maxListenTimers = new Map<string, ResettableTimer>();
  private messageTimestamps = new Map<string, number[]>();
  private ackCounts = new Map<string, number>();
  private triggerTypes = new Map<string, TriggerType>();
  private readonly buffer: MessageBuffer;
  private readonly deliveryQueue: DeliveryQueue;
  private readonly config: ListenModeConfig;
  private readonly ctx: GatewayContext;
  private readonly timerFactory?: TimerFactory;
  private readonly dynamicTimeoutConfig: DynamicTimeoutConfig;
  private readonly personaManager?: PersonaManager;
  private readonly sessionManager?: ListenSessionManager;
  private readonly statsCollector?: StatsCollector;
  private readonly completenessConfig: CompletenessCheckConfig;
  readonly analytics: AnalyticsEmitter;

  constructor(
    config: ListenModeConfig,
    ctx: GatewayContext,
    timerFactory?: TimerFactory,
    dynamicTimeoutConfig?: DynamicTimeoutConfig,
    personaManager?: PersonaManager,
    sessionManager?: ListenSessionManager,
    statsCollector?: StatsCollector,
  ) {
    this.config = config;
    this.ctx = ctx;
    this.timerFactory = timerFactory;
    this.dynamicTimeoutConfig = dynamicTimeoutConfig ?? DEFAULT_DYNAMIC_TIMEOUT;
    this.completenessConfig = config.completenessCheck ?? DEFAULT_COMPLETENESS_CONFIG;
    this.personaManager = personaManager;
    this.sessionManager = sessionManager;
    this.statsCollector = statsCollector;
    this.buffer = new MessageBuffer();
    this.deliveryQueue = new DeliveryQueue();
    this.analytics = new AnalyticsEmitter();
  }

  private getSession(senderId: string): SessionState {
    let session = this.sessions.get(senderId);
    if (!session) {
      session = {
        mode: ListenState.NORMAL,
        buffer: [],
        listenStartTime: null,
        lastMessageTime: null,
        lastAckContent: null,
        lastAckTime: null,
        messagesSinceLastAck: 0,
        currentAckThreshold: nextAckThreshold(this.config),
        detectedLanguage: 'zh',
        lastMessageIsVoice: false,
        lastMessageText: '',
        completenessExtensions: 0,
      };
      this.sessions.set(senderId, session);
    }
    return session;
  }

  private resetSession(senderId: string): void {
    this.silenceTimers.get(senderId)?.clear();
    this.silenceTimers.delete(senderId);
    this.maxListenTimers.get(senderId)?.clear();
    this.maxListenTimers.delete(senderId);
    this.buffer.clear(senderId);
    this.messageTimestamps.delete(senderId);
    this.ackCounts.delete(senderId);
    this.triggerTypes.delete(senderId);

    const session = this.sessions.get(senderId);
    if (session) {
      session.mode = ListenState.NORMAL;
      session.listenStartTime = null;
      session.lastMessageTime = null;
      session.lastAckContent = null;
      session.lastAckTime = null;
      session.messagesSinceLastAck = 0;
      session.currentAckThreshold = nextAckThreshold(this.config);
      session.lastMessageIsVoice = false;
      session.lastMessageText = '';
      session.completenessExtensions = 0;
    }
  }

  private getSilenceTimeout(senderId: string): number {
    const session = this.getSession(senderId);
    if (this.config.dynamicTimeout.enabled) {
      const timestamps = this.messageTimestamps.get(senderId);
      return calculateDynamicTimeout(
        timestamps ?? [],
        this.dynamicTimeoutConfig,
        session.lastMessageIsVoice,
        session.lastMessageText,
      );
    }
    // Even with dynamic timeout disabled, add voice extra
    if (session.lastMessageIsVoice && this.config.dynamicTimeout.voiceExtraMs) {
      return this.config.silenceTimeoutMs + this.config.dynamicTimeout.voiceExtraMs;
    }
    return this.config.silenceTimeoutMs;
  }

  private startSilenceTimer(senderId: string): void {
    this.silenceTimers.get(senderId)?.clear();

    const timeout = this.getSilenceTimeout(senderId);
    const timer = new ResettableTimer(
      () => this.onSilenceTimeout(senderId),
      timeout,
      this.timerFactory,
    );
    this.silenceTimers.set(senderId, timer);
    timer.start();
  }

  private startMaxListenTimer(senderId: string): void {
    this.maxListenTimers.get(senderId)?.clear();

    const timer = new ResettableTimer(
      () => this.onMaxListenTimeout(senderId),
      this.config.maxListenTimeMs,
      this.timerFactory,
    );
    this.maxListenTimers.set(senderId, timer);
    timer.start();
  }

  private async onSilenceTimeout(senderId: string): Promise<void> {
    const session = this.getSession(senderId);
    if (session.mode !== ListenState.LISTENING) return;

    // ─── LLM completeness gate ───
    const cc = this.completenessConfig;
    if (
      cc.enabled &&
      session.completenessExtensions < cc.maxExtensions &&
      this.buffer.count(senderId) > 0
    ) {
      try {
        const messages = this.buffer.getRecent(senderId, 10);
        const result = await checkCompleteness(
          this.ctx, messages, session.detectedLanguage, cc,
        );

        // Re-check mode after async call (user might have sent a new message)
        if (session.mode !== ListenState.LISTENING) return;

        if (!result.complete) {
          session.completenessExtensions++;
          this.ctx.logger.info(
            `Completeness check: not done, extending (${session.completenessExtensions}/${cc.maxExtensions}) for ${senderId}`,
          );
          // Restart timer with fixed extension duration
          this.silenceTimers.get(senderId)?.clear();
          const timer = new ResettableTimer(
            () => this.onSilenceTimeout(senderId),
            cc.extensionMs,
            this.timerFactory,
          );
          this.silenceTimers.set(senderId, timer);
          timer.start();
          return;
        }
        this.ctx.logger.info(`Completeness check: done, triggering response for ${senderId}`);
      } catch (err) {
        this.ctx.logger.warn('Completeness check failed, falling back to immediate response', err);
        // Fall through to trigger response
      }
    }

    this.ctx.logger.info(`Silence timeout for sender ${senderId}`);
    await this.triggerResponse(senderId, 'silence_timeout', true);
  }

  private async onMaxListenTimeout(senderId: string): Promise<void> {
    const session = this.getSession(senderId);
    if (session.mode !== ListenState.LISTENING) return;

    this.ctx.logger.info(`Silence exit: no messages for ${this.config.maxListenTimeMs}ms, exiting listen mode for ${senderId}`);

    // Send farewell message
    const { getSilenceExitMessage } = await import('../ack/entry-responder.js');
    const farewell = getSilenceExitMessage(session.detectedLanguage);
    await this.ctx.sendToUser(senderId, farewell);

    // Emit analytics
    const bufferCount = this.buffer.count(senderId);
    const emotionScore = aggregateEmotionScore(this.buffer.getRecent(senderId, bufferCount));
    this.emitAnalytics(senderId, session, bufferCount, 'max_listen_time', false, emotionScore.level);

    this.sessionManager?.endSession(senderId);
    this.resetSession(senderId);
  }

  private async enterListenMode(
    senderId: string,
    language: DetectedLanguage,
    triggerType: TriggerType,
  ): Promise<void> {
    const session = this.getSession(senderId);
    const now = Date.now();

    session.mode = ListenState.LISTENING;
    session.listenStartTime = now;
    session.lastAckTime = now;
    session.messagesSinceLastAck = 0;
    session.currentAckThreshold = nextAckThreshold(this.config);
    session.detectedLanguage = language;

    // Track for analytics
    this.triggerTypes.set(senderId, triggerType);
    this.ackCounts.set(senderId, 0);
    this.messageTimestamps.set(senderId, []);

    // Start/continue listen session
    this.sessionManager?.startRound(senderId);

    // Send entry response
    if (this.config.ack.entryReply) {
      const entryReply = getEntryResponse(language, triggerType);
      await this.ctx.sendToUser(senderId, entryReply);
      session.lastAckContent = entryReply;
    }

    // Start timers
    this.startSilenceTimer(senderId);
    this.startMaxListenTimer(senderId);

    this.ctx.logger.info(
      `Entered listen mode for sender ${senderId} (trigger: ${triggerType}, lang: ${language})`,
    );
  }

  private emitAnalytics(
    senderId: string,
    session: SessionState,
    messageCount: number,
    exitReason: ExitReason,
    responseTriggered: boolean,
    emotionLevel: import('./emotion-scorer.js').EmotionLevel,
  ): void {
    const event: ListenSessionEvent = {
      type: 'listen_session_complete',
      senderId,
      timestamp: Date.now(),
      triggerType: this.triggerTypes.get(senderId) ?? 'manual',
      exitReason,
      language: session.detectedLanguage,
      messageCount,
      durationMs: session.listenStartTime ? Date.now() - session.listenStartTime : 0,
      ackCount: this.ackCounts.get(senderId) ?? 0,
      emotionLevel,
      responseTriggered,
    };
    this.analytics.emit('session_complete', event);
  }

  private async triggerResponse(senderId: string, exitReason: ExitReason = 'silence_timeout', stayInMode: boolean = false): Promise<void> {
    const session = this.getSession(senderId);
    session.mode = ListenState.RESPONDING;

    // Stop timers
    this.silenceTimers.get(senderId)?.clear();
    this.maxListenTimers.get(senderId)?.clear();

    // Flush buffer and merge
    const messages = this.buffer.flush(senderId);
    if (messages.length === 0) {
      if (stayInMode) {
        // Empty buffer but staying in listen mode — just keep waiting
        session.mode = ListenState.LISTENING;
        this.startSilenceTimer(senderId);
        this.ctx.logger.info(`Empty buffer for ${senderId}, staying in listen mode`);
        return;
      }
      this.resetSession(senderId);
      return;
    }

    // Score emotion intensity for the buffered messages
    const emotionScore = aggregateEmotionScore(messages);
    const emotionSuffix = getEmotionHintSuffix(emotionScore, session.detectedLanguage);

    // Build session context (multi-round history)
    let sessionContext = '';
    if (this.sessionManager) {
      this.sessionManager.addMessages(senderId, messages);
      sessionContext = this.sessionManager.buildContextString(senderId, session.detectedLanguage);
    }

    // Build persona prompt
    let personaPrompt = '';
    if (this.personaManager) {
      personaPrompt = this.personaManager.getPersonaPrompt(senderId, session.detectedLanguage);
    }

    // Merge everything
    let merged = '';
    if (personaPrompt) {
      merged += `[人设]\n${personaPrompt}\n\n`;
    }
    if (sessionContext) {
      merged += sessionContext + '\n';
    }
    merged += mergeMessages(messages, session.detectedLanguage, this.config.systemHint);
    if (emotionSuffix) {
      merged += emotionSuffix;
    }

    this.ctx.logger.info(
      `Triggering response for sender ${senderId} with ${messages.length} messages (emotion: ${emotionScore.level})`,
    );

    // Record stats
    const personaId = this.personaManager?.getPersonaId(senderId) ?? 'warm-friend';
    const roundNum = this.sessionManager?.getCurrentRound(senderId) ?? 1;
    this.emitAnalytics(senderId, session, messages.length, exitReason, true, emotionScore.level);
    this.statsCollector?.recordSession({
      triggerType: this.triggerTypes.get(senderId) ?? 'manual',
      exitReason,
      emotionLevel: emotionScore.level,
      rounds: roundNum,
      personaId,
      responseTriggered: true,
    });

    // Send to Agent
    try {
      const agentReply = await this.ctx.sendToAgent(senderId, merged);

      // Record AI response for session context
      this.sessionManager?.recordAiResponse(senderId, agentReply);

      // Split and deliver
      if (this.config.reply.splitEnabled) {
        const splitMessages = splitReply(agentReply);
        await this.deliveryQueue.enqueue(senderId, splitMessages, this.ctx, this.config.reply);
        this.statsCollector?.recordDelivery(false);
      } else {
        await this.ctx.sendToUser(senderId, agentReply);
      }
    } catch (e) {
      this.ctx.logger.error(`Failed to get agent response for sender ${senderId}`, e);
    }

    if (stayInMode) {
      // Stay in LISTENING mode — just clear buffer and restart timers
      session.mode = ListenState.LISTENING;
      this.buffer.clear(senderId);
      session.messagesSinceLastAck = 0;
      session.lastAckTime = Date.now();
      session.currentAckThreshold = nextAckThreshold(this.config);
      session.completenessExtensions = 0;
      this.messageTimestamps.set(senderId, []);
      this.startSilenceTimer(senderId);
      this.ctx.logger.info(`Response sent for ${senderId}, staying in listen mode`);
    } else {
      // Fully exit listen mode
      this.resetSession(senderId);
    }
  }

  async handleInbound(message: InboundMessage): Promise<'passthrough' | 'handled'> {
    const { senderId, content } = message;
    const session = this.getSession(senderId);
    const now = Date.now();

    // If currently in RESPONDING mode (delivery in progress), cancel and handle new message
    if (session.mode === ListenState.RESPONDING) {
      this.deliveryQueue.cancel(senderId);
      this.resetSession(senderId);
      // Fall through to process as new message in NORMAL mode
    }

    if (session.mode === ListenState.NORMAL) {
      // Step 1: Keyword-based trigger detection (always runs first)
      const trigger = detectTrigger(content, this.config);

      if (trigger.triggered) {
        await this.enterListenMode(
          senderId,
          trigger.language ?? detectLanguage(content),
          trigger.triggerType!,
        );
        // Buffer the trigger message too — it may contain context
        this.buffer.push(senderId, message);
        return 'handled';
      }

      // Step 2: LLM intent classification (if enabled and keywords didn't match)
      if (this.config.intelligence.intentClassification && trigger.reason !== 'task_veto') {
        const classification = await classifyIntent(this.ctx, senderId, content, {
          enabled: true,
          classificationModel: this.config.intelligence.classificationModel,
          classificationTimeoutMs: this.config.intelligence.classificationTimeoutMs,
          fallbackToKeywords: this.config.intelligence.fallbackToKeywords,
        });

        if (classification?.intent === 'vent') {
          const lang = detectLanguage(content);
          await this.enterListenMode(senderId, lang, 'auto');
          // Buffer the trigger message too — it may contain context
          this.buffer.push(senderId, message);
          return 'handled';
        }
      }

      // Not triggered — passthrough to Agent
      return 'passthrough';
    }

    if (session.mode === ListenState.LISTENING) {
      // Check exit conditions
      const exitResult = detectExit(
        {
          content,
          bufferCount: this.buffer.count(senderId) + 1, // +1 for current message
          listenStartTime: session.listenStartTime!,
          now,
        },
        this.config,
      );

      if (exitResult.shouldExit) {
        if (exitResult.triggerResponse) {
          // Add current message to buffer before triggering response
          this.buffer.push(senderId, message);
          await this.triggerResponse(senderId, exitResult.reason!, exitResult.stayInMode ?? false);
        } else {
          // Abort — emit analytics and clear
          const bufferCount = this.buffer.count(senderId);
          const emotionScore = aggregateEmotionScore(
            this.buffer.getRecent(senderId, bufferCount),
          );
          this.emitAnalytics(
            senderId, session, bufferCount, exitResult.reason!, false, emotionScore.level,
          );
          this.ctx.logger.info(
            `Listen mode aborted for sender ${senderId}, reason: ${exitResult.reason}`,
          );
          this.statsCollector?.recordSession({
            triggerType: this.triggerTypes.get(senderId) ?? 'manual',
            exitReason: exitResult.reason!,
            emotionLevel: emotionScore.level,
            rounds: this.sessionManager?.getCurrentRound(senderId) ?? 1,
            personaId: this.personaManager?.getPersonaId(senderId) ?? 'warm-friend',
            responseTriggered: false,
          });
          // End the listen session on abort/task switch
          this.sessionManager?.endSession(senderId);
          this.resetSession(senderId);

          // Send warm farewell for user_abort
          if (exitResult.reason === 'user_abort') {
            const { getExitFarewell } = await import('../ack/entry-responder.js');
            const farewell = getExitFarewell(session.detectedLanguage);
            await this.ctx.sendToUser(senderId, farewell);
          }

          // If it was a task instruction, let it pass through
          if (exitResult.reason === 'task_instruction') {
            return 'passthrough';
          }
        }
        return 'handled';
      }

      // Buffer the message
      this.buffer.push(senderId, message);
      session.lastMessageTime = now;
      session.messagesSinceLastAck++;
      session.lastMessageIsVoice = message.type === 'voice';
      session.lastMessageText = content;

      // Track language dynamically (follow user's current language)
      session.detectedLanguage = detectLanguage(content);

      // Track message timestamps for dynamic timeout
      const timestamps = this.messageTimestamps.get(senderId) ?? [];
      timestamps.push(now);
      this.messageTimestamps.set(senderId, timestamps);

      // Recalculate and reset silence timer with dynamic timeout
      const dynamicTimeout = this.getSilenceTimeout(senderId);
      this.silenceTimers.get(senderId)?.clear();
      const newTimer = new ResettableTimer(
        () => this.onSilenceTimeout(senderId),
        dynamicTimeout,
        this.timerFactory,
      );
      this.silenceTimers.set(senderId, newTimer);
      newTimer.start();

      // Reset silence exit timer (max listen timer resets on every message)
      this.startMaxListenTimer(senderId);

      // Check if interim ack is needed
      if (shouldSendInterimAck(session, this.config, now)) {
        const ack = await getInterimAck(this.ctx, session, this.buffer, senderId, this.config);
        await this.ctx.sendToUser(senderId, ack);
        session.lastAckContent = ack;
        session.lastAckTime = now;
        session.messagesSinceLastAck = 0;
        session.currentAckThreshold = nextAckThreshold(this.config);
        // Track ack count for analytics
        this.ackCounts.set(senderId, (this.ackCounts.get(senderId) ?? 0) + 1);
      }

      return 'handled';
    }

    return 'passthrough';
  }

  getMode(senderId: string): ListenState {
    return this.getSession(senderId).mode;
  }

  destroy(): void {
    for (const [, timer] of this.silenceTimers) {
      timer.clear();
    }
    for (const [, timer] of this.maxListenTimers) {
      timer.clear();
    }
    this.silenceTimers.clear();
    this.maxListenTimers.clear();
    this.buffer.clearAll();
    this.deliveryQueue.cancelAll();
    this.sessions.clear();
  }
}
