"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAction = startAction;
const logo_1 = require("../../utils/logo");
const lockfile_1 = require("../../utils/lockfile");
const bot_1 = require("../../bot");
const logger_1 = require("../../utils/logger");
const package_json_1 = require("../../../package.json");
const updateCheckService_1 = require("../../services/updateCheckService");
/**
 * Resolve log level from CLI flags on the root program.
 * Priority: --verbose > --quiet > undefined (fall through to env/config)
 */
function resolveCliLogLevel(cmd) {
    if (!cmd)
        return undefined;
    const root = cmd.parent ?? cmd;
    const opts = root.opts();
    if (opts.verbose)
        return 'debug';
    if (opts.quiet)
        return 'error';
    return undefined;
}
async function startAction(_opts, cmd) {
    const cliLevel = resolveCliLogLevel(cmd);
    if (cliLevel) {
        logger_1.logger.setLogLevel(cliLevel);
    }
    console.log(logo_1.LOGO);
    (0, lockfile_1.acquireLock)();
    // Non-blocking update check (fire-and-forget)
    (0, updateCheckService_1.checkForUpdates)(package_json_1.version).catch(() => { });
    await (0, bot_1.startBot)(cliLevel).catch((err) => {
        logger_1.logger.error('Failed to start bot:', err);
        process.exit(1);
    });
}
