"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModeService = exports.DEFAULT_MODE = exports.MODE_UI_NAME_REVERSE = exports.MODE_UI_NAMES = exports.MODE_DESCRIPTIONS = exports.MODE_DISPLAY_NAMES = exports.AVAILABLE_MODES = void 0;
const i18n_1 = require("../utils/i18n");
/**
 * Available execution modes
 * fast: Fast response mode (for simple tasks)
 * plan: Planning mode (execute complex tasks step by step)
 */
exports.AVAILABLE_MODES = ['fast', 'plan'];
/** Mode display name mapping */
exports.MODE_DISPLAY_NAMES = {
    fast: '⚡ Fast',
    plan: '📋 Plan',
};
/** Mode description mapping */
exports.MODE_DESCRIPTIONS = {
    fast: (0, i18n_1.t)('Fast Mode — for simple tasks'),
    plan: (0, i18n_1.t)('Plan Mode — for complex step-by-step tasks'),
};
/** Antigravity UI display name mapping (internal name -> UI display name) */
exports.MODE_UI_NAMES = {
    fast: 'Fast',
    plan: 'Planning',
};
/** Reverse mapping from UI display name -> internal name */
exports.MODE_UI_NAME_REVERSE = Object.fromEntries(Object.entries(exports.MODE_UI_NAMES).map(([k, v]) => [v.toLowerCase(), k]));
/** Default execution mode */
exports.DEFAULT_MODE = 'fast';
/**
 * Service class for managing execution modes.
 * Handles mode switching via the /mode command.
 */
class ModeService {
    currentMode = exports.DEFAULT_MODE;
    pendingSync = false;
    /**
     * Get the current execution mode
     */
    getCurrentMode() {
        return this.currentMode;
    }
    /**
     * Check if the current mode is pending sync to Antigravity
     */
    isPendingSync() {
        return this.pendingSync;
    }
    /**
     * Mark the pending mode as synced (clears pendingSync flag)
     */
    markSynced() {
        this.pendingSync = false;
    }
    /**
     * Switch execution mode
     * @param modeName Mode name to set (case-insensitive)
     * @param synced Whether the mode has been synced to Antigravity (default: false)
     */
    setMode(modeName, synced = false) {
        if (!modeName || modeName.trim() === '') {
            return {
                success: false,
                error: (0, i18n_1.t)('⚠️ Mode name not specified. Available modes: ') + exports.AVAILABLE_MODES.join(', '),
            };
        }
        const normalized = modeName.trim().toLowerCase();
        if (!exports.AVAILABLE_MODES.includes(normalized)) {
            return {
                success: false,
                error: (0, i18n_1.t)(`⚠️ Invalid mode "${modeName}". Available modes: ${exports.AVAILABLE_MODES.join(', ')}`),
            };
        }
        this.currentMode = normalized;
        this.pendingSync = !synced;
        return {
            success: true,
            mode: this.currentMode,
        };
    }
    /**
     * Get the list of available modes
     */
    getAvailableModes() {
        return exports.AVAILABLE_MODES;
    }
}
exports.ModeService = ModeService;
