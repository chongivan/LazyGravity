"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.COLORS = void 0;
exports.createLogger = createLogger;
const logBuffer_1 = require("./logBuffer");
exports.COLORS = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    magenta: '\x1b[35m',
    boldYellow: '\x1b[1;33m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
};
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4,
};
const getTimestamp = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP', { hour12: false });
    return `${exports.COLORS.dim}[${timeString}]${exports.COLORS.reset}`;
};
function createLogger(initialLevel = 'info') {
    let currentLevel = initialLevel;
    function shouldLog(methodLevel) {
        return LEVEL_PRIORITY[methodLevel] >= LEVEL_PRIORITY[currentLevel];
    }
    return {
        info(...args) {
            if (shouldLog('info')) {
                const formatted = `${getTimestamp()} ${exports.COLORS.cyan}[INFO]${exports.COLORS.reset}`;
                console.info(formatted, ...args);
                logBuffer_1.logBuffer.append('info', `[INFO] ${args.join(' ')}`);
            }
        },
        warn(...args) {
            if (shouldLog('warn')) {
                const formatted = `${getTimestamp()} ${exports.COLORS.yellow}[WARN]${exports.COLORS.reset}`;
                console.warn(formatted, ...args);
                logBuffer_1.logBuffer.append('warn', `[WARN] ${args.join(' ')}`);
            }
        },
        error(...args) {
            if (shouldLog('error')) {
                const formatted = `${getTimestamp()} ${exports.COLORS.red}[ERROR]${exports.COLORS.reset}`;
                console.error(formatted, ...args);
                logBuffer_1.logBuffer.append('error', `[ERROR] ${args.join(' ')}`);
            }
        },
        debug(...args) {
            if (shouldLog('debug')) {
                const formatted = `${getTimestamp()} ${exports.COLORS.dim}[DEBUG]${exports.COLORS.reset}`;
                console.debug(formatted, ...args);
                logBuffer_1.logBuffer.append('debug', `[DEBUG] ${args.join(' ')}`);
            }
        },
        /** Important state transitions - stands out in logs */
        phase(...args) {
            if (shouldLog('info')) {
                const formatted = `${getTimestamp()} ${exports.COLORS.magenta}[PHASE]${exports.COLORS.reset}`;
                console.info(formatted, ...args);
                logBuffer_1.logBuffer.append('info', `[PHASE] ${args.join(' ')}`);
            }
        },
        /** Completion-related events - green for success */
        done(...args) {
            if (shouldLog('info')) {
                const formatted = `${getTimestamp()} ${exports.COLORS.green}[DONE]${exports.COLORS.reset}`;
                console.info(formatted, ...args);
                logBuffer_1.logBuffer.append('info', `[DONE] ${args.join(' ')}`);
            }
        },
        /** User prompt text - always visible regardless of log level */
        prompt(text) {
            const formatted = `${getTimestamp()} ${exports.COLORS.boldYellow}[PROMPT]${exports.COLORS.reset} ${exports.COLORS.boldYellow}${text}${exports.COLORS.reset}`;
            console.info(formatted);
            logBuffer_1.logBuffer.append('info', `[PROMPT] ${text}`);
        },
        /** Section divider with optional label for structured output */
        divider(label) {
            if (shouldLog('info')) {
                if (label) {
                    const pad = Math.max(4, 50 - label.length - 4);
                    console.info(`${exports.COLORS.green}[DONE]${exports.COLORS.reset} ${exports.COLORS.dim}── ${label} ${'─'.repeat(pad)}${exports.COLORS.reset}`);
                }
                else {
                    console.info(`${exports.COLORS.green}[DONE]${exports.COLORS.reset} ${exports.COLORS.dim}${'─'.repeat(50)}${exports.COLORS.reset}`);
                }
            }
        },
        setLogLevel(level) {
            currentLevel = level;
        },
        getLogLevel() {
            return currentLevel;
        },
    };
}
exports.logger = createLogger('info');
