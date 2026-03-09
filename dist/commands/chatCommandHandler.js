"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCommandHandler = void 0;
const i18n_1 = require("../utils/i18n");
const discord_js_1 = require("discord.js");
/**
 * Handler for chat session related commands
 *
 * Commands:
 *   - /new: Create a new session channel under the category + start a new chat in Antigravity
 *   - /chat: Display current session info + list all sessions in the same project (unified)
 */
class ChatCommandHandler {
    chatSessionService;
    chatSessionRepo;
    bindingRepo;
    channelManager;
    pool;
    workspaceService;
    constructor(chatSessionService, chatSessionRepo, bindingRepo, channelManager, workspaceService, pool) {
        this.chatSessionService = chatSessionService;
        this.chatSessionRepo = chatSessionRepo;
        this.bindingRepo = bindingRepo;
        this.channelManager = channelManager;
        this.workspaceService = workspaceService;
        this.pool = pool ?? null;
    }
    /**
     * /new -- Create a new session channel under the category and start a new chat in Antigravity
     */
    async handleNew(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply({ content: (0, i18n_1.t)('⚠️ This command can only be used in a server.') });
            return;
        }
        const channel = interaction.channel;
        if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
            await interaction.editReply({ content: (0, i18n_1.t)('⚠️ Please execute in a text channel.') });
            return;
        }
        // Check if the current channel is under a project category
        const parentId = 'parentId' in channel ? channel.parentId : null;
        if (!parentId) {
            await interaction.editReply({
                content: (0, i18n_1.t)('⚠️ Please run in a project category channel.\nUse `/project` to create a project first.'),
            });
            return;
        }
        // Determine the project path
        const currentSession = this.chatSessionRepo.findByChannelId(interaction.channelId);
        const binding = this.bindingRepo.findByChannelId(interaction.channelId);
        const workspaceName = currentSession?.workspacePath ?? binding?.workspacePath;
        if (!workspaceName) {
            await interaction.editReply({
                content: (0, i18n_1.t)('⚠️ Please run in a project category channel.\nUse `/project` to create a project first.'),
            });
            return;
        }
        // Convert workspace name to full path
        const workspacePath = this.workspaceService.getWorkspacePath(workspaceName);
        // Switch project (connect to the correct workbench page)
        let workspaceCdp;
        if (this.pool) {
            try {
                workspaceCdp = await this.pool.getOrConnect(workspacePath);
            }
            catch (e) {
                await interaction.editReply({
                    content: (0, i18n_1.t)(`⚠️ Failed to switch project: ${e.message}`),
                });
                return;
            }
        }
        if (!workspaceCdp) {
            await interaction.editReply({
                content: (0, i18n_1.t)('⚠️ CDP pool is not initialized or cannot connect to workspace.'),
            });
            return;
        }
        // Create a new session channel
        const sessionNumber = this.chatSessionRepo.getNextSessionNumber(parentId);
        const channelName = `session-${sessionNumber}`;
        const sessionResult = await this.channelManager.createSessionChannel(guild, parentId, channelName);
        const newChannelId = sessionResult.channelId;
        // Register binding and session
        this.bindingRepo.upsert({
            channelId: newChannelId,
            workspacePath: workspaceName,
            guildId: guild.id,
        });
        this.chatSessionRepo.create({
            channelId: newChannelId,
            categoryId: parentId,
            workspacePath: workspaceName,
            sessionNumber,
            guildId: guild.id,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle((0, i18n_1.t)('💬 Started a new session'))
            .setDescription((0, i18n_1.t)(`Created a new chat session\n→ <#${newChannelId}>`))
            .setColor(0x00CC88)
            .addFields({ name: (0, i18n_1.t)('Session'), value: channelName, inline: true }, { name: (0, i18n_1.t)('Project'), value: workspacePath, inline: true })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    /**
     * /chat -- Display current session info + list all sessions in the same project (unified view)
     */
    async handleChat(interaction) {
        const session = this.chatSessionRepo.findByChannelId(interaction.channelId);
        if (!session) {
            // Channel not managed by session -- get info directly from Antigravity
            const activeNames = this.pool?.getActiveWorkspaceNames() ?? [];
            const anyCdp = activeNames.length > 0 ? this.pool?.getConnected(activeNames[0]) : null;
            const info = anyCdp
                ? await this.chatSessionService.getCurrentSessionInfo(anyCdp)
                : { title: (0, i18n_1.t)('(CDP Disconnected)'), hasActiveChat: false };
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle((0, i18n_1.t)('💬 Chat Session Info'))
                .setColor(info.hasActiveChat ? 0x00CC88 : 0x888888)
                .addFields({ name: (0, i18n_1.t)('Title'), value: info.title, inline: true }, { name: (0, i18n_1.t)('Status'), value: info.hasActiveChat ? (0, i18n_1.t)('🟢 Active') : (0, i18n_1.t)('⚪ Inactive'), inline: true })
                .setDescription((0, i18n_1.t)('※ Non-session channel.\nUse `/project` to create a project first.'))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // Get all sessions in the same category
        const allSessions = this.chatSessionRepo.findByCategoryId(session.categoryId);
        // Build session list
        const sessionList = allSessions.map((s) => {
            const name = s.displayName ? `${s.displayName}` : `session-${s.sessionNumber}`;
            const current = s.channelId === interaction.channelId ? (0, i18n_1.t)(' ← **Current**') : '';
            return `• <#${s.channelId}> — ${name}${current}`;
        }).join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle((0, i18n_1.t)('💬 Chat Session Info'))
            .setColor(0x00CC88)
            .addFields({ name: (0, i18n_1.t)('Current session'), value: (0, i18n_1.t)(`#${session.sessionNumber} — ${session.displayName || '(Unset)'}`), inline: false }, { name: (0, i18n_1.t)('Project'), value: session.workspacePath, inline: true }, { name: (0, i18n_1.t)('Total sessions'), value: `${allSessions.length}`, inline: true })
            .setDescription((0, i18n_1.t)(`**Sessions:**\n${sessionList}`))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}
exports.ChatCommandHandler = ChatCommandHandler;
