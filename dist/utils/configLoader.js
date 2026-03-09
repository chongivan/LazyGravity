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
exports.ConfigLoader = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
// Load .env at module init time (same as the original config.ts behavior).
// dotenv will NOT override already-set env vars by default.
dotenv.config();
const CONFIG_DIR_NAME = '.lazy-gravity';
const CONFIG_FILE_NAME = 'config.json';
const DEFAULT_DB_NAME = 'antigravity.db';
// ---------------------------------------------------------------------------
// Pure helpers (no side-effects)
// ---------------------------------------------------------------------------
function getConfigDir() {
    return path.join(os.homedir(), CONFIG_DIR_NAME);
}
function getConfigFilePath() {
    return path.join(getConfigDir(), CONFIG_FILE_NAME);
}
function getDefaultDbPath() {
    return path.join(getConfigDir(), DEFAULT_DB_NAME);
}
/** Expand leading `~` or `~/` to the user's home directory. */
function expandTilde(raw) {
    if (raw === '~')
        return os.homedir();
    if (raw.startsWith('~/'))
        return path.join(os.homedir(), raw.slice(2));
    return raw;
}
function readPersistedConfig(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}
/**
 * Merge layers with priority: env vars > persisted config > defaults.
 * Returns a fresh AppConfig object (immutable pattern).
 */
function mergeConfig(persisted) {
    // Resolve platforms FIRST so we only validate credentials for enabled platforms
    const platforms = resolvePlatforms(process.env.PLATFORMS, persisted.platforms);
    // Discord credentials — only required when Discord is an active platform
    let discordToken;
    let clientId;
    let allowedUserIds = [];
    if (platforms.includes('discord')) {
        discordToken = process.env.DISCORD_BOT_TOKEN ?? persisted.discordToken;
        if (!discordToken) {
            throw new Error('Missing required environment variable: DISCORD_BOT_TOKEN');
        }
        clientId = process.env.CLIENT_ID ?? persisted.clientId;
        if (!clientId) {
            throw new Error('Missing required environment variable: CLIENT_ID');
        }
        allowedUserIds = resolveAllowedUserIds(persisted);
        if (allowedUserIds.length === 0) {
            throw new Error('Missing required environment variable: ALLOWED_USER_IDS');
        }
    }
    const defaultDir = path.join(os.homedir(), 'Code');
    const rawDir = process.env.WORKSPACE_BASE_DIR ?? persisted.workspaceBaseDir ?? defaultDir;
    const workspaceBaseDir = expandTilde(rawDir);
    const guildId = process.env.GUILD_ID ?? persisted.guildId ?? undefined;
    const autoApproveFileEdits = resolveBoolean(process.env.AUTO_APPROVE_FILE_EDITS, persisted.autoApproveFileEdits, false);
    const logLevel = resolveLogLevel(process.env.LOG_LEVEL, persisted.logLevel);
    const extractionMode = resolveExtractionMode(process.env.EXTRACTION_MODE, persisted.extractionMode);
    // Telegram credentials — only required when Telegram is an active platform
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN ?? persisted.telegramToken ?? undefined;
    const telegramAllowedUserIds = resolveTelegramAllowedUserIds(persisted);
    if (platforms.includes('telegram') && !telegramToken) {
        throw new Error('TELEGRAM_BOT_TOKEN is required when platforms include "telegram"');
    }
    return {
        discordToken,
        clientId,
        guildId,
        allowedUserIds,
        workspaceBaseDir,
        autoApproveFileEdits,
        logLevel,
        extractionMode,
        telegramToken,
        telegramAllowedUserIds,
        platforms,
    };
}
function resolveAllowedUserIds(persisted) {
    const envValue = process.env.ALLOWED_USER_IDS;
    if (envValue) {
        return envValue
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
    }
    if (persisted.allowedUserIds && persisted.allowedUserIds.length > 0) {
        return [...persisted.allowedUserIds];
    }
    return [];
}
const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'none'];
function resolveLogLevel(envValue, persistedValue) {
    const raw = envValue?.toLowerCase() ?? persistedValue;
    if (raw && VALID_LOG_LEVELS.includes(raw)) {
        return raw;
    }
    return 'info';
}
function resolveExtractionMode(envValue, persistedValue) {
    const raw = envValue ?? persistedValue;
    if (raw === 'legacy')
        return 'legacy';
    return 'structured';
}
function resolveTelegramAllowedUserIds(persisted) {
    const envValue = process.env.TELEGRAM_ALLOWED_USER_IDS;
    if (envValue) {
        return envValue
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
    }
    if (persisted.telegramAllowedUserIds && persisted.telegramAllowedUserIds.length > 0) {
        return [...persisted.telegramAllowedUserIds];
    }
    return undefined;
}
const VALID_PLATFORMS = ['discord', 'telegram'];
function resolvePlatforms(envValue, persistedValue) {
    if (envValue) {
        const parsed = envValue
            .split(',')
            .map((p) => p.trim().toLowerCase())
            .filter((p) => VALID_PLATFORMS.includes(p));
        if (parsed.length > 0)
            return parsed;
    }
    if (persistedValue && persistedValue.length > 0) {
        const validated = persistedValue.filter((p) => VALID_PLATFORMS.includes(p));
        if (validated.length > 0)
            return validated;
    }
    return ['discord'];
}
function resolveBoolean(envValue, persistedValue, defaultValue) {
    if (envValue !== undefined)
        return envValue.toLowerCase() === 'true';
    if (persistedValue !== undefined)
        return persistedValue;
    return defaultValue;
}
// ---------------------------------------------------------------------------
// Public API (ConfigLoader namespace)
// ---------------------------------------------------------------------------
exports.ConfigLoader = {
    /** Return the config directory path (~/.lazy-gravity/). */
    getConfigDir,
    /** Return the full path to config.json. */
    getConfigFilePath,
    /** Return the default database file path (~/.lazy-gravity/antigravity.db). */
    getDefaultDbPath,
    /** Check whether ~/.lazy-gravity/config.json exists on disk. */
    configExists() {
        return fs.existsSync(getConfigFilePath());
    },
    /** Read persisted config from disk. Returns empty object if file doesn't exist. */
    readPersisted() {
        return readPersistedConfig(getConfigFilePath());
    },
    /**
     * Load config using resolution order:
     *   env vars  >  ~/.lazy-gravity/config.json  >  .env  >  defaults
     */
    load(persistedOverride) {
        const persisted = persistedOverride ?? readPersistedConfig(getConfigFilePath());
        return mergeConfig(persisted);
    },
    /**
     * Persist the given config to ~/.lazy-gravity/config.json.
     * Creates the directory if it doesn't exist.
     */
    save(config) {
        const dir = getConfigDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Merge with existing persisted config so partial saves are additive
        const existing = readPersistedConfig(getConfigFilePath());
        const merged = { ...existing, ...config };
        fs.writeFileSync(getConfigFilePath(), JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    },
};
