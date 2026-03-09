"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinCommandHandler = void 0;
const i18n_1 = require("../utils/i18n");
const discord_js_1 = require("discord.js");
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const responseMonitor_1 = require("../services/responseMonitor");
const sessionPickerUi_1 = require("../ui/sessionPickerUi");
const logger_1 = require("../utils/logger");
/** Maximum embed description length (Discord limit is 4096) */
const MAX_EMBED_DESC = 4000;
/**
 * Handler for /join and /mirror commands
 *
 * /join   — List Antigravity sessions and connect to one via a select menu.
 * /mirror — Toggle PC-to-Discord message mirroring ON/OFF.
 */
class JoinCommandHandler {
    chatSessionService;
    chatSessionRepo;
    bindingRepo;
    channelManager;
    pool;
    workspaceService;
    client;
    extractionMode;
    /** Active ResponseMonitors per workspace (for AI response mirroring) */
    activeResponseMonitors = new Map();
    constructor(chatSessionService, chatSessionRepo, bindingRepo, channelManager, pool, workspaceService, client, extractionMode) {
        this.chatSessionService = chatSessionService;
        this.chatSessionRepo = chatSessionRepo;
        this.bindingRepo = bindingRepo;
        this.channelManager = channelManager;
        this.pool = pool;
        this.workspaceService = workspaceService;
        this.client = client;
        this.extractionMode = extractionMode;
    }
    /**
     * Resolve a project name (from DB) to its full absolute path.
     * The DB stores only the project name; CDP needs the full path for launching.
     */
    resolveProjectPath(projectName) {
        return this.workspaceService.getWorkspacePath(projectName);
    }
    /**
     * /join — Show session picker for the workspace bound to this channel.
     */
    async handleJoin(interaction, bridge) {
        const binding = this.bindingRepo.findByChannelId(interaction.channelId);
        const session = this.chatSessionRepo.findByChannelId(interaction.channelId);
        const projectName = binding?.workspacePath ?? session?.workspacePath;
        if (!projectName) {
            await interaction.editReply({
                content: (0, i18n_1.t)('⚠️ No project is bound to this channel. Use `/project` first.'),
            });
            return;
        }
        const projectPath = this.resolveProjectPath(projectName);
        let cdp;
        try {
            cdp = await this.pool.getOrConnect(projectPath);
        }
        catch (e) {
            await interaction.editReply({
                content: (0, i18n_1.t)(`⚠️ Failed to connect to project: ${e.message}`),
            });
            return;
        }
        const sessions = await this.chatSessionService.listAllSessions(cdp);
        const { embeds, components } = (0, sessionPickerUi_1.buildSessionPickerUI)(sessions);
        await interaction.editReply({ embeds, components });
    }
    /**
     * Handle session selection from the /join picker.
     *
     * Flow:
     *   1. Check if a channel already exists for this session (by displayName)
     *   2. If yes → reply with a link to that channel
     *   3. If no → create a new channel, bind it, activate session, start mirroring
     */
    async handleJoinSelect(interaction, bridge) {
        const selectedTitle = interaction.values[0];
        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply({ content: (0, i18n_1.t)('⚠️ This command can only be used in a server.') });
            return;
        }
        const binding = this.bindingRepo.findByChannelId(interaction.channelId);
        const session = this.chatSessionRepo.findByChannelId(interaction.channelId);
        const projectName = binding?.workspacePath ?? session?.workspacePath;
        if (!projectName) {
            await interaction.editReply({ content: (0, i18n_1.t)('⚠️ No project is bound to this channel.') });
            return;
        }
        const projectPath = this.resolveProjectPath(projectName);
        // Step 1: Check if a channel already exists for this session
        const existingSession = this.chatSessionRepo.findByDisplayName(projectName, selectedTitle);
        if (existingSession) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle((0, i18n_1.t)('🔗 Session Already Connected'))
                .setDescription((0, i18n_1.t)(`This session already has a channel:\n→ <#${existingSession.channelId}>`))
                .setColor(0x3498DB)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed], components: [] });
            return;
        }
        // Step 2: Connect to CDP
        let cdp;
        try {
            cdp = await this.pool.getOrConnect(projectPath);
        }
        catch (e) {
            await interaction.editReply({ content: (0, i18n_1.t)(`⚠️ Failed to connect to project: ${e.message}`) });
            return;
        }
        // Step 3: Activate the session in Antigravity
        const activateResult = await this.chatSessionService.activateSessionByTitle(cdp, selectedTitle);
        if (!activateResult.ok) {
            await interaction.editReply({ content: (0, i18n_1.t)(`⚠️ Failed to join session: ${activateResult.error}`) });
            return;
        }
        // Step 4: Create a new Discord channel for this session
        const categoryResult = await this.channelManager.ensureCategory(guild, projectName);
        const categoryId = categoryResult.categoryId;
        const sessionNumber = this.chatSessionRepo.getNextSessionNumber(categoryId);
        const channelName = this.channelManager.sanitizeChannelName(`${sessionNumber}-${selectedTitle}`);
        const channelResult = await this.channelManager.createSessionChannel(guild, categoryId, channelName);
        const newChannelId = channelResult.channelId;
        // Step 5: Register binding and session
        this.bindingRepo.upsert({
            channelId: newChannelId,
            workspacePath: projectName,
            guildId: guild.id,
        });
        this.chatSessionRepo.create({
            channelId: newChannelId,
            categoryId,
            workspacePath: projectName,
            sessionNumber,
            guildId: guild.id,
        });
        this.chatSessionRepo.updateDisplayName(newChannelId, selectedTitle);
        // Step 6: Start mirroring (routes dynamically to all bound session channels)
        this.startMirroring(bridge, cdp, projectName);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle((0, i18n_1.t)('🔗 Joined Session'))
            .setDescription((0, i18n_1.t)(`Connected to: **${selectedTitle}**\n→ <#${newChannelId}>\n\n` +
            `📡 Mirroring is **ON** — PC messages will appear in the new channel.\n` +
            `Use \`/mirror\` to toggle.`))
            .setColor(0x2ECC71)
            .setTimestamp();
        await interaction.editReply({ embeds: [embed], components: [] });
    }
    /**
     * /mirror — Toggle mirroring ON/OFF for the current channel's workspace.
     */
    async handleMirror(interaction, bridge) {
        const binding = this.bindingRepo.findByChannelId(interaction.channelId);
        const session = this.chatSessionRepo.findByChannelId(interaction.channelId);
        const projectName = binding?.workspacePath ?? session?.workspacePath;
        if (!projectName) {
            await interaction.editReply({
                content: (0, i18n_1.t)('⚠️ No project is bound to this channel. Use `/project` first.'),
            });
            return;
        }
        const projectPath = this.resolveProjectPath(projectName);
        const detector = this.pool.getUserMessageDetector(projectName);
        if (detector?.isActive()) {
            // Turn OFF — stop user message detector and any active response monitor
            detector.stop();
            const responseMonitor = this.activeResponseMonitors.get(projectName);
            if (responseMonitor?.isActive()) {
                await responseMonitor.stop();
                this.activeResponseMonitors.delete(projectName);
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle((0, i18n_1.t)('📡 Mirroring OFF'))
                .setDescription((0, i18n_1.t)('PC-to-Discord message mirroring has been stopped.'))
                .setColor(0x95A5A6)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else {
            // Turn ON
            let cdp;
            try {
                cdp = await this.pool.getOrConnect(projectPath);
            }
            catch (e) {
                await interaction.editReply({
                    content: (0, i18n_1.t)(`⚠️ Failed to connect to project: ${e.message}`),
                });
                return;
            }
            this.startMirroring(bridge, cdp, projectName);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle((0, i18n_1.t)('📡 Mirroring ON'))
                .setDescription((0, i18n_1.t)('PC-to-Discord message mirroring is now active.\n' +
                'Messages typed in Antigravity will appear in the corresponding session channel.'))
                .setColor(0x2ECC71)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
    /**
     * Start user message mirroring for a project.
     *
     * When a PC message is detected, the callback resolves the correct Discord
     * channel via chatSessionRepo.findByDisplayName. Only explicitly joined
     * sessions (with a displayName binding) receive mirrored messages.
     */
    startMirroring(bridge, cdp, projectName) {
        // Force re-prime: stop existing detector so that ensureUserMessageDetector
        // creates a fresh one. This prevents the detector from treating the
        // new session's last message as a "new" user message after /join.
        const existing = this.pool.getUserMessageDetector(projectName);
        if (existing?.isActive()) {
            existing.stop();
        }
        (0, cdpBridgeManager_1.ensureUserMessageDetector)(bridge, cdp, projectName, (info) => {
            this.routeMirroredMessage(cdp, projectName, info)
                .catch((err) => {
                logger_1.logger.error('[Mirror] Error routing mirrored message:', err);
            });
        });
    }
    /**
     * Route a mirrored PC message to the correct Discord channel and
     * start a passive ResponseMonitor to capture the AI response.
     *
     * Routing: chatSessionRepo.findByDisplayName only — no fallbacks.
     * Sessions without an explicit channel binding are silently skipped.
     */
    async routeMirroredMessage(cdp, projectName, info) {
        const chatTitle = await (0, cdpBridgeManager_1.getCurrentChatTitle)(cdp);
        if (!chatTitle) {
            logger_1.logger.debug('[Mirror] No chat title detected, skipping');
            return;
        }
        const session = this.chatSessionRepo.findByDisplayName(projectName, chatTitle);
        if (!session) {
            logger_1.logger.debug(`[Mirror] No bound channel for session "${chatTitle}", skipping`);
            return;
        }
        const channel = this.client.channels.cache.get(session.channelId);
        if (!channel || !('send' in channel))
            return;
        const sendable = channel;
        // Mirror the user message
        const userEmbed = new discord_js_1.EmbedBuilder()
            .setDescription(`🖥️ ${info.text}`)
            .setColor(0x95A5A6)
            .setFooter({ text: `Typed in Antigravity · ${chatTitle}` })
            .setTimestamp();
        await sendable.send({ embeds: [userEmbed] }).catch((err) => {
            logger_1.logger.error('[Mirror] Failed to send user message:', err);
        });
        // Start passive ResponseMonitor to capture the AI response
        this.startResponseMirror(cdp, projectName, sendable, chatTitle);
    }
    /**
     * Start a passive ResponseMonitor that sends the AI response to Discord
     * when generation completes.
     */
    startResponseMirror(cdp, projectName, channel, chatTitle) {
        // Stop previous monitor if still running
        const prev = this.activeResponseMonitors.get(projectName);
        if (prev?.isActive()) {
            prev.stop().catch(() => { });
        }
        const monitor = new responseMonitor_1.ResponseMonitor({
            cdpService: cdp,
            pollIntervalMs: 2000,
            maxDurationMs: 300000,
            extractionMode: this.extractionMode,
            onComplete: (finalText) => {
                this.activeResponseMonitors.delete(projectName);
                if (!finalText || finalText.trim().length === 0)
                    return;
                const text = finalText.length > MAX_EMBED_DESC
                    ? finalText.slice(0, MAX_EMBED_DESC) + '\n…(truncated)'
                    : finalText;
                const embed = new discord_js_1.EmbedBuilder()
                    .setDescription(text)
                    .setColor(0x5865F2)
                    .setFooter({ text: `Antigravity response · ${chatTitle}` })
                    .setTimestamp();
                channel.send({ embeds: [embed] }).catch((err) => {
                    logger_1.logger.error('[Mirror] Failed to send AI response:', err);
                });
            },
            onTimeout: () => {
                this.activeResponseMonitors.delete(projectName);
            },
        });
        this.activeResponseMonitors.set(projectName, monitor);
        monitor.startPassive().catch((err) => {
            logger_1.logger.error('[Mirror] Failed to start response monitor:', err);
            this.activeResponseMonitors.delete(projectName);
        });
    }
}
exports.JoinCommandHandler = JoinCommandHandler;
