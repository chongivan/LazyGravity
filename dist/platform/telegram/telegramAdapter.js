"use strict";
/**
 * Telegram platform adapter.
 *
 * Implements the PlatformAdapter interface using a TelegramBotLike instance.
 * This adapter translates Telegram events to the platform-agnostic event model
 * so the bot core can operate without platform-specific knowledge.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAdapter = void 0;
const wrappers_1 = require("./wrappers");
const logger_1 = require("../../utils/logger");
// ---------------------------------------------------------------------------
// TelegramAdapter
// ---------------------------------------------------------------------------
class TelegramAdapter {
    platform = 'telegram';
    bot;
    botUserId;
    events = null;
    started = false;
    handlersRegistered = false;
    /** Timestamp when the adapter started — messages older than this are discarded. */
    startedAt = 0;
    constructor(bot, botUserId) {
        this.bot = bot;
        this.botUserId = botUserId;
    }
    /**
     * Start the adapter.
     *
     * Registers Telegram event handlers that translate incoming events to the
     * platform-agnostic event callbacks, then starts the bot polling loop.
     */
    async start(events) {
        if (this.started) {
            throw new Error('TelegramAdapter is already started');
        }
        this.events = events;
        // Round down to whole seconds to match Telegram's second-precision timestamps
        this.startedAt = Math.floor(Date.now() / 1000) * 1000;
        if (!this.handlersRegistered) {
            this.registerHandlers();
            this.handlersRegistered = true;
        }
        // bot.start() returns a Promise that resolves when polling stops.
        // We intentionally do NOT await it (would block forever).
        // Catch errors to prevent unhandled promise rejections (e.g. getMe()
        // failure inside grammY's init phase).
        const startPromise = this.bot.start();
        if (startPromise && typeof startPromise.catch === 'function') {
            startPromise.catch((err) => {
                logger_1.logger.error('[TelegramAdapter] Polling loop error:', err instanceof Error ? err.message : err);
                this.emitError(err);
            });
        }
        this.started = true;
        if (this.events.onReady) {
            this.events.onReady();
        }
    }
    /**
     * Stop the adapter (disconnect, cleanup).
     */
    async stop() {
        if (!this.started)
            return;
        this.bot.stop();
        this.started = false;
        this.events = null;
    }
    /**
     * Retrieve a channel (chat) by its platform-native ID.
     * Returns a PlatformChannel backed by the bot API.
     */
    async getChannel(chatId) {
        try {
            const chat = await this.bot.api.getChat(chatId);
            if (!chat)
                return null;
            const channel = (0, wrappers_1.wrapTelegramChannel)(this.bot.api, chatId, this.bot.toInputFile);
            // Enrich with name from the fetched chat data
            return {
                ...channel,
                name: chat.title ?? chat.first_name ?? undefined,
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Return the bot's own user ID.
     */
    getBotUserId() {
        return this.botUserId;
    }
    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------
    /**
     * Shared handler for both text and photo messages.
     * Wraps the Telegram message and fires onMessage.
     */
    handleIncomingMessage(eventName, ctx) {
        if (!this.events?.onMessage)
            return;
        try {
            const msg = ctx.message ?? ctx.msg;
            if (!msg)
                return;
            const msgTimestampMs = msg.date ? msg.date * 1000 : 0;
            const delayMs = msgTimestampMs ? Date.now() - msgTimestampMs : null;
            logger_1.logger.debug(`[TelegramAdapter] ${eventName} received (chat=${msg.chat.id}, delay=${delayMs !== null ? `${delayMs}ms` : 'unknown'})`);
            // Discard messages sent before the adapter started (stale backlog)
            if (msgTimestampMs && msgTimestampMs < this.startedAt) {
                logger_1.logger.info(`[TelegramAdapter] Ignoring stale message (chat=${msg.chat.id}, age=${Math.round((this.startedAt - msgTimestampMs) / 1000)}s before startup)`);
                return;
            }
            const platformMessage = (0, wrappers_1.wrapTelegramMessage)(msg, this.bot.api, this.bot.toInputFile, this.bot.token);
            // Fire-and-forget: do NOT await so grammY's update loop stays
            // unblocked. This allows /stop and other commands to be received
            // while a long-running response is being monitored.
            // The workspace queue in telegramMessageHandler serializes
            // actual prompt processing per workspace.
            this.events.onMessage(platformMessage).catch((error) => {
                this.emitError(error);
            });
        }
        catch (error) {
            this.emitError(error);
        }
    }
    registerHandlers() {
        // Text messages
        this.bot.on('message:text', async (ctx) => {
            this.handleIncomingMessage('message:text', ctx);
        });
        // Photo messages
        this.bot.on('message:photo', async (ctx) => {
            this.handleIncomingMessage('message:photo', ctx);
        });
        // Callback queries (button presses and select menu selections)
        this.bot.on('callback_query:data', async (ctx) => {
            if (!this.events?.onButtonInteraction && !this.events?.onSelectInteraction)
                return;
            try {
                const query = ctx.callbackQuery;
                if (!query)
                    return;
                const interaction = (0, wrappers_1.wrapTelegramCallbackQuery)(query, this.bot.api);
                // Select menu callbacks use \x1F (Unit Separator) between
                // customId and value. Regular button customIds never contain
                // \x1F, so this cleanly distinguishes the two.
                const sepIdx = (query.data ?? '').indexOf(wrappers_1.SELECT_CALLBACK_SEP);
                if (sepIdx > 0 && this.events.onSelectInteraction) {
                    const selectCustomId = (query.data ?? '').slice(0, sepIdx);
                    const selectedValue = (query.data ?? '').slice(sepIdx + 1);
                    await this.events.onSelectInteraction({
                        id: query.id,
                        platform: 'telegram',
                        customId: selectCustomId,
                        user: interaction.user,
                        channel: interaction.channel,
                        values: [selectedValue],
                        messageId: interaction.messageId,
                        deferUpdate: interaction.deferUpdate,
                        reply: interaction.reply,
                        update: interaction.update,
                        editReply: interaction.editReply,
                        followUp: interaction.followUp,
                    });
                    return;
                }
                if (this.events.onButtonInteraction) {
                    await this.events.onButtonInteraction(interaction);
                }
            }
            catch (error) {
                this.emitError(error);
            }
        });
    }
    emitError(error) {
        if (!this.events?.onError)
            return;
        if (error instanceof Error) {
            this.events.onError(error);
        }
        else {
            this.events.onError(new Error(String(error)));
        }
    }
}
exports.TelegramAdapter = TelegramAdapter;
