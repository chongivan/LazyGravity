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
exports.COOLDOWN_MS = exports.UPDATE_CHECK_FILE = void 0;
exports.shouldCheckForUpdates = shouldCheckForUpdates;
exports.fetchLatestVersion = fetchLatestVersion;
exports.isGlobalInstall = isGlobalInstall;
exports.checkForUpdates = checkForUpdates;
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const CONFIG_DIR = '.lazy-gravity';
exports.UPDATE_CHECK_FILE = 'update-check.json';
exports.COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGISTRY_URL = 'https://registry.npmjs.org/lazy-gravity/latest';
const REQUEST_TIMEOUT_MS = 5000;
function getCachePath() {
    return path.join(os.homedir(), CONFIG_DIR, exports.UPDATE_CHECK_FILE);
}
/**
 * Determine whether enough time has elapsed since the last update check.
 * Returns true if we should query the registry.
 */
function shouldCheckForUpdates() {
    const cachePath = getCachePath();
    try {
        if (!fs.existsSync(cachePath))
            return true;
        const raw = fs.readFileSync(cachePath, 'utf-8');
        const cache = JSON.parse(raw);
        return Date.now() - cache.lastCheck >= exports.COOLDOWN_MS;
    }
    catch {
        return true;
    }
}
/**
 * Query the npm registry for the latest published version.
 */
function fetchLatestVersion() {
    return new Promise((resolve, reject) => {
        const req = https.get(REGISTRY_URL, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve(data.version);
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
    });
}
function writeCache() {
    const cachePath = getCachePath();
    const dir = path.dirname(cachePath);
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const cache = { lastCheck: Date.now() };
        fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');
    }
    catch {
        // Silently ignore cache write failures
    }
}
/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareSemver(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
        if (diff < 0)
            return -1;
        if (diff > 0)
            return 1;
    }
    return 0;
}
/**
 * Detect whether the process is running from a global npm install
 * (as opposed to a local dev checkout via `ts-node`, `tsx`, etc.).
 */
function isGlobalInstall() {
    const execPath = process.argv[1] || '';
    // Global installs run from a path containing node_modules
    // Local dev runs from the source tree (no node_modules/.bin in argv[1])
    const globalIndicators = ['/lib/node_modules/', '\\node_modules\\lazy-gravity\\'];
    return globalIndicators.some((indicator) => execPath.includes(indicator));
}
/**
 * Non-blocking update check. Call at startup (fire-and-forget).
 * Respects a 24-hour cooldown via a local cache file.
 * Skipped when running from source (dev/local checkout).
 */
async function checkForUpdates(currentVersion) {
    if (!isGlobalInstall())
        return;
    if (!shouldCheckForUpdates())
        return;
    try {
        const latest = await fetchLatestVersion();
        writeCache();
        if (compareSemver(currentVersion, latest) < 0) {
            console.info(`\n  Update available: ${currentVersion} \u2192 ${latest} \u2014 run \x1b[36mnpm i -g lazy-gravity\x1b[0m\n`);
        }
    }
    catch {
        // Silently ignore — update check should never block startup
    }
}
