"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessageCreateHandler = createMessageCreateHandler;
const discord_js_1 = require("discord.js");
const messageParser_1 = require("../commands/messageParser");
const plainTextFormatter_1 = require("../utils/plainTextFormatter");
const wrappers_1 = require("../platform/discord/wrappers");
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const modeService_1 = require("../services/modeService");
const imageHandler_1 = require("../utils/imageHandler");
const logger_1 = require("../utils/logger");
function createMessageCreateHandler(deps) {
    const getCurrentCdp = deps.getCurrentCdp ?? cdpBridgeManager_1.getCurrentCdp;
    const ensureApprovalDetector = deps.ensureApprovalDetector ?? cdpBridgeManager_1.ensureApprovalDetector;
    const ensureErrorPopupDetector = deps.ensureErrorPopupDetector ?? cdpBridgeManager_1.ensureErrorPopupDetector;
    const ensurePlanningDetector = deps.ensurePlanningDetector ?? cdpBridgeManager_1.ensurePlanningDetector;
    const ensureRunCommandDetector = deps.ensureRunCommandDetector ?? cdpBridgeManager_1.ensureRunCommandDetector;
    const registerApprovalWorkspaceChannel = deps.registerApprovalWorkspaceChannel ?? cdpBridgeManager_1.registerApprovalWorkspaceChannel;
    const registerApprovalSessionChannel = deps.registerApprovalSessionChannel ?? cdpBridgeManager_1.registerApprovalSessionChannel;
    const downloadInboundImageAttachments = deps.downloadInboundImageAttachments ?? imageHandler_1.downloadInboundImageAttachments;
    const cleanupInboundImageAttachments = deps.cleanupInboundImageAttachments ?? imageHandler_1.cleanupInboundImageAttachments;
    const isImageAttachment = deps.isImageAttachment ?? imageHandler_1.isImageAttachment;
    // Per-workspace prompt queue: serializes send→response cycles
    const workspaceQueues = new Map();
    const workspaceQueueDepths = new Map();
    function enqueueForWorkspace(workspacePath, task) {
        // .catch: ensure a prior rejection never stalls the chain
        const current = (workspaceQueues.get(workspacePath) ?? Promise.resolve()).catch(() => { });
        const next = current.then(async () => {
            try {
                await task();
            }
            catch (err) {
                logger_1.logger.error('[WorkspaceQueue] task error:', err?.message || err);
            }
        });
        workspaceQueues.set(workspacePath, next);
        return next;
    }
    return async (message) => {
        if (message.author.bot)
            return;
        if (!deps.config.allowedUserIds.includes(message.author.id)) {
            return;
        }
        const parsed = (0, messageParser_1.parseMessageContent)(message.content);
        if (parsed.isCommand && parsed.commandName) {
            if (parsed.commandName === 'autoaccept') {
                const result = deps.bridge.autoAccept.handle(parsed.args?.[0]);
                await message.reply({ content: result.message }).catch(logger_1.logger.error);
                return;
            }
            if (parsed.commandName === 'screenshot') {
                await deps.handleScreenshot(message, getCurrentCdp(deps.bridge));
                await message.reply({ content: '💡 You can also use the slash command `/screenshot`.' }).catch(() => { });
                return;
            }
            if (parsed.commandName === 'status') {
                const activeNames = deps.bridge.pool.getActiveWorkspaceNames();
                const currentMode = deps.modeService.getCurrentMode();
                const statusFields = [
                    { name: 'CDP Connection', value: activeNames.length > 0 ? `🟢 ${activeNames.length} project(s) connected` : '⚪ Disconnected', inline: true },
                    { name: 'Mode', value: modeService_1.MODE_DISPLAY_NAMES[currentMode] || currentMode, inline: true },
                    { name: 'Auto Approve', value: deps.bridge.autoAccept.isEnabled() ? '🟢 ON' : '⚪ OFF', inline: true },
                ];
                let statusDescription = '';
                if (activeNames.length > 0) {
                    const lines = activeNames.map((name) => {
                        const cdp = deps.bridge.pool.getConnected(name);
                        const contexts = cdp ? cdp.getContexts().length : 0;
                        const detectorActive = deps.bridge.pool.getApprovalDetector(name)?.isActive() ? ' [Detecting]' : '';
                        return `• **${name}** — Contexts: ${contexts}${detectorActive}`;
                    });
                    statusDescription = `**Connected Projects:**\n${lines.join('\n')}`;
                }
                else {
                    statusDescription = 'Send a message to auto-connect to a project.';
                }
                const statusOutputFormat = deps.userPrefRepo?.getOutputFormat(message.author.id) ?? 'embed';
                if (statusOutputFormat === 'plain') {
                    const chunks = (0, plainTextFormatter_1.formatAsPlainText)({
                        title: '🔧 Bot Status',
                        description: statusDescription,
                        fields: statusFields,
                        footerText: 'Use the slash command /status for more detailed information',
                    });
                    await message.reply({ content: chunks[0] });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🔧 Bot Status')
                    .setColor(activeNames.length > 0 ? 0x00CC88 : 0x888888)
                    .addFields(...statusFields)
                    .setDescription(statusDescription)
                    .setFooter({ text: '💡 Use the slash command /status for more detailed information' })
                    .setTimestamp();
                await message.reply({ embeds: [embed] });
                return;
            }
            const slashOnlyCommands = ['help', 'stop', 'model', 'mode', 'project', 'chat', 'new', 'cleanup', 'join', 'mirror', 'output'];
            if (slashOnlyCommands.includes(parsed.commandName)) {
                await message.reply({
                    content: `💡 Please use \`/${parsed.commandName}\` as a slash command.\nType \`/${parsed.commandName}\` in the Discord input field to see suggestions.`,
                }).catch(logger_1.logger.error);
                return;
            }
            const result = await deps.slashCommandHandler.handleCommand(parsed.commandName, parsed.args || []);
            await message.reply({
                content: result.message,
            }).catch(logger_1.logger.error);
            if (result.prompt) {
                const cdp = getCurrentCdp(deps.bridge);
                if (cdp) {
                    await deps.sendPromptToAntigravity(deps.bridge, message, result.prompt, cdp, deps.modeService, deps.modelService, [], {
                        chatSessionService: deps.chatSessionService,
                        chatSessionRepo: deps.chatSessionRepo,
                        channelManager: deps.channelManager,
                        titleGenerator: deps.titleGenerator,
                        userPrefRepo: deps.userPrefRepo,
                        extractionMode: deps.config.extractionMode,
                    });
                }
                else {
                    await message.reply('Not connected to CDP. Send a message first to connect to a project.');
                }
            }
            return;
        }
        const hasImageAttachments = Array.from(message.attachments.values())
            .some((attachment) => isImageAttachment(attachment.contentType, attachment.name));
        if (message.content.trim() || hasImageAttachments) {
            const promptText = message.content.trim() || 'Please review the attached images and respond accordingly.';
            const inboundImages = await downloadInboundImageAttachments(message);
            if (hasImageAttachments && inboundImages.length === 0) {
                await message.reply('Failed to retrieve attached images. Please wait and try again.').catch(() => { });
                return;
            }
            const workspacePath = deps.wsHandler.getWorkspaceForChannel(message.channelId);
            try {
                if (workspacePath) {
                    const projectLabel = deps.bridge.pool.extractProjectName(workspacePath);
                    // Track queue depth for hourglass reactions
                    const currentDepth = workspaceQueueDepths.get(workspacePath) ?? 0;
                    workspaceQueueDepths.set(workspacePath, currentDepth + 1);
                    const newDepth = currentDepth + 1;
                    if (currentDepth > 0) {
                        logger_1.logger.info(`[Queue:${projectLabel}] Enqueued (depth: ${newDepth}, channel: ${message.channelId})`);
                        await message.react('⏳').catch(() => { });
                    }
                    else {
                        logger_1.logger.info(`[Queue:${projectLabel}] Processing immediately (depth: ${newDepth}, channel: ${message.channelId})`);
                    }
                    const queueStartTime = Date.now();
                    await enqueueForWorkspace(workspacePath, async () => {
                        const waitMs = Date.now() - queueStartTime;
                        if (waitMs > 100) {
                            logger_1.logger.info(`[Queue:${projectLabel}] Task started after ${Math.round(waitMs / 1000)}s wait (channel: ${message.channelId})`);
                        }
                        // Remove hourglass when task starts processing
                        const botId = message.client.user?.id;
                        if (botId) {
                            await message.reactions.resolve('⏳')?.users.remove(botId).catch(() => { });
                        }
                        try {
                            const cdp = await deps.bridge.pool.getOrConnect(workspacePath);
                            const projectName = deps.bridge.pool.extractProjectName(workspacePath);
                            deps.bridge.lastActiveWorkspace = projectName;
                            const platformChannel = (0, wrappers_1.wrapDiscordChannel)(message.channel);
                            deps.bridge.lastActiveChannel = platformChannel;
                            registerApprovalWorkspaceChannel(deps.bridge, projectName, platformChannel);
                            ensureApprovalDetector(deps.bridge, cdp, projectName);
                            ensureErrorPopupDetector(deps.bridge, cdp, projectName);
                            ensurePlanningDetector(deps.bridge, cdp, projectName);
                            ensureRunCommandDetector(deps.bridge, cdp, projectName);
                            const session = deps.chatSessionRepo.findByChannelId(message.channelId);
                            if (session?.displayName) {
                                registerApprovalSessionChannel(deps.bridge, projectName, session.displayName, platformChannel);
                            }
                            if (session?.isRenamed && session.displayName) {
                                const activationResult = await deps.chatSessionService.activateSessionByTitle(cdp, session.displayName);
                                if (!activationResult.ok) {
                                    const reason = activationResult.error ? ` (${activationResult.error})` : '';
                                    await message.reply(`⚠️ Could not route this message to the bound session (${session.displayName}). ` +
                                        `Please open /chat and verify the session${reason}.`).catch(() => { });
                                    return;
                                }
                            }
                            else if (session && !session.isRenamed) {
                                try {
                                    const chatResult = await deps.chatSessionService.startNewChat(cdp);
                                    if (!chatResult.ok) {
                                        logger_1.logger.warn('[MessageCreate] Failed to start new chat in Antigravity:', chatResult.error);
                                        message.channel.send(`⚠️ Could not open a new chat in Antigravity. Sending to existing chat.`).catch(() => { });
                                    }
                                }
                                catch (err) {
                                    logger_1.logger.error('[MessageCreate] startNewChat error:', err);
                                    message.channel.send(`⚠️ Could not open a new chat in Antigravity. Sending to existing chat.`).catch(() => { });
                                }
                            }
                            await deps.autoRenameChannel(message, deps.chatSessionRepo, deps.titleGenerator, deps.channelManager, cdp);
                            // Re-register session channel after autoRenameChannel sets displayName
                            const updatedSession = deps.chatSessionRepo.findByChannelId(message.channelId);
                            if (updatedSession?.displayName) {
                                registerApprovalSessionChannel(deps.bridge, projectName, updatedSession.displayName, platformChannel);
                            }
                            // Register echo hash so UserMessageDetector skips this message
                            const userMsgDetector = deps.bridge.pool.getUserMessageDetector?.(projectName);
                            if (userMsgDetector) {
                                userMsgDetector.addEchoHash(promptText);
                            }
                            // Wait for full response cycle (onComplete/onTimeout) before releasing the queue.
                            // Safety timeout (360s) prevents permanent queue deadlock if onFullCompletion
                            // is never called due to a bug.
                            const QUEUE_SAFETY_TIMEOUT_MS = 360_000;
                            const promptStartTime = Date.now();
                            await new Promise((resolve) => {
                                const safetyTimer = setTimeout(() => {
                                    logger_1.logger.warn(`[Queue:${projectName}] Safety timeout — releasing queue after 360s ` +
                                        `(channel: ${message.channelId})`);
                                    resolve();
                                }, QUEUE_SAFETY_TIMEOUT_MS);
                                let settled = false;
                                const settle = () => {
                                    if (settled)
                                        return;
                                    settled = true;
                                    clearTimeout(safetyTimer);
                                    const elapsed = Math.round((Date.now() - promptStartTime) / 1000);
                                    logger_1.logger.info(`[Queue:${projectName}] Prompt completed in ${elapsed}s ` +
                                        `(channel: ${message.channelId})`);
                                    resolve();
                                };
                                deps.sendPromptToAntigravity(deps.bridge, message, promptText, cdp, deps.modeService, deps.modelService, inboundImages, {
                                    chatSessionService: deps.chatSessionService,
                                    chatSessionRepo: deps.chatSessionRepo,
                                    channelManager: deps.channelManager,
                                    titleGenerator: deps.titleGenerator,
                                    userPrefRepo: deps.userPrefRepo,
                                    extractionMode: deps.config.extractionMode,
                                    onFullCompletion: settle,
                                }).catch((err) => {
                                    // sendPromptToAntigravity rejected before onFullCompletion fired
                                    // (e.g. setup code threw before top-level try/catch).
                                    // Release the queue immediately instead of waiting for safety timeout.
                                    logger_1.logger.error(`[Queue:${projectName}] sendPromptToAntigravity rejected early ` +
                                        `(channel: ${message.channelId}):`, err?.message || err);
                                    settle();
                                });
                            });
                        }
                        catch (e) {
                            logger_1.logger.error(`[Queue:${projectLabel}] Task failed (channel: ${message.channelId}):`, e.message);
                            await message.reply(`Failed to connect to workspace: ${e.message}`);
                        }
                        finally {
                            const remainingDepth = (workspaceQueueDepths.get(workspacePath) ?? 1) - 1;
                            workspaceQueueDepths.set(workspacePath, remainingDepth);
                            if (remainingDepth > 0) {
                                logger_1.logger.info(`[Queue:${projectLabel}] Task done, ${remainingDepth} remaining`);
                            }
                        }
                    });
                }
                else {
                    await message.reply('No project is configured for this channel. Please create or select one with `/project`.');
                }
            }
            finally {
                await cleanupInboundImageAttachments(inboundImages);
            }
        }
    };
}
