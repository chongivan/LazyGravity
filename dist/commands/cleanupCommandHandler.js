"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupCommandHandler = exports.CLEANUP_CANCEL_BTN = exports.CLEANUP_DELETE_BTN = exports.CLEANUP_ARCHIVE_BTN = void 0;
const i18n_1 = require("../utils/i18n");
const discord_js_1 = require("discord.js");
const logger_1 = require("../utils/logger");
/** Button custom IDs */
exports.CLEANUP_ARCHIVE_BTN = 'cleanup_archive';
exports.CLEANUP_DELETE_BTN = 'cleanup_delete';
exports.CLEANUP_CANCEL_BTN = 'cleanup_cancel';
/**
 * Handler for the /cleanup command.
 * Detects session channels and categories that have been inactive for the specified days,
 * and presents a confirmation for archiving or deletion.
 */
class CleanupCommandHandler {
    chatSessionRepo;
    bindingRepo;
    /** Holds the latest scan result (referenced on button press) */
    lastScanResult = null;
    constructor(chatSessionRepo, bindingRepo) {
        this.chatSessionRepo = chatSessionRepo;
        this.bindingRepo = bindingRepo;
    }
    /**
     * /cleanup [days] -- Scan unused channels/categories and display confirmation UI
     */
    async handleCleanup(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply({
                content: (0, i18n_1.t)('⚠️ This command can only be used in a server.'),
            });
            return;
        }
        const days = interaction.options.getInteger('days') ?? 7;
        if (days < 1 || days > 365) {
            await interaction.editReply({
                content: (0, i18n_1.t)('⚠️ Please specify a number of days between 1 and 365.'),
            });
            return;
        }
        // Execute scan
        const scanResult = await this.scanInactiveChannels(guild, days);
        this.lastScanResult = scanResult;
        const totalInactive = scanResult.inactiveSessions.length;
        const totalInactiveCategories = scanResult.inactiveCategories.length;
        if (totalInactive === 0 && totalInactiveCategories === 0) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle((0, i18n_1.t)('🧹 Cleanup Scan Complete'))
                .setDescription((0, i18n_1.t)(`No inactive sessions or categories found (threshold: ${days} days).\n\nScanned ${scanResult.totalScanned} channels total.`))
                .setColor(0x2ECC71)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // Build session list
        const sessionLines = scanResult.inactiveSessions.map((s) => {
            const name = s.channelName;
            const category = s.categoryName ? `📂 ${s.categoryName}` : '(No category)';
            return `• <#${s.channelId}> — ${category} — Last activity: **${s.daysSinceActivity} days ago**`;
        });
        // Build category list
        const categoryLines = scanResult.inactiveCategories.map((c) => {
            return `• 📂 **${c.categoryName}** (${c.sessionCount} sessions) — Last activity: **${c.daysSinceOldestActivity} days ago**`;
        });
        // Build embed (note Discord Embed limit: description is up to 4096 chars)
        let description = '';
        if (categoryLines.length > 0) {
            description += `**🗂️ Inactive Categories (${totalInactiveCategories})**\n`;
            description += `${(0, i18n_1.t)('All sessions within these categories have been inactive.')}\n`;
            description += categoryLines.slice(0, 15).join('\n');
            if (categoryLines.length > 15) {
                description += `\n...and ${categoryLines.length - 15} more`;
            }
            description += '\n\n';
        }
        if (sessionLines.length > 0) {
            description += `**💬 Inactive Sessions (${totalInactive})**\n`;
            description += sessionLines.slice(0, 20).join('\n');
            if (sessionLines.length > 20) {
                description += `\n...and ${sessionLines.length - 20} more`;
            }
        }
        // Truncate to fit within the 4096 character limit
        if (description.length > 4000) {
            description = description.substring(0, 3950) + '\n\n...(truncated)';
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle((0, i18n_1.t)('🧹 Cleanup Scan Results'))
            .setDescription(description)
            .setColor(0xF39C12)
            .addFields({
            name: (0, i18n_1.t)('Threshold'),
            value: (0, i18n_1.t)(`${days} days of inactivity`),
            inline: true,
        }, {
            name: (0, i18n_1.t)('Scanned'),
            value: `${scanResult.totalScanned} channels`,
            inline: true,
        }, {
            name: (0, i18n_1.t)('Found'),
            value: `${totalInactive} sessions, ${totalInactiveCategories} categories`,
            inline: true,
        })
            .setFooter({
            text: (0, i18n_1.t)('Choose an action below. Archive hides channels, Delete removes them permanently.'),
        })
            .setTimestamp();
        // Action buttons
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(exports.CLEANUP_ARCHIVE_BTN)
            .setLabel((0, i18n_1.t)('📦 Archive All'))
            .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
            .setCustomId(exports.CLEANUP_DELETE_BTN)
            .setLabel((0, i18n_1.t)('🗑️ Delete All'))
            .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
            .setCustomId(exports.CLEANUP_CANCEL_BTN)
            .setLabel((0, i18n_1.t)('Cancel'))
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        await interaction.editReply({
            embeds: [embed],
            components: [row],
        });
    }
    /**
     * Button press handler: Archive
     */
    async handleArchive(interaction) {
        if (!this.lastScanResult) {
            await interaction.update({
                content: (0, i18n_1.t)('⚠️ No scan results found. Please run `/cleanup` again.'),
                embeds: [],
                components: [],
            });
            return;
        }
        const guild = interaction.guild;
        if (!guild)
            return;
        await interaction.deferUpdate();
        const result = this.lastScanResult;
        let archivedCount = 0;
        let failedCount = 0;
        // Archive session channels (lock + permission restriction to hide)
        for (const session of result.inactiveSessions) {
            try {
                const channel = guild.channels.cache.get(session.channelId);
                if (channel && channel.type === discord_js_1.ChannelType.GuildText) {
                    const textChannel = channel;
                    // Add archive prefix to channel name
                    const archivedName = `archived-${textChannel.name}`;
                    await textChannel.setName(archivedName);
                    // Lock channel by denying @everyone's send message permission
                    const everyoneRole = guild.roles.everyone;
                    await textChannel.permissionOverwrites.create(everyoneRole, {
                        SendMessages: false,
                        ViewChannel: false,
                    });
                    archivedCount++;
                }
            }
            catch (e) {
                logger_1.logger.error(`[Cleanup] Failed to archive channel ${session.channelId}:`, e);
                failedCount++;
            }
        }
        // Archive inactive categories
        for (const category of result.inactiveCategories) {
            try {
                const categoryChannel = guild.channels.cache.get(category.categoryId);
                if (categoryChannel && categoryChannel.type === discord_js_1.ChannelType.GuildCategory) {
                    const cat = categoryChannel;
                    const archivedName = `📦-archived-${cat.name.replace(/^🗂️-/, '')}`;
                    await cat.setName(archivedName);
                    // Hide entire category
                    const everyoneRole = guild.roles.everyone;
                    await cat.permissionOverwrites.create(everyoneRole, {
                        ViewChannel: false,
                    });
                    archivedCount++;
                }
            }
            catch (e) {
                logger_1.logger.error(`[Cleanup] Failed to archive category ${category.categoryId}:`, e);
                failedCount++;
            }
        }
        this.lastScanResult = null;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle((0, i18n_1.t)('📦 Cleanup Complete — Archived'))
            .setDescription((0, i18n_1.t)(`Successfully archived ${archivedCount} channels/categories.`) +
            (failedCount > 0 ? `\n⚠️ ${failedCount} failed.` : ''))
            .setColor(0x2ECC71)
            .setTimestamp();
        await interaction.editReply({
            embeds: [embed],
            components: [],
        });
    }
    /**
     * Button press handler: Delete
     */
    async handleDelete(interaction) {
        if (!this.lastScanResult) {
            await interaction.update({
                content: (0, i18n_1.t)('⚠️ No scan results found. Please run `/cleanup` again.'),
                embeds: [],
                components: [],
            });
            return;
        }
        const guild = interaction.guild;
        if (!guild)
            return;
        await interaction.deferUpdate();
        const result = this.lastScanResult;
        let deletedCount = 0;
        let failedCount = 0;
        // Delete session channels
        for (const session of result.inactiveSessions) {
            try {
                const channel = guild.channels.cache.get(session.channelId);
                if (channel) {
                    await channel.delete(`Cleanup: ${result.thresholdDays} days inactive`);
                    // Also delete binding and session info from DB
                    this.chatSessionRepo.deleteByChannelId(session.channelId);
                    this.bindingRepo.deleteByChannelId(session.channelId);
                    deletedCount++;
                }
            }
            catch (e) {
                logger_1.logger.error(`[Cleanup] Failed to delete channel ${session.channelId}:`, e);
                failedCount++;
            }
        }
        // Delete inactive categories (delete category itself only if children are empty)
        for (const category of result.inactiveCategories) {
            try {
                const categoryChannel = guild.channels.cache.get(category.categoryId);
                if (categoryChannel && categoryChannel.type === discord_js_1.ChannelType.GuildCategory) {
                    // Check remaining channels under the category
                    const children = guild.channels.cache.filter((ch) => 'parentId' in ch && ch.parentId === category.categoryId);
                    // Delete child channels as well
                    for (const [, child] of children) {
                        try {
                            // Also delete records from DB
                            this.chatSessionRepo.deleteByChannelId(child.id);
                            this.bindingRepo.deleteByChannelId(child.id);
                            await child.delete(`Cleanup: category ${category.categoryName} removed`);
                            deletedCount++;
                        }
                        catch (e) {
                            logger_1.logger.error(`[Cleanup] Failed to delete child channel ${child.id} under category:`, e);
                            failedCount++;
                        }
                    }
                    // Delete the category itself
                    await categoryChannel.delete(`Cleanup: ${result.thresholdDays} days inactive`);
                    deletedCount++;
                }
            }
            catch (e) {
                logger_1.logger.error(`[Cleanup] Failed to delete category ${category.categoryId}:`, e);
                failedCount++;
            }
        }
        this.lastScanResult = null;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle((0, i18n_1.t)('🗑️ Cleanup Complete — Deleted'))
            .setDescription((0, i18n_1.t)(`Successfully deleted ${deletedCount} channels/categories.`) +
            (failedCount > 0 ? `\n⚠️ ${failedCount} failed.` : ''))
            .setColor(0xE74C3C)
            .setTimestamp();
        await interaction.editReply({
            embeds: [embed],
            components: [],
        });
    }
    /**
     * Button press handler: Cancel
     */
    async handleCancel(interaction) {
        this.lastScanResult = null;
        await interaction.update({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle((0, i18n_1.t)('🧹 Cleanup Cancelled'))
                    .setDescription((0, i18n_1.t)('No changes were made.'))
                    .setColor(0x888888)
                    .setTimestamp(),
            ],
            components: [],
        });
    }
    /**
     * Scan for inactive channels/categories
     */
    async scanInactiveChannels(guild, thresholdDays) {
        const now = new Date();
        const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
        // Fetch all channels
        const allChannels = await guild.channels.fetch();
        // Detect bot-managed categories (with 🗂️- prefix)
        const botCategories = allChannels.filter((ch) => ch !== null && ch.type === discord_js_1.ChannelType.GuildCategory && ch.name.startsWith('🗂️-'));
        const inactiveSessions = [];
        const categoryActivityMap = new Map();
        let totalScanned = 0;
        // Scan text channels under each category
        for (const [, category] of botCategories) {
            const children = allChannels.filter((ch) => ch !== null &&
                ch.type === discord_js_1.ChannelType.GuildText &&
                'parentId' in ch &&
                ch.parentId === category.id);
            const sessionsInCategory = [];
            let categoryHasActive = false;
            for (const [, child] of children) {
                totalScanned++;
                // Get the timestamp of the last message
                const lastActivity = await this.getLastActivityDate(child);
                const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000));
                if (daysSince >= thresholdDays) {
                    const session = {
                        channelId: child.id,
                        channelName: child.name,
                        categoryId: category.id,
                        categoryName: category.name,
                        lastActivityAt: lastActivity,
                        daysSinceActivity: daysSince,
                    };
                    inactiveSessions.push(session);
                    sessionsInCategory.push(session);
                }
                else {
                    categoryHasActive = true;
                }
            }
            categoryActivityMap.set(category.id, {
                sessions: sessionsInCategory,
                active: categoryHasActive,
                channel: category,
            });
        }
        // Determine if entire category is inactive
        const inactiveCategories = [];
        for (const [categoryId, data] of categoryActivityMap) {
            // Only if all sessions in the category are inactive (and at least 1 session exists)
            if (!data.active && data.sessions.length > 0) {
                // Get the oldest activity timestamp
                const oldestActivity = data.sessions.reduce((oldest, s) => (s.lastActivityAt < oldest ? s.lastActivityAt : oldest), data.sessions[0].lastActivityAt);
                const daysSince = Math.floor((now.getTime() - oldestActivity.getTime()) / (24 * 60 * 60 * 1000));
                inactiveCategories.push({
                    categoryId,
                    categoryName: data.channel.name,
                    sessionCount: data.sessions.length,
                    oldestActivity,
                    daysSinceOldestActivity: daysSince,
                });
            }
        }
        return {
            inactiveSessions,
            inactiveCategories,
            totalScanned,
            thresholdDays,
        };
    }
    /**
     * Get the last activity date of a channel.
     * Returns the timestamp of the last message, or the channel creation date, whichever is newer.
     */
    async getLastActivityDate(channel) {
        try {
            // Fetch the most recent message (descending)
            const messages = await channel.messages.fetch({ limit: 1 });
            if (messages.size > 0) {
                const lastMessage = messages.values().next().value;
                if (lastMessage) {
                    return lastMessage.createdAt;
                }
            }
        }
        catch (e) {
            logger_1.logger.warn(`[Cleanup] Failed to fetch messages for channel ${channel.id}:`, e);
        }
        // Use channel creation date if no messages
        return channel.createdAt;
    }
    /**
     * Get the current scan result (for testing)
     */
    getLastScanResult() {
        return this.lastScanResult;
    }
}
exports.CleanupCommandHandler = CleanupCommandHandler;
