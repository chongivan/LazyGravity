"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelService = exports.DEFAULT_MODEL = exports.AVAILABLE_MODELS = void 0;
const i18n_1 = require("../utils/i18n");
/**
 * Fallback model list used when CDP is not connected.
 * NOT used for validation — CDP is the sole source of truth
 * for available models. This list may become stale after
 * Antigravity updates.
 */
exports.AVAILABLE_MODELS = [
    'gemini-3.1-pro-high',
    'gemini-3.1-pro-low',
    'gemini-3-flash',
    'claude-sonnet-4.6-thinking',
    'claude-opus-4.6-thinking',
    'gpt-oss-120b-medium'
];
/** Default LLM model (initial value before CDP connects) */
exports.DEFAULT_MODEL = 'gemini-3-flash';
/**
 * Service class for managing LLM models.
 * Handles model switching via the /model command.
 *
 * Model validation is intentionally NOT performed here.
 * The actual model list is dynamic (fetched from CDP via
 * cdp.getUiModels()), so setModel() accepts any string.
 */
class ModelService {
    currentModel = exports.DEFAULT_MODEL;
    defaultModel = null;
    pendingSync = false;
    /**
     * Get the current LLM model
     */
    getCurrentModel() {
        return this.currentModel;
    }
    /**
     * Check if the current model is pending sync to Antigravity
     */
    isPendingSync() {
        return this.pendingSync;
    }
    /**
     * Mark the pending model as synced (clears pendingSync flag)
     */
    markSynced() {
        this.pendingSync = false;
    }
    /**
     * Switch LLM model.
     * Accepts any model name — validation happens at the CDP layer
     * (cdp.setUiModel) against the live model list.
     *
     * @param modelName Model name to set (case-insensitive)
     * @param synced Whether the model has been synced to Antigravity (default: false)
     */
    setModel(modelName, synced = false) {
        if (!modelName || modelName.trim() === '') {
            return {
                success: false,
                error: (0, i18n_1.t)('⚠️ Model name not specified.'),
            };
        }
        this.currentModel = modelName.trim().toLowerCase();
        this.pendingSync = !synced;
        return {
            success: true,
            model: this.currentModel,
        };
    }
    /**
     * Get the fallback list of available models.
     * Prefer cdp.getUiModels() when CDP is connected.
     */
    getAvailableModels() {
        return exports.AVAILABLE_MODELS;
    }
    /**
     * Get the default model name (free-text, may not match current CDP models)
     */
    getDefaultModel() {
        return this.defaultModel;
    }
    /**
     * Set the default model name (free-text, persisted via DB separately)
     * @param name Model name or null to clear
     */
    setDefaultModel(name) {
        this.defaultModel = name ? name.trim() : null;
        return { success: true, defaultModel: this.defaultModel };
    }
    /**
     * Load the default model from an external source (e.g. DB).
     * Only sets the in-memory value if not already set.
     */
    loadDefaultModel(name) {
        if (this.defaultModel === null && name) {
            this.defaultModel = name.trim();
        }
    }
}
exports.ModelService = ModelService;
