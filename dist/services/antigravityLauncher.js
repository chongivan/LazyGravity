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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAntigravityRunning = ensureAntigravityRunning;
const logger_1 = require("../utils/logger");
const cdpPorts_1 = require("../utils/cdpPorts");
const pathUtils_1 = require("../utils/pathUtils");
const http = __importStar(require("http"));
/**
 * Check if CDP responds on the specified port.
 */
function checkPort(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(Array.isArray(parsed));
                }
                catch {
                    resolve(false);
                }
            });
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}
/**
 * Check if Antigravity is running with CDP ports.
 * If not running, output a warning log (no auto-start or restart).
 *
 * Called during Bot initialization.
 */
async function ensureAntigravityRunning() {
    logger_1.logger.debug('[AntigravityLauncher] Checking CDP ports...');
    for (const port of cdpPorts_1.CDP_PORTS) {
        if (await checkPort(port)) {
            logger_1.logger.debug(`[AntigravityLauncher] OK — Port ${port} responding`);
            return;
        }
    }
    logger_1.logger.warn('');
    logger_1.logger.warn('='.repeat(70));
    logger_1.logger.warn('  Antigravity CDP ports are not responding');
    logger_1.logger.warn('');
    logger_1.logger.warn('  Run the following command to open Antigravity with CDP enabled:');
    logger_1.logger.warn('');
    logger_1.logger.warn('    lazy-gravity open');
    logger_1.logger.warn('');
    logger_1.logger.warn('  Or manually:');
    logger_1.logger.warn(`    ${(0, pathUtils_1.getAntigravityCdpHint)(9222)}`);
    logger_1.logger.warn('');
    logger_1.logger.warn('  Then run:  lazy-gravity start');
    logger_1.logger.warn('='.repeat(70));
    logger_1.logger.warn('');
}
