"use strict";
/**
 * Platform-agnostic notification builders.
 *
 * Every exported function is **pure** — no side effects, no I/O.
 * They return a `MessagePayload` that any platform adapter can render.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApprovalNotification = buildApprovalNotification;
exports.buildPlanningNotification = buildPlanningNotification;
exports.buildErrorPopupNotification = buildErrorPopupNotification;
exports.buildRunCommandNotification = buildRunCommandNotification;
exports.buildAutoApprovedNotification = buildAutoApprovedNotification;
exports.buildResolvedOverlay = buildResolvedOverlay;
exports.buildStatusNotification = buildStatusNotification;
exports.buildProgressNotification = buildProgressNotification;
const richContentBuilder_1 = require("../platform/richContentBuilder");
// ---------------------------------------------------------------------------
// Custom-ID prefix constants (must stay in sync with cdpBridgeManager)
// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------
// Notification colours
// ---------------------------------------------------------------------------
/** Warning orange — used for approval requests. */
const COLOR_APPROVAL = 0xFFA500;
/** Blue — used for planning / informational notifications. */
const COLOR_PLANNING = 0x3498DB;
/** Red — used for error notifications. */
const COLOR_ERROR = 0xE74C3C;
/** Green — used for success / progress notifications. */
const COLOR_SUCCESS = 0x2ECC71;
/** Grey — used for neutral status notifications. */
const COLOR_NEUTRAL = 0x95A5A6;
// ---------------------------------------------------------------------------
// Phase → colour mapping for progress notifications
// ---------------------------------------------------------------------------
const PHASE_COLOURS = {
    thinking: COLOR_PLANNING,
    generating: COLOR_SUCCESS,
    error: COLOR_ERROR,
    waiting: COLOR_NEUTRAL,
    complete: COLOR_SUCCESS,
};
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/** Create a single button definition. */
function button(customId, label, style) {
    return { type: 'button', customId, label, style };
}
/** Wrap one or more buttons into a component row. */
function buttonRow(...buttons) {
    return { components: buttons };
}
/**
 * Build a colon-separated customId following the project convention:
 *   `<prefix>:<projectName>` or `<prefix>:<projectName>:<channelId>`
 */
function customId(prefix, projectName, channelId) {
    if (channelId !== null && channelId.trim().length > 0) {
        return `${prefix}:${projectName}:${channelId}`;
    }
    return `${prefix}:${projectName}`;
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/** Build the approval notification message. */
function buildApprovalNotification(opts) {
    const { title, description, projectName, channelId, toolNames, extraFields } = opts;
    const richContent = (0, richContentBuilder_1.pipe)((0, richContentBuilder_1.createRichContent)(), (rc) => (0, richContentBuilder_1.withTitle)(rc, title), (rc) => (0, richContentBuilder_1.withDescription)(rc, description), (rc) => (0, richContentBuilder_1.withColor)(rc, COLOR_APPROVAL), (rc) => (0, richContentBuilder_1.addField)(rc, 'Project', projectName, true), (rc) => toolNames && toolNames.length > 0
        ? (0, richContentBuilder_1.addField)(rc, 'Tools', toolNames.join(', '), true)
        : rc, (rc) => extraFields
        ? extraFields.reduce((acc, f) => (0, richContentBuilder_1.addField)(acc, f.name, f.value, f.inline), rc)
        : rc, (rc) => (0, richContentBuilder_1.withFooter)(rc, 'Approval required'), (rc) => (0, richContentBuilder_1.withTimestamp)(rc));
    const components = [
        buttonRow(button(customId(APPROVE_ACTION_PREFIX, projectName, channelId), 'Allow', 'success'), button(customId(ALWAYS_ALLOW_ACTION_PREFIX, projectName, channelId), 'Allow Chat', 'primary'), button(customId(DENY_ACTION_PREFIX, projectName, channelId), 'Deny', 'danger')),
    ];
    return { richContent, components };
}
/** Build the planning mode notification message. */
function buildPlanningNotification(opts) {
    const { title, description, projectName, channelId, extraFields } = opts;
    const richContent = (0, richContentBuilder_1.pipe)((0, richContentBuilder_1.createRichContent)(), (rc) => (0, richContentBuilder_1.withTitle)(rc, title), (rc) => (0, richContentBuilder_1.withDescription)(rc, description), (rc) => (0, richContentBuilder_1.withColor)(rc, COLOR_PLANNING), (rc) => extraFields
        ? extraFields.reduce((acc, f) => (0, richContentBuilder_1.addField)(acc, f.name, f.value, f.inline), rc)
        : rc, (rc) => (0, richContentBuilder_1.withFooter)(rc, 'Planning mode detected'), (rc) => (0, richContentBuilder_1.withTimestamp)(rc));
    const components = [
        buttonRow(button(customId(PLANNING_OPEN_ACTION_PREFIX, projectName, channelId), 'Open', 'primary'), button(customId(PLANNING_PROCEED_ACTION_PREFIX, projectName, channelId), 'Proceed', 'success')),
    ];
    return { richContent, components };
}
/** Build the error popup notification message. */
function buildErrorPopupNotification(opts) {
    const { title, errorMessage, projectName, channelId, extraFields } = opts;
    const richContent = (0, richContentBuilder_1.pipe)((0, richContentBuilder_1.createRichContent)(), (rc) => (0, richContentBuilder_1.withTitle)(rc, title), (rc) => (0, richContentBuilder_1.withDescription)(rc, errorMessage), (rc) => (0, richContentBuilder_1.withColor)(rc, COLOR_ERROR), (rc) => extraFields
        ? extraFields.reduce((acc, f) => (0, richContentBuilder_1.addField)(acc, f.name, f.value, f.inline), rc)
        : rc, (rc) => (0, richContentBuilder_1.withFooter)(rc, 'Agent error detected'), (rc) => (0, richContentBuilder_1.withTimestamp)(rc));
    const components = [
        buttonRow(button(customId(ERROR_POPUP_DISMISS_ACTION_PREFIX, projectName, channelId), 'Dismiss', 'secondary'), button(customId(ERROR_POPUP_COPY_DEBUG_ACTION_PREFIX, projectName, channelId), 'Copy Debug', 'primary'), button(customId(ERROR_POPUP_RETRY_ACTION_PREFIX, projectName, channelId), 'Retry', 'success')),
    ];
    return { richContent, components };
}
/** Build the run command notification message. */
function buildRunCommandNotification(opts) {
    const { title, commandText, workingDirectory, projectName, channelId, extraFields } = opts;
    const safeCommandText = (commandText || '')
        .replace(/```/g, '`\u200b``')
        .slice(0, 3800);
    const safeWorkingDirectory = (workingDirectory || '(unknown)').slice(0, 1024);
    const richContent = (0, richContentBuilder_1.pipe)((0, richContentBuilder_1.createRichContent)(), (rc) => (0, richContentBuilder_1.withTitle)(rc, title), (rc) => (0, richContentBuilder_1.withDescription)(rc, `\`\`\`\n${safeCommandText}\n\`\`\``), (rc) => (0, richContentBuilder_1.withColor)(rc, COLOR_APPROVAL), (rc) => (0, richContentBuilder_1.addField)(rc, 'Directory', safeWorkingDirectory, true), (rc) => (0, richContentBuilder_1.addField)(rc, 'Project', projectName, true), (rc) => extraFields
        ? extraFields.reduce((acc, f) => (0, richContentBuilder_1.addField)(acc, f.name, f.value, f.inline), rc)
        : rc, (rc) => (0, richContentBuilder_1.withFooter)(rc, 'Run command approval required'), (rc) => (0, richContentBuilder_1.withTimestamp)(rc));
    const components = [
        buttonRow(button(customId(RUN_COMMAND_RUN_ACTION_PREFIX, projectName, channelId), 'Run', 'success'), button(customId(RUN_COMMAND_REJECT_ACTION_PREFIX, projectName, channelId), 'Reject', 'danger')),
    ];
    return { richContent, components };
}
/** Build an auto-approved notification (shown when auto-accept fires). */
function buildAutoApprovedNotification(opts) {
    const { accepted, projectName, description, approveText } = opts;
    const richContent = (0, richContentBuilder_1.pipe)((0, richContentBuilder_1.createRichContent)(), (rc) => (0, richContentBuilder_1.withTitle)(rc, accepted ? 'Auto-approved' : 'Auto-approve failed'), (rc) => (0, richContentBuilder_1.withDescription)(rc, accepted
        ? 'An action was automatically approved.'
        : 'Auto-approve attempted but failed. Manual approval required.'), (rc) => (0, richContentBuilder_1.withColor)(rc, accepted ? COLOR_SUCCESS : 0xF39C12), (rc) => (0, richContentBuilder_1.addField)(rc, 'Auto-approve mode', 'ON', true), (rc) => (0, richContentBuilder_1.addField)(rc, 'Workspace', projectName, true), (rc) => (0, richContentBuilder_1.addField)(rc, 'Result', accepted ? 'Executed Always Allow/Allow' : 'Manual approval required', true), (rc) => description ? (0, richContentBuilder_1.addField)(rc, 'Action Detail', description.substring(0, 1024), false) : rc, (rc) => approveText ? (0, richContentBuilder_1.addField)(rc, 'Approved via', approveText, true) : rc, (rc) => (0, richContentBuilder_1.withTimestamp)(rc));
    return { richContent };
}
/**
 * Build a "resolved" overlay from an existing notification payload.
 * Changes colour to grey, adds a Status field, and disables all buttons.
 */
function buildResolvedOverlay(original, statusText) {
    const rc = (0, richContentBuilder_1.pipe)(original.richContent ?? (0, richContentBuilder_1.createRichContent)(), (r) => (0, richContentBuilder_1.withColor)(r, COLOR_NEUTRAL), (r) => (0, richContentBuilder_1.addField)(r, 'Status', statusText, false));
    const disabledComponents = original.components
        ? original.components.map((row) => ({
            components: row.components.map((comp) => comp.type === 'button' ? { ...comp, disabled: true } : comp),
        }))
        : undefined;
    return {
        ...original,
        richContent: rc,
        components: disabledComponents,
    };
}
/** Build a simple status embed. */
function buildStatusNotification(opts) {
    const { title, description, color, fields } = opts;
    const richContent = (0, richContentBuilder_1.pipe)((0, richContentBuilder_1.createRichContent)(), (rc) => (0, richContentBuilder_1.withTitle)(rc, title), (rc) => (0, richContentBuilder_1.withDescription)(rc, description), (rc) => (0, richContentBuilder_1.withColor)(rc, color ?? COLOR_NEUTRAL), (rc) => fields
        ? fields.reduce((acc, f) => (0, richContentBuilder_1.addField)(acc, f.name, f.value, f.inline), rc)
        : rc);
    return { richContent };
}
/** Build a progress / phase notification (e.g. "Thinking...", "Generating..."). */
function buildProgressNotification(opts) {
    const { phase, projectName, detail } = opts;
    const phaseColor = PHASE_COLOURS[phase.toLowerCase()] ?? COLOR_NEUTRAL;
    const richContent = (0, richContentBuilder_1.pipe)((0, richContentBuilder_1.createRichContent)(), (rc) => (0, richContentBuilder_1.withTitle)(rc, phase), (rc) => (detail ? (0, richContentBuilder_1.withDescription)(rc, detail) : rc), (rc) => (0, richContentBuilder_1.withColor)(rc, phaseColor), (rc) => (projectName ? (0, richContentBuilder_1.addField)(rc, 'Project', projectName, true) : rc));
    return { richContent };
}
