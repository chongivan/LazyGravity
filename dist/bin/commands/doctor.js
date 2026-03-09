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
exports.doctorAction = doctorAction;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cdpPorts_1 = require("../../utils/cdpPorts");
const configLoader_1 = require("../../utils/configLoader");
const pathUtils_1 = require("../../utils/pathUtils");
const logger_1 = require("../../utils/logger");
const ok = (msg) => console.log(`  ${logger_1.COLORS.green}[OK]${logger_1.COLORS.reset} ${msg}`);
const warn = (msg) => console.log(`  ${logger_1.COLORS.yellow}[--]${logger_1.COLORS.reset} ${msg}`);
const fail = (msg) => console.log(`  ${logger_1.COLORS.red}[!!]${logger_1.COLORS.reset} ${msg}`);
const hint = (msg) => console.log(`       ${logger_1.COLORS.dim}${msg}${logger_1.COLORS.reset}`);
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
function checkEnvFile() {
    const envPath = path.resolve(process.cwd(), '.env');
    return { exists: fs.existsSync(envPath), path: envPath };
}
const VALID_PLATFORMS = ['discord', 'telegram'];
function getActivePlatforms() {
    const raw = process.env.PLATFORMS || 'discord';
    return raw
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter((p) => VALID_PLATFORMS.includes(p));
}
function checkRequiredEnvVars() {
    const platforms = getActivePlatforms();
    const required = [];
    if (platforms.includes('discord')) {
        required.push('DISCORD_BOT_TOKEN', 'CLIENT_ID', 'ALLOWED_USER_IDS');
    }
    if (platforms.includes('telegram')) {
        required.push('TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS');
    }
    return required.map((name) => ({
        name,
        set: Boolean(process.env[name]),
    }));
}
async function doctorAction() {
    console.log(`\n${logger_1.COLORS.cyan}lazy-gravity doctor${logger_1.COLORS.reset}\n`);
    let allOk = true;
    // 1. Config directory check
    const configDir = configLoader_1.ConfigLoader.getConfigDir();
    if (fs.existsSync(configDir)) {
        ok(`Config directory exists: ${configDir}`);
    }
    else {
        warn(`Config directory not found: ${configDir}`);
        hint('Run: lazy-gravity setup  (optional if using .env)');
    }
    // 2. Config file check
    const configFilePath = configLoader_1.ConfigLoader.getConfigFilePath();
    if (configLoader_1.ConfigLoader.configExists()) {
        ok(`Config file found: ${configFilePath}`);
    }
    else {
        warn(`Config file not found: ${configFilePath} (optional — .env fallback used)`);
    }
    // 3. .env file check
    const env = checkEnvFile();
    if (env.exists) {
        // Load .env so subsequent checks can see the variables
        require('dotenv').config({ path: env.path });
        ok(`.env file found: ${env.path}`);
    }
    else {
        if (!configLoader_1.ConfigLoader.configExists()) {
            fail(`.env file not found: ${env.path}`);
            allOk = false;
        }
        else {
            warn(`.env file not found: ${env.path} (not needed — config.json used)`);
        }
    }
    // 4. Required environment variables (platform-aware)
    const platforms = getActivePlatforms();
    ok(`Active platforms: ${platforms.join(', ')}`);
    const vars = checkRequiredEnvVars();
    for (const v of vars) {
        if (v.set) {
            ok(`${v.name} is set`);
        }
        else {
            fail(`${v.name} is NOT set`);
            allOk = false;
        }
    }
    // 5. CDP port check
    console.log(`\n  ${logger_1.COLORS.dim}Checking CDP ports...${logger_1.COLORS.reset}`);
    let cdpOk = false;
    for (const port of cdpPorts_1.CDP_PORTS) {
        const alive = await checkPort(port);
        if (alive) {
            ok(`CDP port ${port} is responding`);
            cdpOk = true;
        }
    }
    if (!cdpOk) {
        fail('No CDP ports responding');
        hint(`Run: ${(0, pathUtils_1.getAntigravityCdpHint)(9222)}`);
        allOk = false;
    }
    // 6. Node.js version check
    const nodeVersion = process.versions.node;
    const major = parseInt(nodeVersion.split('.')[0], 10);
    if (major >= 18) {
        ok(`Node.js ${nodeVersion}`);
    }
    else {
        fail(`Node.js ${nodeVersion} (>= 18.0.0 required)`);
        allOk = false;
    }
    // Summary
    console.log('');
    if (allOk) {
        console.log(`  ${logger_1.COLORS.green}All checks passed!${logger_1.COLORS.reset}`);
    }
    else {
        console.log(`  ${logger_1.COLORS.red}Some checks failed. Please fix the issues above.${logger_1.COLORS.reset}`);
        process.exitCode = 1;
    }
}
