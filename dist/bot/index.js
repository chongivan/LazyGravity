"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBot = exports.getResponseDeliveryModeForTest = void 0;
exports.createSerialTaskQueueForTest = createSerialTaskQueueForTest;
const i18n_1 = require("../utils/i18n");
const logger_1 = require("../utils/logger");
const logBuffer_1 = require("../utils/logBuffer");
const discord_js_1 = require("discord.js");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const wrappers_1 = require("../platform/discord/wrappers");
const config_1 = require("../utils/config");
const slashCommandHandler_1 = require("../commands/slashCommandHandler");
const registerSlashCommands_1 = require("../commands/registerSlashCommands");
const modeService_1 = require("../services/modeService");
const modelService_1 = require("../services/modelService");
const defaultModelApplicator_1 = require("../services/defaultModelApplicator");
const templateRepository_1 = require("../database/templateRepository");
const workspaceBindingRepository_1 = require("../database/workspaceBindingRepository");
const chatSessionRepository_1 = require("../database/chatSessionRepository");
const workspaceService_1 = require("../services/workspaceService");
const workspaceCommandHandler_1 = require("../commands/workspaceCommandHandler");
const chatCommandHandler_1 = require("../commands/chatCommandHandler");
const cleanupCommandHandler_1 = require("../commands/cleanupCommandHandler");
const channelManager_1 = require("../services/channelManager");
const titleGeneratorService_1 = require("../services/titleGeneratorService");
const joinCommandHandler_1 = require("../commands/joinCommandHandler");
const chatSessionService_1 = require("../services/chatSessionService");
const responseMonitor_1 = require("../services/responseMonitor");
const antigravityLauncher_1 = require("../services/antigravityLauncher");
const pathUtils_1 = require("../utils/pathUtils");
const promptDispatcher_1 = require("../services/promptDispatcher");
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const streamMessageFormatter_1 = require("../utils/streamMessageFormatter");
const discordFormatter_1 = require("../utils/discordFormatter");
const processLogBuffer_1 = require("../utils/processLogBuffer");
const imageHandler_1 = require("../utils/imageHandler");
const modeUi_1 = require("../ui/modeUi");
const modelsUi_1 = require("../ui/modelsUi");
const templateUi_1 = require("../ui/templateUi");
const autoAcceptUi_1 = require("../ui/autoAcceptUi");
const outputUi_1 = require("../ui/outputUi");
const screenshotUi_1 = require("../ui/screenshotUi");
const userPreferenceRepository_1 = require("../database/userPreferenceRepository");
const plainTextFormatter_1 = require("../utils/plainTextFormatter");
const interactionCreateHandler_1 = require("../events/interactionCreateHandler");
const messageCreateHandler_1 = require("../events/messageCreateHandler");
// Telegram platform support
const grammy_1 = require("grammy");
const telegramAdapter_1 = require("../platform/telegram/telegramAdapter");
const telegramBindingRepository_1 = require("../database/telegramBindingRepository");
const telegramMessageHandler_1 = require("./telegramMessageHandler");
const telegramProjectCommand_1 = require("./telegramProjectCommand");
const eventRouter_1 = require("./eventRouter");
const buttonHandler_1 = require("../handlers/buttonHandler");
const selectHandler_1 = require("../handlers/selectHandler");
const approvalButtonAction_1 = require("../handlers/approvalButtonAction");
const planningButtonAction_1 = require("../handlers/planningButtonAction");
const errorPopupButtonAction_1 = require("../handlers/errorPopupButtonAction");
const runCommandButtonAction_1 = require("../handlers/runCommandButtonAction");
const modelButtonAction_1 = require("../handlers/modelButtonAction");
const autoAcceptButtonAction_1 = require("../handlers/autoAcceptButtonAction");
const templateButtonAction_1 = require("../handlers/templateButtonAction");
const modeSelectAction_1 = require("../handlers/modeSelectAction");
// =============================================================================
// Embed color palette (color-coded by phase)
// =============================================================================
const PHASE_COLORS = {
    sending: 0x5865F2, // Blue
    thinking: 0x9B59B6, // Purple
    generating: 0xF39C12, // Gold
    complete: 0x2ECC71, // Green
    timeout: 0xE74C3C, // Red
    error: 0xC0392B, // Dark Red
};
const PHASE_ICONS = {
    sending: '📡',
    thinking: '🧠',
    generating: '✍️',
    complete: '✅',
    timeout: '⏰',
    error: '❌',
};
const MAX_OUTBOUND_GENERATED_IMAGES = 4;
const RESPONSE_DELIVERY_MODE = (0, config_1.resolveResponseDeliveryMode)();
/** Tracks channel IDs where /stop was explicitly invoked by the user */
const userStopRequestedChannels = new Set();
const getResponseDeliveryModeForTest = () => RESPONSE_DELIVERY_MODE;
exports.getResponseDeliveryModeForTest = getResponseDeliveryModeForTest;
function createSerialTaskQueueForTest(queueName, traceId) {
    let queue = Promise.resolve();
    let queueDepth = 0;
    let taskSeq = 0;
    return (task, label = 'queue-task') => {
        taskSeq += 1;
        const seq = taskSeq;
        queueDepth += 1;
        queue = queue.then(async () => {
            try {
                await task();
            }
            catch (err) {
                logger_1.logger.error(`[sendQueue:${traceId}:${queueName}] error #${seq} label=${label}:`, err?.message || err);
            }
            finally {
                queueDepth = Math.max(0, queueDepth - 1);
            }
        });
        return queue;
    };
}
/**
 * Send a Discord message (prompt) to Antigravity, wait for the response, and relay it back to Discord
 *
 * Message strategy:
 *   - Send new messages per phase instead of editing, to preserve history
 *   - Visualize the flow of planning/analysis/execution confirmation/implementation as logs
 */
async function sendPromptToAntigravity(bridge, message, prompt, cdp, modeService, modelService, inboundImages = [], options) {
    // Completion signal — called exactly once when the entire prompt lifecycle ends
    let completionSignaled = false;
    const signalCompletion = (exitPath) => {
        if (completionSignaled)
            return;
        completionSignaled = true;
        logger_1.logger.debug(`[sendPrompt:${message.channelId}] signalCompletion via ${exitPath}`);
        options?.onFullCompletion?.();
    };
    // Resolve output format once at the start (no mid-response switches)
    const outputFormat = options?.userPrefRepo?.getOutputFormat(message.author.id) ?? 'embed';
    // Add reaction to acknowledge command receipt
    await message.react('👀').catch(() => { });
    const channel = (message.channel && 'send' in message.channel) ? message.channel : null;
    const monitorTraceId = `${message.channelId}:${message.id}`;
    const enqueueGeneral = createSerialTaskQueueForTest('general', monitorTraceId);
    const enqueueResponse = createSerialTaskQueueForTest('response', monitorTraceId);
    const enqueueActivity = createSerialTaskQueueForTest('activity', monitorTraceId);
    const sendEmbed = (title, description, color, fields, footerText) => enqueueGeneral(async () => {
        if (!channel)
            return;
        if (outputFormat === 'plain') {
            const chunks = (0, plainTextFormatter_1.formatAsPlainText)({ title, description, fields, footerText });
            for (const chunk of chunks) {
                await channel.send({ content: chunk }).catch(() => { });
            }
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();
        if (fields && fields.length > 0) {
            embed.addFields(...fields);
        }
        if (footerText) {
            embed.setFooter({ text: footerText });
        }
        await channel.send({ embeds: [embed] }).catch(() => { });
    }, 'send-embed');
    const shouldTryGeneratedImages = (inputPrompt, responseText) => {
        const prompt = (inputPrompt || '').toLowerCase();
        const response = (responseText || '').toLowerCase();
        const imageIntentPattern = /(image|images|png|jpg|jpeg|gif|webp|illustration|diagram|render)/i;
        const imageUrlPattern = /https?:\/\/\S+\.(png|jpg|jpeg|gif|webp)/i;
        if (imageIntentPattern.test(prompt))
            return true;
        if (response.includes('![') || imageUrlPattern.test(response))
            return true;
        return false;
    };
    const sendGeneratedImages = async (responseText) => {
        if (!channel)
            return;
        if (!shouldTryGeneratedImages(prompt, responseText))
            return;
        const extracted = await cdp.extractLatestResponseImages(MAX_OUTBOUND_GENERATED_IMAGES);
        if (extracted.length === 0)
            return;
        const files = [];
        for (let i = 0; i < extracted.length; i++) {
            const attachment = await (0, imageHandler_1.toDiscordAttachment)(extracted[i], i);
            if (attachment)
                files.push(attachment);
        }
        if (files.length === 0)
            return;
        await enqueueGeneral(async () => {
            await channel.send({
                content: (0, i18n_1.t)(`🖼️ Detected generated images (${files.length})`),
                files,
            }).catch(() => { });
        }, 'send-generated-images');
    };
    const tryEmergencyExtractText = async () => {
        try {
            const contextId = cdp.getPrimaryContextId();
            const expression = `(() => {
                const panel = document.querySelector('.antigravity-agent-side-panel');
                const scope = panel || document;

                const candidateSelectors = [
                    '.rendered-markdown',
                    '.leading-relaxed.select-text',
                    '.flex.flex-col.gap-y-3',
                    '[data-message-author-role="assistant"]',
                    '[data-message-role="assistant"]',
                    '[class*="assistant-message"]',
                    '[class*="message-content"]',
                    '[class*="markdown-body"]',
                    '.prose',
                ];

                const looksLikeActivity = (text) => {
                    const normalized = (text || '').trim().toLowerCase();
                    if (!normalized) return true;
                    const activityPattern = /^(?:analy[sz]ing|reading|writing|running|searching|planning|thinking|processing|loading|executing|testing|debugging|analyzed|read|wrote|ran)/i;
                    return activityPattern.test(normalized) && normalized.length <= 220;
                };

                const clean = (text) => (text || '').replace(/\\r/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();

                const candidates = [];
                const seen = new Set();
                for (const selector of candidateSelectors) {
                    const nodes = scope.querySelectorAll(selector);
                    for (const node of nodes) {
                        if (!node || seen.has(node)) continue;
                        seen.add(node);
                        candidates.push(node);
                    }
                }

                for (let i = candidates.length - 1; i >= 0; i--) {
                    const node = candidates[i];
                    const text = clean(node.innerText || node.textContent || '');
                    if (!text || text.length < 20) continue;
                    if (looksLikeActivity(text)) continue;
                    if (/^(good|bad)$/i.test(text)) continue;
                    return text;
                }

                return '';
            })()`;
            const callParams = {
                expression,
                returnByValue: true,
                awaitPromise: true,
            };
            if (contextId !== null)
                callParams.contextId = contextId;
            const res = await cdp.call('Runtime.evaluate', callParams);
            const value = res?.result?.value;
            return typeof value === 'string' ? value.trim() : '';
        }
        catch {
            return '';
        }
    };
    const clearWatchingReaction = async () => {
        const botId = message.client.user?.id;
        if (botId) {
            await message.reactions.resolve('👀')?.users.remove(botId).catch(() => { });
        }
    };
    if (!cdp.isConnected()) {
        await sendEmbed(`${PHASE_ICONS.error} Connection Error`, `Not connected to Antigravity.\nStart with \`${(0, pathUtils_1.getAntigravityCdpHint)(9223)}\`, then send a message to auto-connect.`, PHASE_COLORS.error);
        await clearWatchingReaction();
        await message.react('❌').catch(() => { });
        signalCompletion('cdp-disconnected');
        return;
    }
    // Apply default model preference on CDP connect
    const defaultModelResult = await (0, defaultModelApplicator_1.applyDefaultModel)(cdp, modelService);
    if (defaultModelResult.stale && defaultModelResult.staleMessage && channel) {
        await channel.send(defaultModelResult.staleMessage).catch(() => { });
    }
    const localMode = modeService.getCurrentMode();
    const modeName = modeService_1.MODE_UI_NAMES[localMode] || localMode;
    const currentModel = (await cdp.getCurrentModel()) || modelService.getCurrentModel();
    const fastModel = currentModel;
    const planModel = currentModel;
    await sendEmbed(`${PHASE_ICONS.sending} [${modeName} - ${currentModel}${localMode === 'plan' ? ' (Thinking)' : ''}] Sending...`, (0, streamMessageFormatter_1.buildModeModelLines)(modeName, fastModel, planModel).join('\n'), PHASE_COLORS.sending);
    let isFinalized = false;
    let lastProgressText = '';
    let lastActivityLogText = '';
    const LIVE_RESPONSE_MAX_LEN = 3800;
    const LIVE_ACTIVITY_MAX_LEN = 3800;
    const processLogBuffer = new processLogBuffer_1.ProcessLogBuffer({
        maxChars: LIVE_ACTIVITY_MAX_LEN,
        maxEntries: 120,
        maxEntryLength: 220,
    });
    const liveResponseMessages = [];
    const liveActivityMessages = [];
    let lastLiveResponseKey = '';
    let lastLiveActivityKey = '';
    let liveResponseUpdateVersion = 0;
    let liveActivityUpdateVersion = 0;
    const ACTIVITY_PLACEHOLDER = (0, i18n_1.t)('Collecting process logs...');
    const buildLiveResponseDescriptions = (text) => {
        const normalized = (text || '').trim();
        if (!normalized) {
            return [(0, i18n_1.t)('Waiting for output...')];
        }
        return (0, streamMessageFormatter_1.splitForEmbedDescription)((0, discordFormatter_1.formatForDiscord)(normalized), LIVE_RESPONSE_MAX_LEN);
    };
    const buildLiveActivityDescriptions = (text) => {
        const normalized = (text || '').trim();
        if (!normalized)
            return [ACTIVITY_PLACEHOLDER];
        const formatted = (0, discordFormatter_1.formatForDiscord)(normalized);
        return [(0, streamMessageFormatter_1.fitForSingleEmbedDescription)(formatted, LIVE_ACTIVITY_MAX_LEN)];
    };
    const appendProcessLogs = (text) => {
        const normalized = (text || '').trim();
        if (!normalized)
            return processLogBuffer.snapshot();
        return processLogBuffer.append(normalized);
    };
    const upsertLiveResponseEmbeds = (title, rawText, color, footerText, opts) => enqueueResponse(async () => {
        if (opts?.skipWhenFinalized && isFinalized)
            return;
        if (opts?.expectedVersion !== undefined && opts.expectedVersion !== liveResponseUpdateVersion)
            return;
        if (!channel)
            return;
        if (outputFormat === 'plain') {
            const formatted = (0, discordFormatter_1.formatForDiscord)((rawText || '').trim());
            const plainChunks = (0, plainTextFormatter_1.splitPlainText)(`**${title}**\n${formatted}\n_${footerText}_`);
            const renderKey = `${title}|plain|${footerText}|${plainChunks.join('\n<<<PAGE_BREAK>>>\n')}`;
            if (renderKey === lastLiveResponseKey && liveResponseMessages.length > 0)
                return;
            lastLiveResponseKey = renderKey;
            for (let i = 0; i < plainChunks.length; i++) {
                if (!liveResponseMessages[i]) {
                    liveResponseMessages[i] = await channel.send({ content: plainChunks[i] }).catch(() => null);
                    continue;
                }
                await liveResponseMessages[i].edit({ content: plainChunks[i] }).catch(async () => {
                    liveResponseMessages[i] = await channel.send({ content: plainChunks[i] }).catch(() => null);
                });
            }
            while (liveResponseMessages.length > plainChunks.length) {
                const extra = liveResponseMessages.pop();
                if (!extra)
                    continue;
                await extra.delete().catch(() => { });
            }
            return;
        }
        const descriptions = buildLiveResponseDescriptions(rawText);
        const renderKey = `${title}|${color}|${footerText}|${descriptions.join('\n<<<PAGE_BREAK>>>\n')}`;
        if (renderKey === lastLiveResponseKey && liveResponseMessages.length > 0) {
            return;
        }
        lastLiveResponseKey = renderKey;
        for (let i = 0; i < descriptions.length; i++) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(descriptions.length > 1 ? `${title} (${i + 1}/${descriptions.length})` : title)
                .setDescription(descriptions[i])
                .setColor(color)
                .setFooter({ text: footerText })
                .setTimestamp();
            if (!liveResponseMessages[i]) {
                liveResponseMessages[i] = await channel.send({ embeds: [embed] }).catch(() => null);
                continue;
            }
            await liveResponseMessages[i].edit({ embeds: [embed] }).catch(async () => {
                liveResponseMessages[i] = await channel.send({ embeds: [embed] }).catch(() => null);
            });
        }
        // Delete excess messages if page count decreased
        while (liveResponseMessages.length > descriptions.length) {
            const extra = liveResponseMessages.pop();
            if (!extra)
                continue;
            await extra.delete().catch(() => { });
        }
    }, `upsert-response:${opts?.source ?? 'unknown'}`);
    const upsertLiveActivityEmbeds = (title, rawText, color, footerText, opts) => enqueueActivity(async () => {
        if (opts?.skipWhenFinalized && isFinalized)
            return;
        if (opts?.expectedVersion !== undefined && opts.expectedVersion !== liveActivityUpdateVersion)
            return;
        if (!channel)
            return;
        if (outputFormat === 'plain') {
            const formatted = (0, discordFormatter_1.formatForDiscord)((rawText || '').trim());
            const plainContent = `**${title}**\n${formatted}\n_${footerText}_`;
            const plainChunks = (0, plainTextFormatter_1.splitPlainText)(plainContent);
            const renderKey = `${title}|plain|${footerText}|${plainChunks.join('\n<<<PAGE_BREAK>>>\n')}`;
            if (renderKey === lastLiveActivityKey && liveActivityMessages.length > 0)
                return;
            lastLiveActivityKey = renderKey;
            for (let i = 0; i < plainChunks.length; i++) {
                if (!liveActivityMessages[i]) {
                    liveActivityMessages[i] = await channel.send({ content: plainChunks[i] }).catch(() => null);
                    continue;
                }
                await liveActivityMessages[i].edit({ content: plainChunks[i] }).catch(async () => {
                    liveActivityMessages[i] = await channel.send({ content: plainChunks[i] }).catch(() => null);
                });
            }
            while (liveActivityMessages.length > plainChunks.length) {
                const extra = liveActivityMessages.pop();
                if (!extra)
                    continue;
                await extra.delete().catch(() => { });
            }
            return;
        }
        const descriptions = buildLiveActivityDescriptions(rawText);
        const renderKey = `${title}|${color}|${footerText}|${descriptions.join('\n<<<PAGE_BREAK>>>\n')}`;
        if (renderKey === lastLiveActivityKey && liveActivityMessages.length > 0) {
            return;
        }
        lastLiveActivityKey = renderKey;
        for (let i = 0; i < descriptions.length; i++) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(descriptions.length > 1 ? `${title} (${i + 1}/${descriptions.length})` : title)
                .setDescription(descriptions[i])
                .setColor(color)
                .setFooter({ text: footerText })
                .setTimestamp();
            if (!liveActivityMessages[i]) {
                liveActivityMessages[i] = await channel.send({ embeds: [embed] }).catch(() => null);
                continue;
            }
            await liveActivityMessages[i].edit({ embeds: [embed] }).catch(async () => {
                liveActivityMessages[i] = await channel.send({ embeds: [embed] }).catch(() => null);
            });
        }
        while (liveActivityMessages.length > descriptions.length) {
            const extra = liveActivityMessages.pop();
            if (!extra)
                continue;
            await extra.delete().catch(() => { });
        }
    }, `upsert-activity:${opts?.source ?? 'unknown'}`);
    try {
        logger_1.logger.prompt(prompt);
        let injectResult;
        if (inboundImages.length > 0) {
            injectResult = await cdp.injectMessageWithImageFiles(prompt, inboundImages.map((image) => image.localPath));
            if (!injectResult.ok) {
                await sendEmbed((0, i18n_1.t)('🖼️ Attached image fallback'), (0, i18n_1.t)('Failed to attach image directly, resending via URL reference.'), PHASE_COLORS.thinking);
                injectResult = await cdp.injectMessage((0, imageHandler_1.buildPromptWithAttachmentUrls)(prompt, inboundImages));
            }
        }
        else {
            injectResult = await cdp.injectMessage(prompt);
        }
        if (!injectResult.ok) {
            isFinalized = true;
            await sendEmbed(`${PHASE_ICONS.error} Message Injection Failed`, `Failed to send message: ${injectResult.error}`, PHASE_COLORS.error);
            await clearWatchingReaction();
            await message.react('❌').catch(() => { });
            signalCompletion('inject-failed');
            return;
        }
        const startTime = Date.now();
        await upsertLiveActivityEmbeds(`${PHASE_ICONS.thinking} Process Log`, '', PHASE_COLORS.thinking, (0, i18n_1.t)('⏱️ Elapsed: 0s | Process log'), { source: 'initial' });
        const monitor = new responseMonitor_1.ResponseMonitor({
            cdpService: cdp,
            pollIntervalMs: 2000,
            maxDurationMs: 300000,
            stopGoneConfirmCount: 3,
            extractionMode: options?.extractionMode,
            onPhaseChange: (_phase, _text) => {
                // Phase transitions are already logged inside ResponseMonitor.setPhase()
            },
            onProcessLog: (logText) => {
                if (isFinalized)
                    return;
                if (logText && logText.trim().length > 0) {
                    lastActivityLogText = appendProcessLogs(logText);
                }
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                liveActivityUpdateVersion += 1;
                const activityVersion = liveActivityUpdateVersion;
                upsertLiveActivityEmbeds(`${PHASE_ICONS.thinking} Process Log`, lastActivityLogText || ACTIVITY_PLACEHOLDER, PHASE_COLORS.thinking, (0, i18n_1.t)(`⏱️ Elapsed: ${elapsed}s | Process log`), {
                    source: 'process-log',
                    expectedVersion: activityVersion,
                    skipWhenFinalized: true,
                }).catch(() => { });
            },
            onProgress: (text) => {
                if (isFinalized)
                    return;
                // Live output streaming disabled: RESPONSE_TEXT currently includes process logs (see #1).
                const separated = (0, discordFormatter_1.splitOutputAndLogs)(text);
                if (separated.output && separated.output.trim().length > 0) {
                    lastProgressText = separated.output;
                }
            },
            onComplete: async (finalText) => {
                isFinalized = true;
                try {
                    // If the user explicitly pressed /stop, skip output display entirely
                    const wasStoppedByUser = userStopRequestedChannels.delete(message.channelId);
                    if (wasStoppedByUser) {
                        logger_1.logger.info(`[sendPromptToAntigravity:${monitorTraceId}] Stopped by user — skipping output`);
                        await clearWatchingReaction();
                        await message.react('⏹️').catch(() => { });
                        return;
                    }
                    try {
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        const isQuotaError = monitor.getPhase() === 'quotaReached' || monitor.getQuotaDetected();
                        // Quota early exit — skip text extraction, output logging, and embed entirely
                        if (isQuotaError) {
                            const finalLogText = lastActivityLogText || processLogBuffer.snapshot();
                            if (finalLogText && finalLogText.trim().length > 0) {
                                logger_1.logger.divider('Process Log');
                                console.info(finalLogText);
                            }
                            logger_1.logger.divider();
                            liveActivityUpdateVersion += 1;
                            await upsertLiveActivityEmbeds(`${PHASE_ICONS.thinking} Process Log`, finalLogText || ACTIVITY_PLACEHOLDER, PHASE_COLORS.thinking, (0, i18n_1.t)(`⏱️ Time: ${elapsed}s | Process log`), {
                                source: 'complete',
                                expectedVersion: liveActivityUpdateVersion,
                            });
                            liveResponseUpdateVersion += 1;
                            await upsertLiveResponseEmbeds('⚠️ Model Quota Reached', 'Model quota limit reached. Please wait or switch to a different model.', 0xFF6B6B, (0, i18n_1.t)(`⏱️ Time: ${elapsed}s | Quota Reached`), {
                                source: 'complete',
                                expectedVersion: liveResponseUpdateVersion,
                            });
                            try {
                                const modelsPayload = await (0, modelsUi_1.buildModelsUI)(cdp, () => bridge.quota.fetchQuota());
                                if (modelsPayload && channel) {
                                    await channel.send({ ...modelsPayload });
                                }
                            }
                            catch (e) {
                                logger_1.logger.error('[Quota] Failed to send model selection UI:', e);
                            }
                            await clearWatchingReaction();
                            await message.react('⚠️').catch(() => { });
                            return;
                        }
                        // Normal path — extract final text
                        const responseText = (finalText && finalText.trim().length > 0)
                            ? finalText
                            : lastProgressText;
                        const emergencyText = (!responseText || responseText.trim().length === 0)
                            ? await tryEmergencyExtractText()
                            : '';
                        const finalResponseText = responseText && responseText.trim().length > 0
                            ? responseText
                            : emergencyText;
                        const separated = (0, discordFormatter_1.splitOutputAndLogs)(finalResponseText);
                        const finalOutputText = separated.output || finalResponseText;
                        // Process logs are now collected by onProcessLog callback directly;
                        // sanitizeActivityLines is NOT applied because it would strip the very
                        // content we want to display (activity messages, tool names, etc.)
                        const finalLogText = lastActivityLogText || processLogBuffer.snapshot();
                        if (finalLogText && finalLogText.trim().length > 0) {
                            logger_1.logger.divider('Process Log');
                            console.info(finalLogText);
                        }
                        if (finalOutputText && finalOutputText.trim().length > 0) {
                            logger_1.logger.divider(`Output (${finalOutputText.length} chars)`);
                            console.info(finalOutputText);
                        }
                        logger_1.logger.divider();
                        liveActivityUpdateVersion += 1;
                        const activityVersion = liveActivityUpdateVersion;
                        await upsertLiveActivityEmbeds(`${PHASE_ICONS.thinking} Process Log`, finalLogText || ACTIVITY_PLACEHOLDER, PHASE_COLORS.thinking, (0, i18n_1.t)(`⏱️ Time: ${elapsed}s | Process log`), {
                            source: 'complete',
                            expectedVersion: activityVersion,
                        });
                        liveResponseUpdateVersion += 1;
                        const responseVersion = liveResponseUpdateVersion;
                        if (finalOutputText && finalOutputText.trim().length > 0) {
                            await upsertLiveResponseEmbeds(`${PHASE_ICONS.complete} Final Output`, finalOutputText, PHASE_COLORS.complete, (0, i18n_1.t)(`⏱️ Time: ${elapsed}s | Complete`), {
                                source: 'complete',
                                expectedVersion: responseVersion,
                            });
                        }
                        else {
                            await upsertLiveResponseEmbeds(`${PHASE_ICONS.complete} Complete`, (0, i18n_1.t)('Failed to extract response. Use `/screenshot` to verify.'), PHASE_COLORS.complete, (0, i18n_1.t)(`⏱️ Time: ${elapsed}s | Complete`), {
                                source: 'complete',
                                expectedVersion: responseVersion,
                            });
                        }
                        if (options && message.guild) {
                            try {
                                const sessionInfo = await options.chatSessionService.getCurrentSessionInfo(cdp);
                                if (sessionInfo && sessionInfo.hasActiveChat && sessionInfo.title && sessionInfo.title !== (0, i18n_1.t)('(Untitled)')) {
                                    const session = options.chatSessionRepo.findByChannelId(message.channelId);
                                    const projectName = session
                                        ? bridge.pool.extractProjectName(session.workspacePath)
                                        : cdp.getCurrentWorkspaceName();
                                    if (projectName) {
                                        (0, cdpBridgeManager_1.registerApprovalSessionChannel)(bridge, projectName, sessionInfo.title, (0, wrappers_1.wrapDiscordChannel)(message.channel));
                                    }
                                    const newName = options.titleGenerator.sanitizeForChannelName(sessionInfo.title);
                                    if (session && session.displayName !== sessionInfo.title) {
                                        const formattedName = `${session.sessionNumber}-${newName}`;
                                        await options.channelManager.renameChannel(message.guild, message.channelId, formattedName);
                                        options.chatSessionRepo.updateDisplayName(message.channelId, sessionInfo.title);
                                    }
                                }
                            }
                            catch (e) {
                                logger_1.logger.error('[Rename] Failed to get title from Antigravity and rename:', e);
                            }
                        }
                        await sendGeneratedImages(finalOutputText || '');
                        await clearWatchingReaction();
                        await message.react(finalOutputText && finalOutputText.trim().length > 0 ? '✅' : '⚠️').catch(() => { });
                    }
                    catch (error) {
                        logger_1.logger.error(`[sendPromptToAntigravity:${monitorTraceId}] onComplete failed:`, error);
                    }
                }
                finally {
                    signalCompletion('onComplete');
                }
            },
            onTimeout: async (lastText) => {
                isFinalized = true;
                try {
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    const timeoutText = (lastText && lastText.trim().length > 0)
                        ? lastText
                        : lastProgressText;
                    const separated = (0, discordFormatter_1.splitOutputAndLogs)(timeoutText || '');
                    const sanitizedTimeoutLogs = lastActivityLogText || processLogBuffer.snapshot();
                    const payload = separated.output && separated.output.trim().length > 0
                        ? (0, i18n_1.t)(`${separated.output}\n\n[Monitor Ended] Timeout after 5 minutes.`)
                        : 'Monitor ended after 5 minutes. No text was retrieved.';
                    liveResponseUpdateVersion += 1;
                    const responseVersion = liveResponseUpdateVersion;
                    await upsertLiveResponseEmbeds(`${PHASE_ICONS.timeout} Timeout`, payload, PHASE_COLORS.timeout, `⏱️ Elapsed: ${elapsed}s | Timeout`, {
                        source: 'timeout',
                        expectedVersion: responseVersion,
                    });
                    liveActivityUpdateVersion += 1;
                    const activityVersion = liveActivityUpdateVersion;
                    await upsertLiveActivityEmbeds(`${PHASE_ICONS.thinking} Process Log`, sanitizedTimeoutLogs || ACTIVITY_PLACEHOLDER, PHASE_COLORS.thinking, (0, i18n_1.t)(`⏱️ Time: ${elapsed}s | Process log`), {
                        source: 'timeout',
                        expectedVersion: activityVersion,
                    });
                    await clearWatchingReaction();
                    await message.react('⚠️').catch(() => { });
                }
                catch (error) {
                    logger_1.logger.error(`[sendPromptToAntigravity:${monitorTraceId}] onTimeout failed:`, error);
                }
                finally {
                    signalCompletion('onTimeout');
                }
            },
        });
        await monitor.start();
        // 1-second elapsed timer — updates footer independently of process log events
        const elapsedTimer = setInterval(() => {
            if (isFinalized) {
                clearInterval(elapsedTimer);
                return;
            }
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            liveActivityUpdateVersion += 1;
            const activityVersion = liveActivityUpdateVersion;
            upsertLiveActivityEmbeds(`${PHASE_ICONS.thinking} Process Log`, lastActivityLogText || ACTIVITY_PLACEHOLDER, PHASE_COLORS.thinking, (0, i18n_1.t)(`⏱️ Elapsed: ${elapsed}s | Process log`), {
                source: 'elapsed-tick',
                expectedVersion: activityVersion,
                skipWhenFinalized: true,
            }).catch(() => { });
        }, 1000);
    }
    catch (e) {
        isFinalized = true;
        await sendEmbed(`${PHASE_ICONS.error} Error`, (0, i18n_1.t)(`Error occurred during processing: ${e.message}`), PHASE_COLORS.error);
        await clearWatchingReaction();
        await message.react('❌').catch(() => { });
        signalCompletion('top-level-catch');
    }
}
// =============================================================================
// Bot main entry point
// =============================================================================
const startBot = async (cliLogLevel) => {
    const config = (0, config_1.loadConfig)();
    logger_1.logger.setLogLevel(cliLogLevel ?? config.logLevel);
    const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : 'antigravity.db';
    const db = new better_sqlite3_1.default(dbPath);
    const modeService = new modeService_1.ModeService();
    const modelService = new modelService_1.ModelService();
    const templateRepo = new templateRepository_1.TemplateRepository(db);
    const userPrefRepo = new userPreferenceRepository_1.UserPreferenceRepository(db);
    // Eagerly load default model from DB (single-user bot optimization)
    try {
        const firstUser = db.prepare('SELECT user_id FROM user_preferences LIMIT 1').get();
        if (firstUser) {
            const savedDefault = userPrefRepo.getDefaultModel(firstUser.user_id);
            modelService.loadDefaultModel(savedDefault);
        }
    }
    catch {
        // DB may not have user_preferences yet — safe to ignore
    }
    const workspaceBindingRepo = new workspaceBindingRepository_1.WorkspaceBindingRepository(db);
    const chatSessionRepo = new chatSessionRepository_1.ChatSessionRepository(db);
    const workspaceService = new workspaceService_1.WorkspaceService(config.workspaceBaseDir);
    const channelManager = new channelManager_1.ChannelManager();
    // Auto-launch Antigravity with CDP port if not already running
    await (0, antigravityLauncher_1.ensureAntigravityRunning)();
    // Initialize CDP bridge (lazy connection: pool creation only)
    const bridge = (0, cdpBridgeManager_1.initCdpBridge)(config.autoApproveFileEdits);
    // Initialize CDP-dependent services (constructor CDP dependency removed)
    const chatSessionService = new chatSessionService_1.ChatSessionService();
    const titleGenerator = new titleGeneratorService_1.TitleGeneratorService();
    const promptDispatcher = new promptDispatcher_1.PromptDispatcher({
        bridge,
        modeService,
        modelService,
        sendPromptImpl: sendPromptToAntigravity,
    });
    // Initialize command handlers (joinHandler is created after client, see below)
    const wsHandler = new workspaceCommandHandler_1.WorkspaceCommandHandler(workspaceBindingRepo, chatSessionRepo, workspaceService, channelManager);
    const chatHandler = new chatCommandHandler_1.ChatCommandHandler(chatSessionService, chatSessionRepo, workspaceBindingRepo, channelManager, workspaceService, bridge.pool);
    const cleanupHandler = new cleanupCommandHandler_1.CleanupCommandHandler(chatSessionRepo, workspaceBindingRepo);
    const slashCommandHandler = new slashCommandHandler_1.SlashCommandHandler(templateRepo);
    // Discord platform — only initialise the Discord client when the platform is enabled
    if (config.platforms.includes('discord')) {
        if (!config.discordToken || !config.clientId) {
            logger_1.logger.error('Discord platform enabled but discordToken or clientId is missing. Skipping Discord initialization.');
        }
        else {
            const discordToken = config.discordToken;
            const discordClientId = config.clientId;
            const client = new discord_js_1.Client({
                intents: [
                    discord_js_1.GatewayIntentBits.Guilds,
                    discord_js_1.GatewayIntentBits.GuildMessages,
                    discord_js_1.GatewayIntentBits.MessageContent,
                ]
            });
            const joinHandler = new joinCommandHandler_1.JoinCommandHandler(chatSessionService, chatSessionRepo, workspaceBindingRepo, channelManager, bridge.pool, workspaceService, client, config.extractionMode);
            client.once(discord_js_1.Events.ClientReady, async (readyClient) => {
                logger_1.logger.info(`Ready! Logged in as ${readyClient.user.tag} | extractionMode=${config.extractionMode}`);
                try {
                    await (0, registerSlashCommands_1.registerSlashCommands)(discordToken, discordClientId, config.guildId);
                }
                catch (error) {
                    logger_1.logger.warn('Failed to register slash commands, but text commands remain available.');
                }
                // Startup dashboard embed
                try {
                    const os = await Promise.resolve().then(() => __importStar(require('os')));
                    const pkg = await Promise.resolve().then(() => __importStar(require('../../package.json')));
                    const version = pkg.default?.version ?? pkg.version ?? 'unknown';
                    const projects = workspaceService.scanWorkspaces();
                    // Check CDP connection status
                    const activeWorkspaces = bridge.pool.getActiveWorkspaceNames();
                    const cdpStatus = activeWorkspaces.length > 0
                        ? `Connected (${activeWorkspaces.join(', ')})`
                        : 'Not connected';
                    const dashboardEmbed = new discord_js_1.EmbedBuilder()
                        .setTitle('LazyGravity Online')
                        .setColor(0x57F287)
                        .addFields({ name: 'Version', value: version, inline: true }, { name: 'Node.js', value: process.versions.node, inline: true }, { name: 'OS', value: `${os.platform()} ${os.release()}`, inline: true }, { name: 'CDP', value: cdpStatus, inline: true }, { name: 'Model', value: modelService.getCurrentModel(), inline: true }, { name: 'Mode', value: modeService.getCurrentMode(), inline: true }, { name: 'Projects', value: `${projects.length} registered`, inline: true }, { name: 'Extraction', value: config.extractionMode, inline: true })
                        .setFooter({ text: `Started at ${new Date().toLocaleString()}` })
                        .setTimestamp();
                    // Send to the first available text channel in the guild
                    const guild = readyClient.guilds.cache.first();
                    if (guild) {
                        const channel = guild.channels.cache.find((ch) => ch.isTextBased() && !ch.isVoiceBased() && ch.permissionsFor(readyClient.user)?.has('SendMessages'));
                        if (channel && channel.isTextBased()) {
                            await channel.send({ embeds: [dashboardEmbed] });
                            logger_1.logger.info('Startup dashboard embed sent.');
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Failed to send startup dashboard embed:', error);
                }
            });
            // [Discord Interactions API] Slash command interaction handler
            client.on(discord_js_1.Events.InteractionCreate, (0, interactionCreateHandler_1.createInteractionCreateHandler)({
                config,
                bridge,
                cleanupHandler,
                modeService,
                modelService,
                slashCommandHandler,
                wsHandler,
                chatHandler,
                client,
                sendModeUI: modeUi_1.sendModeUI,
                sendModelsUI: modelsUi_1.sendModelsUI,
                sendAutoAcceptUI: autoAcceptUi_1.sendAutoAcceptUI,
                getCurrentCdp: cdpBridgeManager_1.getCurrentCdp,
                parseApprovalCustomId: cdpBridgeManager_1.parseApprovalCustomId,
                parseErrorPopupCustomId: cdpBridgeManager_1.parseErrorPopupCustomId,
                parsePlanningCustomId: cdpBridgeManager_1.parsePlanningCustomId,
                parseRunCommandCustomId: cdpBridgeManager_1.parseRunCommandCustomId,
                joinHandler,
                userPrefRepo,
                handleSlashInteraction: async (interaction, handler, bridgeArg, wsHandlerArg, chatHandlerArg, cleanupHandlerArg, modeServiceArg, modelServiceArg, autoAcceptServiceArg, clientArg) => handleSlashInteraction(interaction, handler, bridgeArg, wsHandlerArg, chatHandlerArg, cleanupHandlerArg, modeServiceArg, modelServiceArg, autoAcceptServiceArg, clientArg, promptDispatcher, templateRepo, joinHandler, userPrefRepo),
                handleTemplateUse: async (interaction, templateId) => {
                    const template = templateRepo.findById(templateId);
                    if (!template) {
                        await interaction.followUp({
                            content: 'Template not found. It may have been deleted.',
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        });
                        return;
                    }
                    // Resolve CDP via workspace binding (same flow as text messages)
                    const channelId = interaction.channelId;
                    const workspacePath = wsHandler.getWorkspaceForChannel(channelId);
                    let cdp = null;
                    if (workspacePath) {
                        try {
                            cdp = await bridge.pool.getOrConnect(workspacePath);
                            const projectName = bridge.pool.extractProjectName(workspacePath);
                            bridge.lastActiveWorkspace = projectName;
                            const platformCh = (0, wrappers_1.wrapDiscordChannel)(interaction.channel);
                            bridge.lastActiveChannel = platformCh;
                            (0, cdpBridgeManager_1.registerApprovalWorkspaceChannel)(bridge, projectName, platformCh);
                            const session = chatSessionRepo.findByChannelId(channelId);
                            if (session?.displayName) {
                                (0, cdpBridgeManager_1.registerApprovalSessionChannel)(bridge, projectName, session.displayName, platformCh);
                            }
                            (0, cdpBridgeManager_1.ensureApprovalDetector)(bridge, cdp, projectName);
                            (0, cdpBridgeManager_1.ensureErrorPopupDetector)(bridge, cdp, projectName);
                            (0, cdpBridgeManager_1.ensurePlanningDetector)(bridge, cdp, projectName);
                            (0, cdpBridgeManager_1.ensureRunCommandDetector)(bridge, cdp, projectName);
                        }
                        catch (e) {
                            await interaction.followUp({
                                content: `Failed to connect to workspace: ${e.message}`,
                                flags: discord_js_1.MessageFlags.Ephemeral,
                            });
                            return;
                        }
                    }
                    else {
                        cdp = (0, cdpBridgeManager_1.getCurrentCdp)(bridge);
                    }
                    if (!cdp) {
                        await interaction.followUp({
                            content: 'Not connected to CDP. Please connect to a project first.',
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        });
                        return;
                    }
                    const followUp = await interaction.followUp({
                        content: `Executing template **${template.name}**...`,
                    });
                    if (followUp instanceof discord_js_1.Message) {
                        await promptDispatcher.send({
                            message: followUp,
                            prompt: template.prompt,
                            cdp,
                            inboundImages: [],
                            options: {
                                chatSessionService,
                                chatSessionRepo,
                                channelManager,
                                titleGenerator,
                                userPrefRepo,
                                extractionMode: config.extractionMode,
                            },
                        });
                    }
                },
            }));
            // [Text message handler]
            client.on(discord_js_1.Events.MessageCreate, (0, messageCreateHandler_1.createMessageCreateHandler)({
                config,
                bridge,
                modeService,
                modelService,
                slashCommandHandler,
                wsHandler,
                chatSessionService,
                chatSessionRepo,
                channelManager,
                titleGenerator,
                client,
                sendPromptToAntigravity: async (_bridge, message, prompt, cdp, _modeService, _modelService, inboundImages = [], options) => promptDispatcher.send({
                    message,
                    prompt,
                    cdp,
                    inboundImages,
                    options,
                }),
                autoRenameChannel,
                handleScreenshot: screenshotUi_1.handleScreenshot,
                userPrefRepo,
            }));
            await client.login(discordToken);
        } // end: else (credentials present)
    } // end: Discord platform gate
    // Telegram platform
    if (config.platforms.includes('telegram') && config.telegramToken) {
        try {
            const telegramBot = new grammy_1.Bot(config.telegramToken);
            // Attach toInputFile so wrappers can convert Buffer to grammY InputFile
            telegramBot.toInputFile = (data, filename) => new grammy_1.InputFile(data, filename);
            // Retry getMe() up to 3 times to handle transient network failures
            const botInfo = await (async () => {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        return await telegramBot.api.getMe();
                    }
                    catch (err) {
                        if (attempt === 3)
                            throw err;
                        logger_1.logger.warn(`[Telegram] getMe() failed (attempt ${attempt}/3): ${err?.message ?? err}. Retrying in 3s...`);
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
                throw new Error('getMe() failed after 3 attempts');
            })();
            const telegramBindingRepo = new telegramBindingRepository_1.TelegramBindingRepository(db);
            const telegramAdapter = new telegramAdapter_1.TelegramAdapter(telegramBot, String(botInfo.id));
            const activeMonitors = new Map();
            const telegramHandler = (0, telegramMessageHandler_1.createTelegramMessageHandler)({
                bridge,
                telegramBindingRepo,
                workspaceService,
                modeService,
                modelService,
                extractionMode: config.extractionMode,
                templateRepo,
                fetchQuota: () => bridge.quota.fetchQuota(),
                activeMonitors,
                botToken: config.telegramToken,
                botApi: telegramBot.api,
                chatSessionService,
            });
            // Compose select handlers: project select + mode select
            const projectSelectHandler = (0, telegramProjectCommand_1.createTelegramSelectHandler)({
                workspaceService,
                telegramBindingRepo,
            });
            const modeSelectAction = (0, modeSelectAction_1.createModeSelectAction)({ bridge, modeService });
            const telegramSelectHandler = (0, selectHandler_1.createPlatformSelectHandler)({
                actions: [
                    modeSelectAction,
                ],
            });
            // Composite handler that routes to the right handler
            const compositeSelectHandler = async (interaction) => {
                if (interaction.customId === 'mode_select') {
                    await telegramSelectHandler(interaction);
                    return;
                }
                await projectSelectHandler(interaction);
            };
            const allowedUsers = new Map();
            if (config.telegramAllowedUserIds && config.telegramAllowedUserIds.length > 0) {
                allowedUsers.set('telegram', new Set(config.telegramAllowedUserIds));
            }
            else {
                logger_1.logger.warn('Telegram platform enabled but TELEGRAM_ALLOWED_USER_IDS is empty — all users will be denied access.');
            }
            const telegramButtonHandler = (0, buttonHandler_1.createPlatformButtonHandler)({
                actions: [
                    (0, approvalButtonAction_1.createApprovalButtonAction)({ bridge }),
                    (0, planningButtonAction_1.createPlanningButtonAction)({ bridge }),
                    (0, errorPopupButtonAction_1.createErrorPopupButtonAction)({ bridge }),
                    (0, runCommandButtonAction_1.createRunCommandButtonAction)({ bridge }),
                    (0, modelButtonAction_1.createModelButtonAction)({ bridge, fetchQuota: () => bridge.quota.fetchQuota(), modelService, userPrefRepo }),
                    (0, autoAcceptButtonAction_1.createAutoAcceptButtonAction)({ autoAcceptService: bridge.autoAccept }),
                    (0, templateButtonAction_1.createTemplateButtonAction)({ bridge, templateRepo }),
                ],
            });
            const eventRouter = new eventRouter_1.EventRouter({ allowedUsers }, {
                onMessage: telegramHandler,
                onButtonInteraction: telegramButtonHandler,
                onSelectInteraction: compositeSelectHandler,
            });
            // Register bot commands BEFORE starting polling so Telegram shows "/" suggestions
            await telegramBot.api.setMyCommands([
                { command: 'start', description: 'Welcome message' },
                { command: 'project', description: 'Manage workspace bindings' },
                { command: 'status', description: 'Show bot status and connections' },
                { command: 'mode', description: 'Switch execution mode' },
                { command: 'model', description: 'Switch LLM model' },
                { command: 'screenshot', description: 'Capture Antigravity screenshot' },
                { command: 'autoaccept', description: 'Toggle auto-accept mode' },
                { command: 'template', description: 'List prompt templates' },
                { command: 'template_add', description: 'Add a prompt template' },
                { command: 'template_delete', description: 'Delete a prompt template' },
                { command: 'project_create', description: 'Create a new workspace' },
                { command: 'new', description: 'Start a new chat session' },
                { command: 'logs', description: 'Show recent log entries' },
                { command: 'stop', description: 'Interrupt active LLM generation' },
                { command: 'help', description: 'Show available commands' },
                { command: 'ping', description: 'Check bot latency' },
            ]).catch((e) => {
                logger_1.logger.warn('Failed to register Telegram commands:', e instanceof Error ? e.message : e);
            });
            eventRouter.registerAdapter(telegramAdapter);
            await eventRouter.startAll();
            logger_1.logger.info(`Telegram bot started: @${botInfo.username} (${config.telegramAllowedUserIds?.length ?? 0} allowed users)`);
            // Send startup message to all bound Telegram chats
            const bindings = telegramBindingRepo.findAll();
            if (bindings.length > 0) {
                const os = await Promise.resolve().then(() => __importStar(require('os')));
                const pkg = await Promise.resolve().then(() => __importStar(require('../../package.json')));
                const version = pkg.default?.version ?? pkg.version ?? 'unknown';
                const projects = workspaceService.scanWorkspaces();
                const activeWorkspaces = bridge.pool.getActiveWorkspaceNames();
                const cdpStatus = activeWorkspaces.length > 0
                    ? `Connected (${activeWorkspaces.join(', ')})`
                    : 'Not connected';
                const startupText = [
                    '<b>LazyGravity Online</b>',
                    '',
                    `Version: ${version}`,
                    `Node.js: ${process.versions.node}`,
                    `OS: ${os.platform()} ${os.release()}`,
                    `CDP: ${cdpStatus}`,
                    `Model: ${modelService.getCurrentModel()}`,
                    `Mode: ${modeService.getCurrentMode()}`,
                    `Projects: ${projects.length} registered`,
                    `Extraction: ${config.extractionMode}`,
                    '',
                    `<i>Started at ${new Date().toLocaleString()}</i>`,
                ].join('\n');
                const sendWithRetry = async (chatId, text, retries = 3, delayMs = 2000) => {
                    for (let attempt = 1; attempt <= retries; attempt++) {
                        try {
                            await telegramBot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
                            return;
                        }
                        catch (err) {
                            if (attempt < retries) {
                                logger_1.logger.debug(`[Telegram] Startup message attempt ${attempt}/${retries} failed, retrying in ${delayMs}ms...`);
                                await new Promise((r) => setTimeout(r, delayMs));
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                };
                const results = await Promise.allSettled(bindings.map((binding) => sendWithRetry(binding.chatId, startupText)));
                const failed = results.filter((r) => r.status === 'rejected');
                if (failed.length > 0) {
                    logger_1.logger.warn(`[Telegram] Startup message failed for ${failed.length}/${bindings.length} chat(s) after retries: ${failed[0].reason?.message ?? 'unknown error'}`);
                }
                else {
                    logger_1.logger.info(`Telegram startup message sent to ${bindings.length} bound chat(s).`);
                }
            }
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger_1.logger.error('Failed to start Telegram adapter:', message);
        }
    }
};
exports.startBot = startBot;
/**
 * Auto-rename channel on first message send
 */
async function autoRenameChannel(message, chatSessionRepo, titleGenerator, channelManager, cdp) {
    const session = chatSessionRepo.findByChannelId(message.channelId);
    if (!session || session.isRenamed)
        return;
    const guild = message.guild;
    if (!guild)
        return;
    try {
        const title = await titleGenerator.generateTitle(message.content, cdp);
        const newName = `${session.sessionNumber}-${title}`;
        await channelManager.renameChannel(guild, message.channelId, newName);
        chatSessionRepo.updateDisplayName(message.channelId, title);
    }
    catch (err) {
        logger_1.logger.error('[AutoRename] Rename failed:', err);
    }
}
/**
 * Handle Discord Interactions API slash commands
 */
async function handleSlashInteraction(interaction, handler, bridge, wsHandler, chatHandler, cleanupHandler, modeService, modelService, autoAcceptService, _client, promptDispatcher, templateRepo, joinHandler, userPrefRepo) {
    const commandName = interaction.commandName;
    switch (commandName) {
        case 'help': {
            const helpFields = [
                {
                    name: '💬 Chat', value: [
                        '`/new` — Start a new chat session',
                        '`/chat` — Show current session info + list',
                    ].join('\n')
                },
                {
                    name: '🔗 Session', value: [
                        '`/join` — Join an existing Antigravity session',
                        '`/mirror` — Toggle PC→Discord mirroring ON/OFF',
                    ].join('\n')
                },
                {
                    name: '⏹️ Control', value: [
                        '`/stop` — Interrupt active LLM generation',
                        '`/screenshot` — Capture Antigravity screen',
                    ].join('\n')
                },
                {
                    name: '⚙️ Settings', value: [
                        '`/mode` — Display and change execution mode',
                        '`/model [name]` — Display and change LLM model',
                        '`/output [format]` — Toggle Embed / Plain Text output',
                    ].join('\n')
                },
                {
                    name: '📁 Projects', value: [
                        '`/project` — Display project list',
                        '`/project create <name>` — Create a new project',
                    ].join('\n')
                },
                {
                    name: '📝 Templates', value: [
                        '`/template list` — Show templates with execute buttons (click to run)',
                        '`/template add <name> <prompt>` — Register a template',
                        '`/template delete <name>` — Delete a template',
                    ].join('\n')
                },
                {
                    name: '🔧 System', value: [
                        '`/status` — Display overall bot status',
                        '`/autoaccept` — Toggle auto-approve mode for approval dialogs via buttons',
                        '`/logs [lines] [level]` — View recent bot logs',
                        '`/cleanup [days]` — Clean up unused channels/categories',
                        '`/help` — Show this help',
                    ].join('\n')
                },
            ];
            const helpOutputFormat = userPrefRepo?.getOutputFormat(interaction.user.id) ?? 'embed';
            if (helpOutputFormat === 'plain') {
                const chunks = (0, plainTextFormatter_1.formatAsPlainText)({
                    title: '📖 LazyGravity Commands',
                    description: 'Commands for controlling Antigravity from Discord.',
                    fields: helpFields,
                    footerText: 'Text messages are sent directly to Antigravity',
                });
                await interaction.editReply({ content: chunks[0] });
                break;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📖 LazyGravity Commands')
                .setColor(0x5865F2)
                .setDescription('Commands for controlling Antigravity from Discord.')
                .addFields(...helpFields)
                .setFooter({ text: 'Text messages are sent directly to Antigravity' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            break;
        }
        case 'mode': {
            await (0, modeUi_1.sendModeUI)(interaction, modeService, { getCurrentCdp: () => (0, cdpBridgeManager_1.getCurrentCdp)(bridge) });
            break;
        }
        case 'model': {
            const modelName = interaction.options.getString('name');
            if (!modelName) {
                await (0, modelsUi_1.sendModelsUI)(interaction, {
                    getCurrentCdp: () => (0, cdpBridgeManager_1.getCurrentCdp)(bridge),
                    fetchQuota: async () => bridge.quota.fetchQuota(),
                });
            }
            else {
                const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(bridge);
                if (!cdp) {
                    await interaction.editReply({ content: 'Not connected to CDP.' });
                    break;
                }
                const res = await cdp.setUiModel(modelName);
                if (res.ok) {
                    await interaction.editReply({ content: `Model changed to **${res.model}**.` });
                }
                else {
                    await interaction.editReply({ content: res.error || 'Failed to change model.' });
                }
            }
            break;
        }
        case 'template': {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'list') {
                const templates = templateRepo.findAll();
                await (0, templateUi_1.sendTemplateUI)(interaction, templates);
                break;
            }
            let args;
            switch (subcommand) {
                case 'add': {
                    const name = interaction.options.getString('name', true);
                    const prompt = interaction.options.getString('prompt', true);
                    args = ['add', name, prompt];
                    break;
                }
                case 'delete': {
                    const name = interaction.options.getString('name', true);
                    args = ['delete', name];
                    break;
                }
                default:
                    args = [];
            }
            const result = await handler.handleCommand('template', args);
            await interaction.editReply({ content: result.message });
            break;
        }
        case 'status': {
            const activeNames = bridge.pool.getActiveWorkspaceNames();
            const currentModel = (() => {
                const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(bridge);
                return cdp ? 'CDP Connected' : 'Disconnected';
            })();
            const currentMode = modeService.getCurrentMode();
            const mirroringWorkspaces = activeNames.filter((name) => bridge.pool.getUserMessageDetector(name)?.isActive());
            const mirrorStatus = mirroringWorkspaces.length > 0
                ? `📡 ON (${mirroringWorkspaces.join(', ')})`
                : '⚪ OFF';
            const statusFields = [
                { name: 'CDP Connection', value: activeNames.length > 0 ? `🟢 ${activeNames.length} project(s) connected` : '⚪ Disconnected', inline: true },
                { name: 'Mode', value: modeService_1.MODE_DISPLAY_NAMES[currentMode] || currentMode, inline: true },
                { name: 'Auto Approve', value: autoAcceptService.isEnabled() ? '🟢 ON' : '⚪ OFF', inline: true },
                { name: 'Mirroring', value: mirrorStatus, inline: true },
            ];
            let statusDescription = '';
            if (activeNames.length > 0) {
                const lines = activeNames.map((name) => {
                    const cdp = bridge.pool.getConnected(name);
                    const contexts = cdp ? cdp.getContexts().length : 0;
                    const detectorActive = bridge.pool.getApprovalDetector(name)?.isActive() ? ' [Detecting]' : '';
                    const mirrorActive = bridge.pool.getUserMessageDetector(name)?.isActive() ? ' [Mirror]' : '';
                    return `• **${name}** — Contexts: ${contexts}${detectorActive}${mirrorActive}`;
                });
                statusDescription = `**Connected Projects:**\n${lines.join('\n')}`;
            }
            else {
                statusDescription = 'Send a message to auto-connect to a project.';
            }
            const statusOutputFormat = userPrefRepo?.getOutputFormat(interaction.user.id) ?? 'embed';
            if (statusOutputFormat === 'plain') {
                const chunks = (0, plainTextFormatter_1.formatAsPlainText)({
                    title: '🔧 Bot Status',
                    description: statusDescription,
                    fields: statusFields,
                });
                await interaction.editReply({ content: chunks[0] });
                break;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🔧 Bot Status')
                .setColor(activeNames.length > 0 ? 0x00CC88 : 0x888888)
                .addFields(...statusFields)
                .setDescription(statusDescription)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            break;
        }
        case 'autoaccept': {
            const requestedMode = interaction.options.getString('mode');
            if (!requestedMode) {
                await (0, autoAcceptUi_1.sendAutoAcceptUI)(interaction, autoAcceptService);
                break;
            }
            const result = autoAcceptService.handle(requestedMode);
            await interaction.editReply({ content: result.message });
            break;
        }
        case 'output': {
            if (!userPrefRepo) {
                await interaction.editReply({ content: 'Output preference service not available.' });
                break;
            }
            const requestedFormat = interaction.options.getString('format');
            if (!requestedFormat) {
                const currentFormat = userPrefRepo.getOutputFormat(interaction.user.id);
                await (0, outputUi_1.sendOutputUI)(interaction, currentFormat);
                break;
            }
            const format = requestedFormat === 'plain' ? 'plain' : 'embed';
            userPrefRepo.setOutputFormat(interaction.user.id, format);
            const label = format === 'plain' ? 'Plain Text' : 'Embed';
            await interaction.editReply({ content: `Output format changed to **${label}**.` });
            break;
        }
        case 'screenshot': {
            await (0, screenshotUi_1.handleScreenshot)(interaction, (0, cdpBridgeManager_1.getCurrentCdp)(bridge));
            break;
        }
        case 'stop': {
            const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(bridge);
            if (!cdp) {
                await interaction.editReply({ content: '⚠️ Not connected to CDP. Please connect to a project first.' });
                break;
            }
            try {
                const contextId = cdp.getPrimaryContextId();
                const callParams = {
                    expression: responseMonitor_1.RESPONSE_SELECTORS.CLICK_STOP_BUTTON,
                    returnByValue: true,
                    awaitPromise: false,
                };
                if (contextId !== null) {
                    callParams.contextId = contextId;
                }
                const result = await cdp.call('Runtime.evaluate', callParams);
                const value = result?.result?.value;
                if (value?.ok) {
                    userStopRequestedChannels.add(interaction.channelId);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('⏹️ Generation Interrupted')
                        .setDescription('AI response generation was safely stopped.')
                        .setColor(0xE74C3C)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                }
                else {
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('⚠️ Could Not Stop')
                        .setDescription(value?.error || 'Stop button not found. The LLM may not be running.')
                        .setColor(0xF39C12)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                }
            }
            catch (e) {
                await interaction.editReply({ content: `❌ Error during stop processing: ${e.message}` });
            }
            break;
        }
        case 'project': {
            const wsSub = interaction.options.getSubcommand(false);
            if (wsSub === 'create') {
                if (!interaction.guild) {
                    await interaction.editReply({ content: 'This command can only be used in a server.' });
                    break;
                }
                await wsHandler.handleCreate(interaction, interaction.guild);
            }
            else {
                // /project list or /project (default)
                await wsHandler.handleShow(interaction);
            }
            break;
        }
        case 'new': {
            await chatHandler.handleNew(interaction);
            break;
        }
        case 'chat': {
            await chatHandler.handleChat(interaction);
            break;
        }
        case 'join': {
            if (joinHandler) {
                await joinHandler.handleJoin(interaction, bridge);
            }
            else {
                await interaction.editReply({ content: (0, i18n_1.t)('⚠️ Join handler not available.') });
            }
            break;
        }
        case 'mirror': {
            if (joinHandler) {
                await joinHandler.handleMirror(interaction, bridge);
            }
            else {
                await interaction.editReply({ content: (0, i18n_1.t)('⚠️ Mirror handler not available.') });
            }
            break;
        }
        case 'cleanup': {
            await cleanupHandler.handleCleanup(interaction);
            break;
        }
        case 'ping': {
            const apiLatency = interaction.client.ws.ping;
            await interaction.editReply({ content: `🏓 Pong! API Latency is **${apiLatency}ms**.` });
            break;
        }
        case 'logs': {
            const lines = interaction.options.getInteger('lines') ?? 50;
            const level = interaction.options.getString('level');
            const entries = logBuffer_1.logBuffer.getRecent(lines, level ?? undefined);
            if (entries.length === 0) {
                await interaction.editReply({ content: 'No log entries found.' });
                break;
            }
            const formatted = entries
                .map((e) => `${e.timestamp.slice(11, 19)} ${e.message}`)
                .join('\n');
            const MAX_CONTENT = 1900;
            const codeBlock = formatted.length <= MAX_CONTENT
                ? `\`\`\`\n${formatted}\n\`\`\``
                : `\`\`\`\n${formatted.slice(0, MAX_CONTENT)}\n\`\`\`\n(truncated — showing ${MAX_CONTENT} chars of ${formatted.length})`;
            await interaction.editReply({ content: codeBlock });
            break;
        }
        default:
            await interaction.editReply({
                content: `Unknown command: /${commandName}`,
            });
    }
}
