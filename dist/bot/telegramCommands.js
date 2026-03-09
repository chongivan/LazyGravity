"use strict";
/**
 * Telegram command parser and handlers.
 *
 * Handles built-in bot commands that can be answered immediately
 * without routing through CDP/Antigravity:
 *   /start         — Welcome message
 *   /help          — List available commands
 *   /status        — Show bot connection status
 *   /stop          — Interrupt active LLM generation
 *   /ping          — Latency check
 *   /mode          — Switch execution mode
 *   /model         — Switch LLM model
 *   /screenshot    — Capture Antigravity screenshot
 *   /autoaccept    — Toggle auto-accept for approval dialogs
 *   /template      — List and execute prompt templates
 *   /logs          — Show recent log entries
 *   /new           — Start a new chat session
 *   /conversations — List recent conversations
 *   /switch        — Switch to a conversation by title
 */
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
exports.parseTelegramCommand = parseTelegramCommand;
exports.handleTelegramCommand = handleTelegramCommand;
const fs_1 = __importDefault(require("fs"));
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const modeUi_1 = require("../ui/modeUi");
const modelsUi_1 = require("../ui/modelsUi");
const autoAcceptUi_1 = require("../ui/autoAcceptUi");
const templateUi_1 = require("../ui/templateUi");
const screenshotUi_1 = require("../ui/screenshotUi");
const logBuffer_1 = require("../utils/logBuffer");
const telegramFormatter_1 = require("../platform/telegram/telegramFormatter");
const logger_1 = require("../utils/logger");
// ---------------------------------------------------------------------------
// Known commands (used by both parser and /help output)
// ---------------------------------------------------------------------------
const KNOWN_COMMANDS = ['start', 'help', 'status', 'stop', 'ping', 'mode', 'model', 'screenshot', 'autoaccept', 'template', 'template_add', 'template_delete', 'project_create', 'logs', 'new', 'conversations', 'switch'];
/**
 * Parse a Telegram command from message text.
 *
 * Accepted formats:
 *   /command
 *   /command args text
 *   /command@BotName
 *   /command@BotName args text
 *
 * Returns null if the text is not a known command (unknown commands
 * are forwarded to Antigravity as normal messages).
 */
function parseTelegramCommand(text) {
    const trimmed = text.trim();
    const match = trimmed.match(/^\/(\w+)(?:@\S+)?(?:\s+(.*))?$/);
    if (!match)
        return null;
    const command = match[1].toLowerCase();
    if (!KNOWN_COMMANDS.includes(command))
        return null;
    return {
        command,
        args: (match[2] ?? '').trim(),
    };
}
// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
/**
 * Handle a parsed Telegram command.
 * Routes to the appropriate sub-handler based on command name.
 */
async function handleTelegramCommand(deps, message, parsed) {
    const argsDisplay = parsed.args ? ` ${parsed.args}` : '';
    logger_1.logger.info(`[TelegramCommand] /${parsed.command}${argsDisplay} (chat=${message.channel.id})`);
    switch (parsed.command) {
        case 'start':
            await handleStart(message);
            break;
        case 'help':
            await handleHelp(message);
            break;
        case 'status':
            await handleStatus(deps, message);
            break;
        case 'stop':
            await handleStop(deps, message);
            break;
        case 'ping':
            await handlePing(message);
            break;
        case 'mode':
            await handleMode(deps, message);
            break;
        case 'model':
            await handleModel(deps, message);
            break;
        case 'screenshot':
            await handleScreenshot(deps, message);
            break;
        case 'autoaccept':
            await handleAutoAccept(deps, message, parsed.args);
            break;
        case 'template':
            await handleTemplate(deps, message);
            break;
        case 'template_add':
            await handleTemplateAdd(deps, message, parsed.args);
            break;
        case 'template_delete':
            await handleTemplateDelete(deps, message, parsed.args);
            break;
        case 'project_create':
            await handleProjectCreate(deps, message, parsed.args);
            break;
        case 'logs':
            await handleLogs(message, parsed.args);
            break;
        case 'new':
            await handleNew(deps, message);
            break;
        case 'conversations':
            await handleConversations(deps, message);
            break;
        case 'switch':
            await handleSwitch(deps, message, parsed.args);
            break;
        default:
            // Should not happen — parser filters unknowns
            break;
    }
}
// ---------------------------------------------------------------------------
// Sub-handlers
// ---------------------------------------------------------------------------
async function handleStart(message) {
    const text = [
        '<b>Welcome to LazyGravity!</b>',
        '',
        'This bot connects you to Antigravity AI workspaces.',
        '',
        'Get started:',
        '1. Use /project to bind this chat to a workspace',
        '2. Send any message to start chatting with Antigravity',
        '',
        'Type /help for a list of available commands.',
    ].join('\n');
    await message.reply({ text }).catch(logger_1.logger.error);
}
async function handleHelp(message) {
    const text = [
        '<b>Available Commands</b>',
        '',
        '/project — Manage workspace bindings',
        '/status — Show bot status and connections',
        '/mode — Switch execution mode',
        '/model — Switch LLM model',
        '/screenshot — Capture Antigravity screenshot',
        '/autoaccept — Toggle auto-accept mode',
        '/template — List prompt templates',
        '/template_add — Add a prompt template',
        '/template_delete — Delete a prompt template',
        '/project_create — Create a new workspace',
        '/new — Start a new chat session',
        '/conversations — List recent conversations',
        '/switch — Switch to a conversation by title',
        '/logs — Show recent log entries',
        '/stop — Interrupt active LLM generation',
        '/ping — Check bot latency',
        '/help — Show this help message',
        '',
        'Any other message is forwarded to Antigravity.',
    ].join('\n');
    await message.reply({ text }).catch(logger_1.logger.error);
}
async function handleStatus(deps, message) {
    const chatId = message.channel.id;
    // Current chat binding
    const binding = deps.telegramBindingRepo?.findByChatId(chatId);
    const boundProject = binding?.workspacePath ?? '(none)';
    // CDP connection status for this chat's project
    const activeWorkspaces = deps.bridge.pool.getActiveWorkspaceNames();
    const projectConnected = binding
        ? activeWorkspaces.some((name) => binding.workspacePath.includes(name) || name.includes(binding.workspacePath))
        : false;
    const mode = deps.modeService
        ? deps.modeService.getCurrentMode()
        : 'unknown';
    const lines = [
        '<b>Bot Status</b>',
        '',
        `<b>This chat:</b>`,
        `  Project: ${(0, telegramFormatter_1.escapeHtml)(boundProject)}`,
        `  CDP: ${projectConnected ? 'Connected' : 'Not connected'}`,
        '',
        `Mode: ${(0, telegramFormatter_1.escapeHtml)(mode)}`,
        `Active connections: ${activeWorkspaces.length > 0 ? activeWorkspaces.map(telegramFormatter_1.escapeHtml).join(', ') : 'none'}`,
    ];
    await message.reply({ text: lines.join('\n') }).catch(logger_1.logger.error);
}
async function handleStop(deps, message) {
    const workspace = deps.bridge.lastActiveWorkspace;
    // Try to use the active ResponseMonitor first (it stops monitoring + clicks stop)
    if (workspace && deps.activeMonitors) {
        const monitor = deps.activeMonitors.get(workspace);
        if (monitor && monitor.isActive()) {
            logger_1.logger.info(`[TelegramCommand:stop] Stopping active monitor for ${workspace}...`);
            const result = await monitor.clickStopButton();
            if (result.ok) {
                logger_1.logger.done(`[TelegramCommand:stop] Stopped via monitor (method=${result.method})`);
                await message.reply({ text: 'Generation stopped.' }).catch(logger_1.logger.error);
                return;
            }
            logger_1.logger.warn(`[TelegramCommand:stop] Monitor clickStopButton failed: ${result.error}`);
        }
    }
    // Fallback: try direct CDP call (no active monitor, or monitor click failed)
    const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(deps.bridge);
    if (!cdp) {
        logger_1.logger.warn('[TelegramCommand:stop] No CDP — lastActiveWorkspace:', workspace ?? '(null)');
        await message.reply({ text: 'No active workspace connection.' }).catch(logger_1.logger.error);
        return;
    }
    try {
        logger_1.logger.info('[TelegramCommand:stop] Clicking stop button via direct CDP...');
        const { RESPONSE_SELECTORS } = await Promise.resolve().then(() => __importStar(require('../services/responseMonitor')));
        const result = await cdp.call('Runtime.evaluate', { expression: RESPONSE_SELECTORS.CLICK_STOP_BUTTON, returnByValue: true });
        const value = result?.result?.value;
        if (value && typeof value === 'object' && value.ok) {
            logger_1.logger.done(`[TelegramCommand:stop] Stop button clicked (method=${value.method})`);
            await message.reply({ text: 'Generation stopped.' }).catch(logger_1.logger.error);
        }
        else {
            logger_1.logger.warn('[TelegramCommand:stop] Stop button not found — value:', JSON.stringify(value));
            await message.reply({ text: 'Stop button not found (generation may have already finished).' }).catch(logger_1.logger.error);
        }
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:stop]', err?.message || err);
        await message.reply({ text: 'Failed to click stop button.' }).catch(logger_1.logger.error);
    }
}
async function handlePing(message) {
    await message.reply({ text: 'Pong!' }).catch(logger_1.logger.error);
}
async function handleMode(deps, message) {
    if (!deps.modeService) {
        await message.reply({ text: 'Mode service not available.' }).catch(logger_1.logger.error);
        return;
    }
    const isPending = deps.modeService.isPendingSync();
    const payload = (0, modeUi_1.buildModePayload)(deps.modeService.getCurrentMode(), isPending);
    await message.reply(payload).catch(logger_1.logger.error);
}
async function handleModel(deps, message) {
    const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(deps.bridge);
    if (!cdp) {
        await message.reply({ text: 'Not connected to Antigravity.' }).catch(logger_1.logger.error);
        return;
    }
    const models = await cdp.getUiModels();
    const currentModel = await cdp.getCurrentModel();
    const quotaData = deps.fetchQuota ? await deps.fetchQuota() : [];
    const defaultModel = deps.modelService?.getDefaultModel() ?? null;
    const payload = (0, modelsUi_1.buildModelsPayload)(models, currentModel, quotaData, defaultModel);
    if (!payload) {
        await message.reply({ text: 'No models available.' }).catch(logger_1.logger.error);
        return;
    }
    await message.reply(payload).catch(logger_1.logger.error);
}
async function handleScreenshot(deps, message) {
    const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(deps.bridge);
    const payload = await (0, screenshotUi_1.buildScreenshotPayload)(cdp);
    // If the payload contains files, send them as text (base64) since
    // Telegram file sending requires special API calls handled by the adapter.
    if (payload.files && payload.files.length > 0) {
        await sendFilePayload(message, payload);
    }
    else {
        await message.reply(payload).catch(logger_1.logger.error);
    }
}
async function handleAutoAccept(deps, message, args) {
    // If args are provided (e.g. /autoaccept on), handle directly
    if (args) {
        const result = deps.bridge.autoAccept.handle(args);
        await message.reply({ text: result.message }).catch(logger_1.logger.error);
        return;
    }
    // No args — show interactive UI with buttons
    const payload = (0, autoAcceptUi_1.buildAutoAcceptPayload)(deps.bridge.autoAccept.isEnabled());
    await message.reply(payload).catch(logger_1.logger.error);
}
async function handleTemplate(deps, message) {
    if (!deps.templateRepo) {
        await message.reply({ text: 'Template service not available.' }).catch(logger_1.logger.error);
        return;
    }
    const templates = deps.templateRepo.findAll();
    const payload = (0, templateUi_1.buildTemplatePayload)(templates);
    await message.reply(payload).catch(logger_1.logger.error);
}
async function handleTemplateAdd(deps, message, args) {
    if (!deps.templateRepo) {
        await message.reply({ text: 'Template service not available.' }).catch(logger_1.logger.error);
        return;
    }
    // Split args into name (first word) and prompt (rest)
    const spaceIndex = args.indexOf(' ');
    if (!args || spaceIndex === -1) {
        await message.reply({
            text: 'Usage: /template_add &lt;name&gt; &lt;prompt&gt;\nExample: /template_add daily-report Write a daily standup report',
        }).catch(logger_1.logger.error);
        return;
    }
    const name = args.slice(0, spaceIndex);
    const prompt = args.slice(spaceIndex + 1).trim();
    try {
        deps.templateRepo.create({ name, prompt });
        await message.reply({ text: `Template '${(0, telegramFormatter_1.escapeHtml)(name)}' created.` }).catch(logger_1.logger.error);
    }
    catch (err) {
        if (err?.message?.includes('UNIQUE constraint')) {
            await message.reply({ text: `Template '${(0, telegramFormatter_1.escapeHtml)(name)}' already exists.` }).catch(logger_1.logger.error);
        }
        else {
            logger_1.logger.error('[TelegramCommand:template_add]', err?.message || err);
            await message.reply({ text: 'Failed to create template.' }).catch(logger_1.logger.error);
        }
    }
}
async function handleTemplateDelete(deps, message, args) {
    if (!deps.templateRepo) {
        await message.reply({ text: 'Template service not available.' }).catch(logger_1.logger.error);
        return;
    }
    const name = args.trim();
    if (!name) {
        await message.reply({
            text: 'Usage: /template_delete &lt;name&gt;\nExample: /template_delete daily-report',
        }).catch(logger_1.logger.error);
        return;
    }
    const deleted = deps.templateRepo.deleteByName(name);
    if (deleted) {
        await message.reply({ text: `Template '${(0, telegramFormatter_1.escapeHtml)(name)}' deleted.` }).catch(logger_1.logger.error);
    }
    else {
        await message.reply({ text: `Template '${(0, telegramFormatter_1.escapeHtml)(name)}' not found.` }).catch(logger_1.logger.error);
    }
}
async function handleProjectCreate(deps, message, args) {
    if (!deps.workspaceService) {
        await message.reply({ text: 'Workspace service not available.' }).catch(logger_1.logger.error);
        return;
    }
    const name = args.trim();
    if (!name) {
        await message.reply({
            text: 'Usage: /project_create &lt;name&gt;\nExample: /project_create NewProject',
        }).catch(logger_1.logger.error);
        return;
    }
    try {
        const safePath = deps.workspaceService.validatePath(name);
        if (deps.workspaceService.exists(name)) {
            await message.reply({ text: `Workspace '${(0, telegramFormatter_1.escapeHtml)(name)}' already exists.` }).catch(logger_1.logger.error);
            return;
        }
        fs_1.default.mkdirSync(safePath, { recursive: true });
        await message.reply({ text: `Workspace '${(0, telegramFormatter_1.escapeHtml)(name)}' created.` }).catch(logger_1.logger.error);
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:project_create]', err?.message || err);
        await message.reply({ text: `Failed to create workspace: ${(0, telegramFormatter_1.escapeHtml)(err?.message || 'unknown error')}` }).catch(logger_1.logger.error);
    }
}
async function handleLogs(message, args) {
    const countArg = args ? parseInt(args, 10) : 20;
    const count = isNaN(countArg) ? 20 : Math.min(Math.max(countArg, 1), 50);
    const entries = logBuffer_1.logBuffer.getRecent(count);
    if (entries.length === 0) {
        await message.reply({ text: 'No log entries.' }).catch(logger_1.logger.error);
        return;
    }
    const lines = entries.map((e) => `<code>${e.timestamp.slice(11, 19)}</code> [${e.level.toUpperCase()}] ${(0, telegramFormatter_1.escapeHtml)(e.message)}`);
    const text = `<b>Recent Logs (${entries.length})</b>\n\n${lines.join('\n')}`;
    // Telegram message limit is 4096 chars
    const truncated = text.length > 4096 ? text.slice(0, 4090) + '\n...' : text;
    await message.reply({ text: truncated }).catch(logger_1.logger.error);
}
async function handleNew(deps, message) {
    if (!deps.chatSessionService) {
        await message.reply({ text: 'Chat session service not available.' }).catch(logger_1.logger.error);
        return;
    }
    // Resolve workspace binding for this chat
    const chatId = message.channel.id;
    const binding = deps.telegramBindingRepo?.findByChatId(chatId);
    if (!binding) {
        await message.reply({
            text: 'No project is linked to this chat. Use /project to bind a workspace first.',
        }).catch(logger_1.logger.error);
        return;
    }
    // Resolve workspace path and connect to CDP
    let cdp;
    try {
        const workspacePath = deps.workspaceService
            ? deps.workspaceService.getWorkspacePath(binding.workspacePath)
            : binding.workspacePath;
        cdp = await deps.bridge.pool.getOrConnect(workspacePath);
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:new] CDP connection failed:', err?.message || err);
        await message.reply({ text: 'Failed to connect to Antigravity.' }).catch(logger_1.logger.error);
        return;
    }
    // Start a new chat session
    try {
        const result = await deps.chatSessionService.startNewChat(cdp);
        if (result.ok) {
            await message.reply({ text: 'New chat session started.' }).catch(logger_1.logger.error);
        }
        else {
            logger_1.logger.warn('[TelegramCommand:new] startNewChat failed:', result.error);
            await message.reply({
                text: `Failed to start new chat: ${(0, telegramFormatter_1.escapeHtml)(result.error || 'unknown error')}`,
            }).catch(logger_1.logger.error);
        }
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:new] startNewChat threw:', err?.message || err);
        await message.reply({ text: 'Failed to start new chat.' }).catch(logger_1.logger.error);
    }
}
async function handleConversations(deps, message) {
    if (!deps.chatSessionService) {
        await message.reply({ text: 'Chat session service not available.' }).catch(logger_1.logger.error);
        return;
    }
    const chatId = message.channel.id;
    const binding = deps.telegramBindingRepo?.findByChatId(chatId);
    if (!binding) {
        await message.reply({
            text: 'No project is linked to this chat. Use /project to bind a workspace first.',
        }).catch(logger_1.logger.error);
        return;
    }
    let cdp;
    try {
        const workspacePath = deps.workspaceService
            ? deps.workspaceService.getWorkspacePath(binding.workspacePath)
            : binding.workspacePath;
        cdp = await deps.bridge.pool.getOrConnect(workspacePath);
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:conversations] CDP connection failed:', err?.message || err);
        await message.reply({ text: 'Failed to connect to Antigravity.' }).catch(logger_1.logger.error);
        return;
    }
    try {
        const sessions = await deps.chatSessionService.listAllSessions(cdp);
        if (sessions.length === 0) {
            await message.reply({ text: 'No conversations found.' }).catch(logger_1.logger.error);
            return;
        }
        const lines = ['<b>Recent Conversations</b>', ''];
        sessions.forEach((s, i) => {
            const marker = s.isActive ? '▶ ' : '  ';
            const num = `${i + 1}.`;
            lines.push(`${marker}${num} ${(0, telegramFormatter_1.escapeHtml)(s.title)}`);
        });
        lines.push('', 'Use /switch &lt;title&gt; to switch to a conversation.');
        const text = lines.join('\n');
        const truncated = text.length > 4096 ? text.slice(0, 4090) + '\n...' : text;
        await message.reply({ text: truncated }).catch(logger_1.logger.error);
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:conversations]', err?.message || err);
        await message.reply({ text: 'Failed to list conversations.' }).catch(logger_1.logger.error);
    }
}
async function handleSwitch(deps, message, args) {
    if (!deps.chatSessionService) {
        await message.reply({ text: 'Chat session service not available.' }).catch(logger_1.logger.error);
        return;
    }
    const title = args.trim();
    if (!title) {
        await message.reply({
            text: 'Usage: /switch &lt;conversation title&gt;\nExample: /switch Implementing user auth',
        }).catch(logger_1.logger.error);
        return;
    }
    const chatId = message.channel.id;
    const binding = deps.telegramBindingRepo?.findByChatId(chatId);
    if (!binding) {
        await message.reply({
            text: 'No project is linked to this chat. Use /project to bind a workspace first.',
        }).catch(logger_1.logger.error);
        return;
    }
    let cdp;
    try {
        const workspacePath = deps.workspaceService
            ? deps.workspaceService.getWorkspacePath(binding.workspacePath)
            : binding.workspacePath;
        cdp = await deps.bridge.pool.getOrConnect(workspacePath);
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:switch] CDP connection failed:', err?.message || err);
        await message.reply({ text: 'Failed to connect to Antigravity.' }).catch(logger_1.logger.error);
        return;
    }
    try {
        await message.reply({ text: `Switching to "${(0, telegramFormatter_1.escapeHtml)(title)}"...` }).catch(logger_1.logger.error);
        const result = await deps.chatSessionService.activateSessionByTitle(cdp, title);
        if (result.ok) {
            await message.reply({ text: `Switched to "${(0, telegramFormatter_1.escapeHtml)(title)}".` }).catch(logger_1.logger.error);
        }
        else {
            logger_1.logger.warn('[TelegramCommand:switch] activateSessionByTitle failed:', result.error);
            await message.reply({
                text: `Failed to switch: ${(0, telegramFormatter_1.escapeHtml)(result.error || 'unknown error')}`,
            }).catch(logger_1.logger.error);
        }
    }
    catch (err) {
        logger_1.logger.error('[TelegramCommand:switch]', err?.message || err);
        await message.reply({ text: 'Failed to switch conversation.' }).catch(logger_1.logger.error);
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Send a MessagePayload that contains file attachments.
 * Falls back to a text reply if file sending is not supported.
 */
async function sendFilePayload(message, payload) {
    // Try sending with files — the Telegram adapter supports this if sendPhoto is available
    try {
        await message.reply(payload);
    }
    catch (err) {
        logger_1.logger.warn('[TelegramCommand:screenshot] File sending failed:', err instanceof Error ? err.message : err);
        await message.reply({ text: 'Screenshot captured but file sending failed.' }).catch(logger_1.logger.error);
    }
}
