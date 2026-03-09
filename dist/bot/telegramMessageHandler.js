"use strict";
/**
 * Minimal Telegram message handler.
 *
 * Handles incoming PlatformMessage from Telegram:
 *   1. Resolves workspace from TelegramBindingRepository
 *   2. Connects to CDP
 *   3. Injects the prompt into Antigravity
 *   4. Monitors the response via ResponseMonitor
 *   5. Relays the response text back via PlatformChannel.send()
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTelegramMessageHandler = createTelegramMessageHandler;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const responseMonitor_1 = require("../services/responseMonitor");
const processLogBuffer_1 = require("../utils/processLogBuffer");
const discordFormatter_1 = require("../utils/discordFormatter");
const telegramProjectCommand_1 = require("./telegramProjectCommand");
const telegramCommands_1 = require("./telegramCommands");
const telegramFormatter_1 = require("../platform/telegram/telegramFormatter");
const defaultModelApplicator_1 = require("../services/defaultModelApplicator");
const logger_1 = require("../utils/logger");
const telegramImageHandler_1 = require("../utils/telegramImageHandler");
const imageHandler_1 = require("../utils/imageHandler");
/**
 * Create a handler for Telegram messages.
 * Returns an async function that processes a single PlatformMessage.
 */
function createTelegramMessageHandler(deps) {
    // Per-workspace prompt queue to serialize messages
    const workspaceQueues = new Map();
    function enqueueForWorkspace(workspacePath, task) {
        const current = (workspaceQueues.get(workspacePath) ?? Promise.resolve()).catch(() => { });
        const next = current.then(async () => {
            try {
                await task();
            }
            catch (err) {
                logger_1.logger.error('[TelegramQueue] task error:', err?.message || err);
            }
        });
        workspaceQueues.set(workspacePath, next);
        return next;
    }
    return async (message) => {
        const handlerEntryTime = Date.now();
        const chatId = message.channel.id;
        const hasImageAttachments = message.attachments.length > 0
            && message.attachments.some((att) => (att.contentType || '').startsWith('image/'));
        const promptText = message.content.trim();
        // Allow through if there's text OR image attachments
        if (!promptText && !hasImageAttachments)
            return;
        logger_1.logger.debug(`[TelegramHandler] handler entered (chat=${chatId}, msgTime=${message.createdAt.toISOString()}, handlerDelay=${handlerEntryTime - message.createdAt.getTime()}ms)`);
        // Intercept built-in commands (/help, /status, /stop, /ping, /start)
        const cmd = (0, telegramCommands_1.parseTelegramCommand)(promptText);
        if (cmd) {
            await (0, telegramCommands_1.handleTelegramCommand)({
                bridge: deps.bridge,
                modeService: deps.modeService,
                modelService: deps.modelService,
                telegramBindingRepo: deps.telegramBindingRepo,
                templateRepo: deps.templateRepo,
                workspaceService: deps.workspaceService,
                fetchQuota: deps.fetchQuota,
                activeMonitors: deps.activeMonitors,
                chatSessionService: deps.chatSessionService,
            }, message, cmd);
            return;
        }
        // Intercept /project command before CDP path
        if (deps.workspaceService) {
            const parsed = (0, telegramProjectCommand_1.parseTelegramProjectCommand)(promptText);
            if (parsed) {
                await (0, telegramProjectCommand_1.handleTelegramProjectCommand)({ workspaceService: deps.workspaceService, telegramBindingRepo: deps.telegramBindingRepo }, message, parsed);
                return;
            }
        }
        // Resolve workspace binding for this Telegram chat
        const binding = deps.telegramBindingRepo.findByChatId(chatId);
        if (!binding) {
            await message.reply({
                text: 'No project is linked to this chat. Use /project to bind a workspace.',
            }).catch(logger_1.logger.error);
            return;
        }
        // Resolve relative workspace name to absolute path (mirrors Discord handler behavior).
        // Without this, CDP receives a bare name like "DemoLG" and Antigravity
        // falls back to its default scratch directory.
        const workspacePath = deps.workspaceService
            ? deps.workspaceService.getWorkspacePath(binding.workspacePath)
            : binding.workspacePath;
        await enqueueForWorkspace(workspacePath, async () => {
            const cdpStartTime = Date.now();
            logger_1.logger.debug(`[TelegramHandler] getOrConnect start (elapsed=${cdpStartTime - handlerEntryTime}ms)`);
            let cdp;
            try {
                cdp = await deps.bridge.pool.getOrConnect(workspacePath);
            }
            catch (e) {
                await message.reply({
                    text: `Failed to connect to workspace: ${e.message}`,
                }).catch(logger_1.logger.error);
                return;
            }
            logger_1.logger.debug(`[TelegramHandler] getOrConnect done (took=${Date.now() - cdpStartTime}ms)`);
            const projectName = deps.bridge.pool.extractProjectName(workspacePath);
            deps.bridge.lastActiveWorkspace = projectName;
            deps.bridge.lastActiveChannel = message.channel;
            (0, cdpBridgeManager_1.registerApprovalWorkspaceChannel)(deps.bridge, projectName, message.channel);
            // Always push ModeService's mode to Antigravity on CDP connect.
            // ModeService is the source of truth (what the user sees in /mode UI).
            // Without this, Antigravity could be in a different mode (e.g. Planning)
            // while the user believes they're in Fast mode.
            if (deps.modeService) {
                const currentMode = deps.modeService.getCurrentMode();
                const syncRes = await cdp.setUiMode(currentMode);
                if (syncRes.ok) {
                    deps.modeService.markSynced();
                    logger_1.logger.debug(`[TelegramHandler] Mode pushed to Antigravity: ${currentMode}`);
                }
                else {
                    logger_1.logger.warn(`[TelegramHandler] Mode push failed: ${syncRes.error}`);
                }
            }
            // Apply default model preference on CDP connect
            if (deps.modelService) {
                const modelResult = await (0, defaultModelApplicator_1.applyDefaultModel)(cdp, deps.modelService);
                if (modelResult.stale && modelResult.staleMessage) {
                    await message.reply({ text: modelResult.staleMessage }).catch(logger_1.logger.error);
                }
            }
            // Start detectors (platform-agnostic now)
            (0, cdpBridgeManager_1.ensureApprovalDetector)(deps.bridge, cdp, projectName);
            (0, cdpBridgeManager_1.ensureErrorPopupDetector)(deps.bridge, cdp, projectName);
            (0, cdpBridgeManager_1.ensurePlanningDetector)(deps.bridge, cdp, projectName);
            (0, cdpBridgeManager_1.ensureRunCommandDetector)(deps.bridge, cdp, projectName);
            // Acknowledge receipt
            await message.react('\u{1F440}').catch(() => { });
            // Download image attachments if present
            let inboundImages = [];
            if (hasImageAttachments && deps.botToken && deps.botApi) {
                try {
                    inboundImages = await (0, telegramImageHandler_1.downloadTelegramPhotos)(message.attachments, deps.botToken, deps.botApi);
                }
                catch (err) {
                    logger_1.logger.warn('[TelegramHandler] Image download failed:', err?.message || err);
                }
                if (hasImageAttachments && inboundImages.length === 0) {
                    await message.reply({
                        text: 'Failed to retrieve attached images. Please wait and try again.',
                    }).catch(logger_1.logger.error);
                    return;
                }
            }
            // Determine the prompt text — use default for image-only messages
            const effectivePrompt = promptText || 'Please review the attached images and respond accordingly.';
            // Inject prompt (with or without images) into Antigravity
            logger_1.logger.prompt(effectivePrompt);
            let injectResult;
            try {
                if (inboundImages.length > 0) {
                    injectResult = await cdp.injectMessageWithImageFiles(effectivePrompt, inboundImages.map((img) => img.localPath));
                    if (!injectResult.ok) {
                        // Fallback: send text-only with image reference
                        logger_1.logger.warn('[TelegramHandler] Image injection failed, falling back to text-only');
                        injectResult = await cdp.injectMessage(effectivePrompt);
                    }
                }
                else {
                    injectResult = await cdp.injectMessage(effectivePrompt);
                }
            }
            finally {
                // Cleanup temp files regardless of outcome
                if (inboundImages.length > 0) {
                    await (0, imageHandler_1.cleanupInboundImageAttachments)(inboundImages).catch(() => { });
                }
            }
            if (!injectResult.ok) {
                await message.reply({
                    text: `Failed to send message: ${injectResult.error}`,
                }).catch(logger_1.logger.error);
                return;
            }
            // Monitor the response
            const channel = message.channel;
            const startTime = Date.now();
            const processLogBuffer = new processLogBuffer_1.ProcessLogBuffer({ maxChars: 3500, maxEntries: 120, maxEntryLength: 220 });
            let lastActivityLogText = '';
            let statusMsg = null;
            // Send initial status message
            statusMsg = await channel.send({ text: 'Processing...' }).catch(() => null);
            await new Promise((resolve) => {
                const TIMEOUT_MS = 300_000;
                let settled = false;
                const settle = () => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(safetyTimer);
                    deps.activeMonitors?.delete(projectName);
                    resolve();
                };
                const monitor = new responseMonitor_1.ResponseMonitor({
                    cdpService: cdp,
                    pollIntervalMs: 2000,
                    maxDurationMs: TIMEOUT_MS,
                    stopGoneConfirmCount: 3,
                    extractionMode: deps.extractionMode,
                    onProcessLog: (logText) => {
                        if (logText && logText.trim().length > 0) {
                            lastActivityLogText = processLogBuffer.append(logText);
                        }
                        if (statusMsg && lastActivityLogText) {
                            const elapsed = Math.round((Date.now() - startTime) / 1000);
                            // Escape HTML to prevent Telegram parse_mode errors
                            // (activity logs may contain <, >, & from code/paths)
                            statusMsg.edit({
                                text: `${(0, telegramFormatter_1.escapeHtml)(lastActivityLogText)}\n\n⏱️ ${elapsed}s`,
                            }).catch(() => { });
                        }
                    },
                    onComplete: async (finalText) => {
                        try {
                            const elapsed = Math.round((Date.now() - startTime) / 1000);
                            // Console log output (mirroring Discord handler pattern)
                            const finalLogText = lastActivityLogText || processLogBuffer.snapshot();
                            if (finalLogText && finalLogText.trim().length > 0) {
                                logger_1.logger.divider('Process Log');
                                console.info(finalLogText);
                            }
                            const separated = (0, discordFormatter_1.splitOutputAndLogs)(finalText || '');
                            const finalOutputText = separated.output || finalText || '';
                            if (finalOutputText && finalOutputText.trim().length > 0) {
                                logger_1.logger.divider(`Output (${finalOutputText.length} chars)`);
                                console.info(finalOutputText);
                            }
                            logger_1.logger.divider();
                            // Update status message with final activity log
                            if (statusMsg && finalLogText && finalLogText.trim().length > 0) {
                                await statusMsg.edit({
                                    text: `${(0, telegramFormatter_1.escapeHtml)(finalLogText)}\n\n✅ Done in ${elapsed}s`,
                                }).catch(() => { });
                            }
                            else if (statusMsg) {
                                await statusMsg.delete().catch(() => { });
                            }
                            // Send the final response
                            if (finalOutputText && finalOutputText.trim().length > 0) {
                                await sendTextChunked(channel, finalOutputText);
                            }
                            else if (finalText && finalText.trim().length > 0) {
                                await sendTextChunked(channel, finalText);
                            }
                            else {
                                await channel.send({ text: '(Empty response from Antigravity)' }).catch(logger_1.logger.error);
                            }
                        }
                        finally {
                            settle();
                        }
                    },
                    onTimeout: async (lastText) => {
                        try {
                            // Update status message on timeout
                            if (statusMsg) {
                                const elapsed = Math.round((Date.now() - startTime) / 1000);
                                await statusMsg.edit({
                                    text: `⏰ Timed out after ${elapsed}s`,
                                }).catch(() => { });
                            }
                            if (lastText && lastText.trim().length > 0) {
                                await sendTextChunked(channel, `(Timeout) ${lastText}`);
                            }
                            else {
                                await channel.send({ text: 'Response timed out.' }).catch(logger_1.logger.error);
                            }
                        }
                        finally {
                            settle();
                        }
                    },
                });
                const safetyTimer = setTimeout(() => {
                    logger_1.logger.warn(`[TelegramHandler:${projectName}] Safety timeout — releasing queue after 300s`);
                    monitor.stop().catch(() => { });
                    settle();
                }, TIMEOUT_MS);
                // Register the monitor so /stop can access and stop it
                deps.activeMonitors?.set(projectName, monitor);
                monitor.start().catch((err) => {
                    logger_1.logger.error(`[TelegramHandler:${projectName}] monitor.start() failed:`, err?.message || err);
                    settle();
                });
            });
        });
    };
}
/** Split long text into Telegram-safe chunks (max 4096 chars). */
async function sendTextChunked(channel, text) {
    const MAX_LENGTH = 4096;
    let remaining = text;
    while (remaining.length > 0) {
        const chunk = remaining.slice(0, MAX_LENGTH);
        remaining = remaining.slice(MAX_LENGTH);
        await channel.send({ text: chunk }).catch(logger_1.logger.error);
    }
}
