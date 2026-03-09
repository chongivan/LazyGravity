"use strict";
/**
 * Discord adapter implementing the PlatformAdapter interface.
 *
 * Bridges discord.js Client events into platform-agnostic callbacks,
 * allowing the bot core to operate independently of Discord specifics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordAdapter = void 0;
const discord_js_1 = require("discord.js");
const wrappers_1 = require("./wrappers");
class DiscordAdapter {
    platform = 'discord';
    client;
    botUserId = '';
    constructor(client) {
        this.client = client;
    }
    /**
     * Start listening for Discord events and forward them
     * through the platform-agnostic event callbacks.
     */
    async start(events) {
        // Ready event: capture bot user ID and notify
        this.client.once(discord_js_1.Events.ClientReady, (readyClient) => {
            this.botUserId = readyClient.user.id;
            events.onReady?.();
        });
        // Message create
        if (events.onMessage) {
            const onMessage = events.onMessage;
            this.client.on(discord_js_1.Events.MessageCreate, async (message) => {
                try {
                    const wrapped = (0, wrappers_1.wrapDiscordMessage)(message);
                    await onMessage(wrapped);
                }
                catch (error) {
                    events.onError?.(error instanceof Error ? error : new Error(String(error)));
                }
            });
        }
        // Interaction create (buttons, selects, commands)
        if (events.onButtonInteraction || events.onSelectInteraction || events.onCommandInteraction) {
            this.client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
                try {
                    if (interaction.isButton() && events.onButtonInteraction) {
                        const wrapped = (0, wrappers_1.wrapDiscordButton)(interaction);
                        await events.onButtonInteraction(wrapped);
                    }
                    else if (interaction.isStringSelectMenu() && events.onSelectInteraction) {
                        const wrapped = (0, wrappers_1.wrapDiscordSelect)(interaction);
                        await events.onSelectInteraction(wrapped);
                    }
                    else if (interaction.isChatInputCommand() && events.onCommandInteraction) {
                        const wrapped = (0, wrappers_1.wrapDiscordCommand)(interaction);
                        await events.onCommandInteraction(wrapped);
                    }
                }
                catch (error) {
                    events.onError?.(error instanceof Error ? error : new Error(String(error)));
                }
            });
        }
        // Client error forwarding
        this.client.on(discord_js_1.Events.Error, (error) => {
            events.onError?.(error);
        });
    }
    /** Stop the adapter by destroying the discord.js Client. */
    async stop() {
        this.client.destroy();
    }
    /**
     * Retrieve a channel by its Discord snowflake ID.
     * Returns null if the channel is not found, not fetchable, or not text-based.
     */
    async getChannel(channelId) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel)
                return null;
            if (!channel.isTextBased())
                return null;
            return (0, wrappers_1.wrapDiscordChannel)(channel);
        }
        catch {
            return null;
        }
    }
    /** Return the bot's own user ID. Empty string before start() completes. */
    getBotUserId() {
        return this.botUserId;
    }
    /** Access the raw discord.js Client for platform-specific features. */
    getRawClient() {
        return this.client;
    }
}
exports.DiscordAdapter = DiscordAdapter;
