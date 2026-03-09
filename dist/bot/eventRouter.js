"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRouter = void 0;
const logger_1 = require("../utils/logger");
/**
 * Routes events from multiple PlatformAdapters through auth check
 * and dispatches to unified handlers.
 */
class EventRouter {
    config;
    handlers;
    adapters = [];
    constructor(config, handlers) {
        this.config = config;
        this.handlers = handlers;
    }
    /** Register an adapter. Stores it for later start/stop. */
    registerAdapter(adapter) {
        this.adapters.push(adapter);
    }
    /** Start all registered adapters. */
    async startAll() {
        await Promise.all(this.adapters.map((adapter) => {
            const events = this.createAdapterEvents(adapter);
            return adapter.start(events);
        }));
    }
    /** Stop all registered adapters. */
    async stopAll() {
        await Promise.all(this.adapters.map((a) => a.stop()));
    }
    /** Check if a user is authorized on a given platform. */
    isAuthorized(platform, userId) {
        const allowed = this.config.allowedUsers.get(platform);
        return allowed ? allowed.has(userId) : false;
    }
    createAdapterEvents(adapter) {
        return {
            onReady: () => {
                logger_1.logger.info(`[EventRouter] ${adapter.platform} adapter ready`);
            },
            onMessage: async (msg) => {
                if (msg.author.isBot)
                    return;
                if (!this.isAuthorized(msg.platform, msg.author.id))
                    return;
                await this.handlers.onMessage?.(msg);
            },
            onButtonInteraction: async (interaction) => {
                if (!this.isAuthorized(interaction.platform, interaction.user.id))
                    return;
                await this.handlers.onButtonInteraction?.(interaction);
            },
            onSelectInteraction: async (interaction) => {
                if (!this.isAuthorized(interaction.platform, interaction.user.id))
                    return;
                await this.handlers.onSelectInteraction?.(interaction);
            },
            onCommandInteraction: async (interaction) => {
                if (!this.isAuthorized(interaction.platform, interaction.user.id))
                    return;
                await this.handlers.onCommandInteraction?.(interaction);
            },
            onError: (err) => {
                logger_1.logger.error(`[EventRouter] ${adapter.platform} error:`, err);
            },
        };
    }
}
exports.EventRouter = EventRouter;
