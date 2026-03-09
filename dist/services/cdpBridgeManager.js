"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentChatTitle = getCurrentChatTitle;
exports.registerApprovalWorkspaceChannel = registerApprovalWorkspaceChannel;
exports.registerApprovalSessionChannel = registerApprovalSessionChannel;
exports.resolveApprovalChannelForCurrentChat = resolveApprovalChannelForCurrentChat;
exports.buildApprovalCustomId = buildApprovalCustomId;
exports.parseApprovalCustomId = parseApprovalCustomId;
exports.buildPlanningCustomId = buildPlanningCustomId;
exports.parsePlanningCustomId = parsePlanningCustomId;
exports.buildErrorPopupCustomId = buildErrorPopupCustomId;
exports.parseErrorPopupCustomId = parseErrorPopupCustomId;
exports.buildRunCommandCustomId = buildRunCommandCustomId;
exports.parseRunCommandCustomId = parseRunCommandCustomId;
exports.initCdpBridge = initCdpBridge;
exports.getCurrentCdp = getCurrentCdp;
exports.ensureApprovalDetector = ensureApprovalDetector;
exports.ensurePlanningDetector = ensurePlanningDetector;
exports.ensureErrorPopupDetector = ensureErrorPopupDetector;
exports.ensureRunCommandDetector = ensureRunCommandDetector;
exports.ensureUserMessageDetector = ensureUserMessageDetector;
const i18n_1 = require("../utils/i18n");
const logger_1 = require("../utils/logger");
const notificationSender_1 = require("./notificationSender");
const approvalDetector_1 = require("./approvalDetector");
const autoAcceptService_1 = require("./autoAcceptService");
const cdpConnectionPool_1 = require("./cdpConnectionPool");
const errorPopupDetector_1 = require("./errorPopupDetector");
const planningDetector_1 = require("./planningDetector");
const runCommandDetector_1 = require("./runCommandDetector");
const quotaService_1 = require("./quotaService");
const userMessageDetector_1 = require("./userMessageDetector");
const APPROVE_ACTION_PREFIX = 'approve_action';
const ALWAYS_ALLOW_ACTION_PREFIX = 'always_allow_action';
const DENY_ACTION_PREFIX = 'deny_action';
const PLANNING_OPEN_ACTION_PREFIX = 'planning_open_action';
const PLANNING_PROCEED_ACTION_PREFIX = 'planning_proceed_action';
const ERROR_POPUP_DISMISS_ACTION_PREFIX = 'error_popup_dismiss_action';
const ERROR_POPUP_COPY_DEBUG_ACTION_PREFIX = 'error_popup_copy_debug_action';
const ERROR_POPUP_RETRY_ACTION_PREFIX = 'error_popup_retry_action';
const RUN_COMMAND_RUN_ACTION_PREFIX = 'run_command_run_action';
const RUN_COMMAND_REJECT_ACTION_PREFIX = 'run_command_reject_action';
function normalizeSessionTitle(title) {
    return title.trim().toLowerCase();
}
function buildSessionRouteKey(projectName, sessionTitle) {
    return `${projectName}::${normalizeSessionTitle(sessionTitle)}`;
}
const GET_CURRENT_CHAT_TITLE_SCRIPT = `(() => {
    const panel = document.querySelector('.antigravity-agent-side-panel');
    if (!panel) return '';
    const header = panel.querySelector('div[class*="border-b"]');
    if (!header) return '';
    const titleEl = header.querySelector('div[class*="text-ellipsis"]');
    const title = titleEl ? (titleEl.textContent || '').trim() : '';
    if (!title || title === 'Agent') return '';
    return title;
})()`;
async function getCurrentChatTitle(cdp) {
    const contexts = cdp.getContexts();
    for (const ctx of contexts) {
        try {
            const result = await cdp.call('Runtime.evaluate', {
                expression: GET_CURRENT_CHAT_TITLE_SCRIPT,
                returnByValue: true,
                contextId: ctx.id,
            });
            const value = result?.result?.value;
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
        catch {
            // Continue to next context
        }
    }
    return null;
}
function registerApprovalWorkspaceChannel(bridge, projectName, channel) {
    bridge.approvalChannelByWorkspace.set(projectName, channel);
}
function registerApprovalSessionChannel(bridge, projectName, sessionTitle, channel) {
    if (!sessionTitle || sessionTitle.trim().length === 0)
        return;
    bridge.approvalChannelBySession.set(buildSessionRouteKey(projectName, sessionTitle), channel);
    bridge.approvalChannelByWorkspace.set(projectName, channel);
}
function resolveApprovalChannelForCurrentChat(bridge, projectName, currentChatTitle) {
    // Try session-level match first (most precise routing)
    if (currentChatTitle && currentChatTitle.trim().length > 0) {
        const key = buildSessionRouteKey(projectName, currentChatTitle);
        const sessionChannel = bridge.approvalChannelBySession.get(key);
        if (sessionChannel)
            return sessionChannel;
    }
    // Fall back to workspace-level routing
    return bridge.approvalChannelByWorkspace.get(projectName) ?? null;
}
function buildApprovalCustomId(action, projectName, channelId) {
    const prefix = action === 'approve'
        ? APPROVE_ACTION_PREFIX
        : action === 'always_allow'
            ? ALWAYS_ALLOW_ACTION_PREFIX
            : DENY_ACTION_PREFIX;
    if (channelId && channelId.trim().length > 0) {
        return `${prefix}:${projectName}:${channelId}`;
    }
    return `${prefix}:${projectName}`;
}
function parseApprovalCustomId(customId) {
    if (customId === APPROVE_ACTION_PREFIX) {
        return { action: 'approve', projectName: null, channelId: null };
    }
    if (customId === ALWAYS_ALLOW_ACTION_PREFIX) {
        return { action: 'always_allow', projectName: null, channelId: null };
    }
    if (customId === DENY_ACTION_PREFIX) {
        return { action: 'deny', projectName: null, channelId: null };
    }
    if (customId.startsWith(`${APPROVE_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${APPROVE_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'approve', projectName: projectName || null, channelId: channelId || null };
    }
    if (customId.startsWith(`${ALWAYS_ALLOW_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${ALWAYS_ALLOW_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'always_allow', projectName: projectName || null, channelId: channelId || null };
    }
    if (customId.startsWith(`${DENY_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${DENY_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'deny', projectName: projectName || null, channelId: channelId || null };
    }
    return null;
}
function buildPlanningCustomId(action, projectName, channelId) {
    const prefix = action === 'open'
        ? PLANNING_OPEN_ACTION_PREFIX
        : PLANNING_PROCEED_ACTION_PREFIX;
    if (channelId && channelId.trim().length > 0) {
        return `${prefix}:${projectName}:${channelId}`;
    }
    return `${prefix}:${projectName}`;
}
function parsePlanningCustomId(customId) {
    if (customId === PLANNING_OPEN_ACTION_PREFIX) {
        return { action: 'open', projectName: null, channelId: null };
    }
    if (customId === PLANNING_PROCEED_ACTION_PREFIX) {
        return { action: 'proceed', projectName: null, channelId: null };
    }
    if (customId.startsWith(`${PLANNING_OPEN_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${PLANNING_OPEN_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'open', projectName: projectName || null, channelId: channelId || null };
    }
    if (customId.startsWith(`${PLANNING_PROCEED_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${PLANNING_PROCEED_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'proceed', projectName: projectName || null, channelId: channelId || null };
    }
    return null;
}
function buildErrorPopupCustomId(action, projectName, channelId) {
    const prefix = action === 'dismiss'
        ? ERROR_POPUP_DISMISS_ACTION_PREFIX
        : action === 'copy_debug'
            ? ERROR_POPUP_COPY_DEBUG_ACTION_PREFIX
            : ERROR_POPUP_RETRY_ACTION_PREFIX;
    if (channelId && channelId.trim().length > 0) {
        return `${prefix}:${projectName}:${channelId}`;
    }
    return `${prefix}:${projectName}`;
}
function parseErrorPopupCustomId(customId) {
    if (customId === ERROR_POPUP_DISMISS_ACTION_PREFIX) {
        return { action: 'dismiss', projectName: null, channelId: null };
    }
    if (customId === ERROR_POPUP_COPY_DEBUG_ACTION_PREFIX) {
        return { action: 'copy_debug', projectName: null, channelId: null };
    }
    if (customId === ERROR_POPUP_RETRY_ACTION_PREFIX) {
        return { action: 'retry', projectName: null, channelId: null };
    }
    if (customId.startsWith(`${ERROR_POPUP_DISMISS_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${ERROR_POPUP_DISMISS_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'dismiss', projectName: projectName || null, channelId: channelId || null };
    }
    if (customId.startsWith(`${ERROR_POPUP_COPY_DEBUG_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${ERROR_POPUP_COPY_DEBUG_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'copy_debug', projectName: projectName || null, channelId: channelId || null };
    }
    if (customId.startsWith(`${ERROR_POPUP_RETRY_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${ERROR_POPUP_RETRY_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'retry', projectName: projectName || null, channelId: channelId || null };
    }
    return null;
}
function buildRunCommandCustomId(action, projectName, channelId) {
    const prefix = action === 'run'
        ? RUN_COMMAND_RUN_ACTION_PREFIX
        : RUN_COMMAND_REJECT_ACTION_PREFIX;
    if (channelId && channelId.trim().length > 0) {
        return `${prefix}:${projectName}:${channelId}`;
    }
    return `${prefix}:${projectName}`;
}
function parseRunCommandCustomId(customId) {
    if (customId === RUN_COMMAND_RUN_ACTION_PREFIX) {
        return { action: 'run', projectName: null, channelId: null };
    }
    if (customId === RUN_COMMAND_REJECT_ACTION_PREFIX) {
        return { action: 'reject', projectName: null, channelId: null };
    }
    if (customId.startsWith(`${RUN_COMMAND_RUN_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${RUN_COMMAND_RUN_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'run', projectName: projectName || null, channelId: channelId || null };
    }
    if (customId.startsWith(`${RUN_COMMAND_REJECT_ACTION_PREFIX}:`)) {
        const rest = customId.substring(`${RUN_COMMAND_REJECT_ACTION_PREFIX}:`.length);
        const [projectName, channelId] = rest.split(':');
        return { action: 'reject', projectName: projectName || null, channelId: channelId || null };
    }
    return null;
}
/** Initialize the CDP bridge (lazy connection: pool creation only) */
function initCdpBridge(autoApproveDefault) {
    const pool = new cdpConnectionPool_1.CdpConnectionPool({
        cdpCallTimeout: 15000,
        // Keep CDP reconnection lazy: do not reopen windows in background.
        // Reconnection is triggered when the next chat/template message is sent.
        maxReconnectAttempts: 0,
        reconnectDelayMs: 3000,
    });
    const quota = new quotaService_1.QuotaService();
    const autoAccept = new autoAcceptService_1.AutoAcceptService(autoApproveDefault);
    return {
        pool,
        quota,
        autoAccept,
        lastActiveWorkspace: null,
        lastActiveChannel: null,
        approvalChannelByWorkspace: new Map(),
        approvalChannelBySession: new Map(),
    };
}
/**
 * Helper to get the currently active CdpService from lastActiveWorkspace.
 * Used in contexts where the workspace path is not explicitly provided,
 * such as button interactions and model/mode switching.
 */
function getCurrentCdp(bridge) {
    if (!bridge.lastActiveWorkspace)
        return null;
    return bridge.pool.getConnected(bridge.lastActiveWorkspace);
}
/**
 * Helper to start an approval detector for each workspace.
 * Does nothing if a detector for the same workspace is already running.
 */
function ensureApprovalDetector(bridge, cdp, projectName) {
    const existing = bridge.pool.getApprovalDetector(projectName);
    if (existing && existing.isActive())
        return;
    // Track the most recent notification for auto-disable on resolve.
    // Only the latest is tracked; if a new detection fires before the previous
    // is resolved, the older reference is overwritten. This is acceptable because
    // the detector's lastDetectedKey deduplication prevents rapid successive notifications.
    let lastNotification = null;
    const detector = new approvalDetector_1.ApprovalDetector({
        cdpService: cdp,
        pollIntervalMs: 2000,
        onResolved: () => {
            if (!lastNotification)
                return;
            const { sent, payload } = lastNotification;
            lastNotification = null;
            const resolved = (0, notificationSender_1.buildResolvedOverlay)(payload, (0, i18n_1.t)('Resolved in Antigravity'));
            sent.edit(resolved).catch(logger_1.logger.error);
        },
        onApprovalRequired: async (info) => {
            logger_1.logger.debug(`[ApprovalDetector:${projectName}] Approval button detected (allow="${info.approveText}", deny="${info.denyText}")`);
            const currentChatTitle = await getCurrentChatTitle(cdp);
            const targetChannel = resolveApprovalChannelForCurrentChat(bridge, projectName, currentChatTitle);
            const targetChannelId = targetChannel ? targetChannel.id : '';
            if (!targetChannel || !targetChannelId) {
                logger_1.logger.warn(`[ApprovalDetector:${projectName}] Skipped approval notification because chat is not linked to a session` +
                    `${currentChatTitle ? ` (title="${currentChatTitle}")` : ''}`);
                return;
            }
            if (bridge.autoAccept.isEnabled()) {
                const accepted = await detector.alwaysAllowButton() || await detector.approveButton();
                const autoPayload = (0, notificationSender_1.buildAutoApprovedNotification)({
                    accepted,
                    projectName,
                    description: info.description ?? undefined,
                    approveText: info.approveText ?? undefined,
                });
                await targetChannel.send(autoPayload).catch(logger_1.logger.error);
                if (accepted) {
                    return;
                }
            }
            const payload = (0, notificationSender_1.buildApprovalNotification)({
                title: (0, i18n_1.t)('Approval Required'),
                description: info.description || (0, i18n_1.t)('Antigravity is requesting approval for an action'),
                projectName,
                channelId: targetChannelId,
                extraFields: [
                    { name: (0, i18n_1.t)('Allow button'), value: info.approveText, inline: true },
                    { name: (0, i18n_1.t)('Allow Chat button'), value: info.alwaysAllowText || (0, i18n_1.t)('In Dropdown'), inline: true },
                    { name: (0, i18n_1.t)('Deny button'), value: info.denyText || (0, i18n_1.t)('(None)'), inline: true },
                ],
            });
            const sent = await targetChannel.send(payload).catch((err) => {
                logger_1.logger.error(err);
                return null;
            });
            if (sent) {
                lastNotification = { sent, payload };
            }
        },
    });
    detector.start();
    bridge.pool.registerApprovalDetector(projectName, detector);
    logger_1.logger.debug(`[ApprovalDetector:${projectName}] Started approval button detection`);
}
/**
 * Helper to start a planning detector for each workspace.
 * Does nothing if a detector for the same workspace is already running.
 */
function ensurePlanningDetector(bridge, cdp, projectName) {
    const existing = bridge.pool.getPlanningDetector(projectName);
    if (existing && existing.isActive())
        return;
    // Track the most recent planning notification for auto-disable on resolve.
    // See ensureApprovalDetector comment for tracking limitation rationale.
    let lastNotification = null;
    const detector = new planningDetector_1.PlanningDetector({
        cdpService: cdp,
        pollIntervalMs: 2000,
        onResolved: () => {
            if (!lastNotification)
                return;
            const { sent, payload } = lastNotification;
            lastNotification = null;
            const resolved = (0, notificationSender_1.buildResolvedOverlay)(payload, (0, i18n_1.t)('Resolved in Antigravity'));
            sent.edit(resolved).catch(logger_1.logger.error);
        },
        onPlanningRequired: async (info) => {
            logger_1.logger.debug(`[PlanningDetector:${projectName}] Planning buttons detected (title="${info.planTitle}")`);
            const currentChatTitle = await getCurrentChatTitle(cdp);
            const targetChannel = resolveApprovalChannelForCurrentChat(bridge, projectName, currentChatTitle);
            const targetChannelId = targetChannel ? targetChannel.id : '';
            if (!targetChannel || !targetChannelId) {
                logger_1.logger.warn(`[PlanningDetector:${projectName}] Skipped planning notification because chat is not linked to a session` +
                    `${currentChatTitle ? ` (title="${currentChatTitle}")` : ''}`);
                return;
            }
            const descriptionText = info.description || info.planSummary || (0, i18n_1.t)('A plan has been generated and is awaiting your review.');
            const extraFields = [
                { name: (0, i18n_1.t)('Plan'), value: info.planTitle || (0, i18n_1.t)('Implementation Plan'), inline: true },
                { name: (0, i18n_1.t)('Workspace'), value: projectName, inline: true },
            ];
            if (info.planSummary && info.description) {
                extraFields.push({ name: (0, i18n_1.t)('Summary'), value: info.planSummary.substring(0, 1024), inline: false });
            }
            const payload = (0, notificationSender_1.buildPlanningNotification)({
                title: (0, i18n_1.t)('Planning Mode'),
                description: descriptionText,
                projectName,
                channelId: targetChannelId,
                extraFields,
            });
            const sent = await targetChannel.send(payload).catch((err) => {
                logger_1.logger.error(err);
                return null;
            });
            if (sent) {
                lastNotification = { sent, payload };
            }
        },
    });
    detector.start();
    bridge.pool.registerPlanningDetector(projectName, detector);
    logger_1.logger.debug(`[PlanningDetector:${projectName}] Started planning button detection`);
}
/**
 * Helper to start an error popup detector for each workspace.
 * Does nothing if a detector for the same workspace is already running.
 */
function ensureErrorPopupDetector(bridge, cdp, projectName) {
    const existing = bridge.pool.getErrorPopupDetector(projectName);
    if (existing && existing.isActive())
        return;
    // Track the most recent error notification for auto-disable on resolve.
    // See ensureApprovalDetector comment for tracking limitation rationale.
    let lastNotification = null;
    const detector = new errorPopupDetector_1.ErrorPopupDetector({
        cdpService: cdp,
        pollIntervalMs: 3000,
        onResolved: () => {
            if (!lastNotification)
                return;
            const { sent, payload } = lastNotification;
            lastNotification = null;
            const resolved = (0, notificationSender_1.buildResolvedOverlay)(payload, (0, i18n_1.t)('Resolved in Antigravity'));
            sent.edit(resolved).catch(logger_1.logger.error);
        },
        onErrorPopup: async (info) => {
            logger_1.logger.debug(`[ErrorPopupDetector:${projectName}] Error popup detected (title="${info.title}")`);
            const currentChatTitle = await getCurrentChatTitle(cdp);
            const targetChannel = resolveApprovalChannelForCurrentChat(bridge, projectName, currentChatTitle);
            const targetChannelId = targetChannel ? targetChannel.id : '';
            if (!targetChannel || !targetChannelId) {
                logger_1.logger.warn(`[ErrorPopupDetector:${projectName}] Skipped error popup notification because chat is not linked to a session` +
                    `${currentChatTitle ? ` (title="${currentChatTitle}")` : ''}`);
                return;
            }
            const bodyText = info.body || (0, i18n_1.t)('An error occurred in the Antigravity agent.');
            const payload = (0, notificationSender_1.buildErrorPopupNotification)({
                title: info.title || (0, i18n_1.t)('Agent Error'),
                errorMessage: bodyText.substring(0, 4096),
                projectName,
                channelId: targetChannelId,
                extraFields: [
                    { name: (0, i18n_1.t)('Buttons'), value: info.buttons.join(', ') || (0, i18n_1.t)('(None)'), inline: true },
                    { name: (0, i18n_1.t)('Workspace'), value: projectName, inline: true },
                ],
            });
            const sent = await targetChannel.send(payload).catch((err) => {
                logger_1.logger.error(err);
                return null;
            });
            if (sent) {
                lastNotification = { sent, payload };
            }
        },
    });
    detector.start();
    bridge.pool.registerErrorPopupDetector(projectName, detector);
    logger_1.logger.debug(`[ErrorPopupDetector:${projectName}] Started error popup detection`);
}
/**
 * Helper to start a run command detector for each workspace.
 * Detects "Run command?" confirmation dialogs and forwards them to Discord.
 * Does nothing if a detector for the same workspace is already running.
 */
function ensureRunCommandDetector(bridge, cdp, projectName) {
    const existing = bridge.pool.getRunCommandDetector(projectName);
    if (existing && existing.isActive())
        return;
    let lastNotification = null;
    const detector = new runCommandDetector_1.RunCommandDetector({
        cdpService: cdp,
        pollIntervalMs: 2000,
        onResolved: () => {
            if (!lastNotification)
                return;
            const { sent, payload } = lastNotification;
            lastNotification = null;
            const resolved = (0, notificationSender_1.buildResolvedOverlay)(payload, (0, i18n_1.t)('Resolved in Antigravity'));
            sent.edit(resolved).catch(logger_1.logger.error);
        },
        onRunCommandRequired: async (info) => {
            logger_1.logger.debug(`[RunCommandDetector:${projectName}] Run command detected`);
            const currentChatTitle = await getCurrentChatTitle(cdp);
            const targetChannel = resolveApprovalChannelForCurrentChat(bridge, projectName, currentChatTitle);
            const targetChannelId = targetChannel ? targetChannel.id : '';
            if (!targetChannel || !targetChannelId) {
                logger_1.logger.warn(`[RunCommandDetector:${projectName}] Skipped run command notification because chat is not linked to a session` +
                    `${currentChatTitle ? ` (title="${currentChatTitle}")` : ''}`);
                return;
            }
            if (bridge.autoAccept.isEnabled()) {
                const accepted = await detector.runButton();
                const autoPayload = (0, notificationSender_1.buildAutoApprovedNotification)({
                    accepted,
                    projectName,
                    description: `Run: ${info.commandText}`,
                    approveText: info.runText ?? 'Run',
                });
                await targetChannel.send(autoPayload).catch(logger_1.logger.error);
                if (accepted) {
                    return;
                }
            }
            const payload = (0, notificationSender_1.buildRunCommandNotification)({
                title: (0, i18n_1.t)('Run Command?'),
                commandText: info.commandText,
                workingDirectory: info.workingDirectory,
                projectName,
                channelId: targetChannelId,
                extraFields: [
                    { name: (0, i18n_1.t)('Run button'), value: info.runText, inline: true },
                    { name: (0, i18n_1.t)('Reject button'), value: info.rejectText, inline: true },
                ],
            });
            const sent = await targetChannel.send(payload).catch((err) => {
                logger_1.logger.error(err);
                return null;
            });
            if (sent) {
                lastNotification = { sent, payload };
            }
        },
    });
    detector.start();
    bridge.pool.registerRunCommandDetector(projectName, detector);
    logger_1.logger.debug(`[RunCommandDetector:${projectName}] Started run command detection`);
}
/**
 * Helper to start a user message detector for a workspace.
 * Detects messages typed directly in the Antigravity UI (e.g., from a PC)
 * and mirrors them to a Discord channel.
 * Does nothing if a detector for the same workspace is already running.
 */
function ensureUserMessageDetector(bridge, cdp, projectName, onUserMessage) {
    const existing = bridge.pool.getUserMessageDetector(projectName);
    if (existing && existing.isActive())
        return;
    const detector = new userMessageDetector_1.UserMessageDetector({
        cdpService: cdp,
        pollIntervalMs: 2000,
        onUserMessage,
    });
    detector.start();
    bridge.pool.registerUserMessageDetector(projectName, detector);
    logger_1.logger.debug(`[UserMessageDetector:${projectName}] Started user message detection`);
}
