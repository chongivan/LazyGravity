"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./utils/logger");
const bot_1 = require("./bot");
const lockfile_1 = require("./utils/lockfile");
const logo_1 = require("./utils/logo");
console.log(logo_1.LOGO);
// Prevent duplicate launch: exit immediately if bot is already running
(0, lockfile_1.acquireLock)();
(0, bot_1.startBot)().catch(logger_1.logger.error);
