"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireLock = acquireLock;
const logger_1 = require("./logger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOCK_FILE = path_1.default.resolve(process.cwd(), '.bot.lock');
/**
 * Check if a process with the given PID is running
 */
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Stop an existing process and wait for it to exit
 */
function killExistingProcess(pid) {
    logger_1.logger.warn(`🔄 Stopping existing Bot process (PID: ${pid})...`);
    try {
        process.kill(pid, 'SIGTERM');
    }
    catch {
        // Ignore if already terminated
        return;
    }
    // Wait up to 5 seconds for process to exit
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        if (!isProcessRunning(pid)) {
            logger_1.logger.info(`✅ Existing process (PID: ${pid}) stopped`);
            return;
        }
        // Wait 50ms (busy wait)
        const waitUntil = Date.now() + 50;
        while (Date.now() < waitUntil) { /* spin */ }
    }
    // Timeout: force kill with SIGKILL
    logger_1.logger.warn(`⚠️  Process did not exit with SIGTERM, force killing (SIGKILL)`);
    try {
        process.kill(pid, 'SIGKILL');
    }
    catch {
        // ignore
    }
}
/**
 * Acquire a lockfile to prevent duplicate bot instances.
 * If another process is already running, stop it before starting.
 *
 * @returns A function to release the lock
 */
function acquireLock() {
    // Check existing lock file
    if (fs_1.default.existsSync(LOCK_FILE)) {
        const content = fs_1.default.readFileSync(LOCK_FILE, 'utf-8').trim();
        const existingPid = parseInt(content, 10);
        if (!isNaN(existingPid) && existingPid !== process.pid && isProcessRunning(existingPid)) {
            // Stop existing process and restart
            killExistingProcess(existingPid);
        }
        else if (!isNaN(existingPid) && !isProcessRunning(existingPid)) {
            logger_1.logger.warn(`⚠️  Stale lock file detected (PID: ${existingPid} has exited). Cleaning up.`);
        }
        // Remove stale lock file
        try {
            fs_1.default.unlinkSync(LOCK_FILE);
        }
        catch { /* ignore */ }
    }
    // Create new lock file
    fs_1.default.writeFileSync(LOCK_FILE, String(process.pid), 'utf-8');
    logger_1.logger.info(`🔒 Lock acquired (PID: ${process.pid})`);
    // Cleanup function
    const releaseLock = () => {
        try {
            if (fs_1.default.existsSync(LOCK_FILE)) {
                const content = fs_1.default.readFileSync(LOCK_FILE, 'utf-8').trim();
                if (parseInt(content, 10) === process.pid) {
                    fs_1.default.unlinkSync(LOCK_FILE);
                    logger_1.logger.info(`🔓 Lock released (PID: ${process.pid})`);
                }
            }
        }
        catch {
            // Ignore errors during cleanup
        }
    };
    // Auto cleanup on process exit
    process.on('exit', releaseLock);
    process.on('SIGINT', () => {
        releaseLock();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        releaseLock();
        process.exit(0);
    });
    process.on('uncaughtException', (err) => {
        logger_1.logger.error('Uncaught exception:', err);
        releaseLock();
        process.exit(1);
    });
    return releaseLock;
}
