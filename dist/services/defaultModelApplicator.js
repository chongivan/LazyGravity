"use strict";
/**
 * Single-responsibility module for applying the user's default model
 * preference when a CDP session connects.
 *
 * Strategy: exact match only — no fuzzy matching to avoid selecting
 * the wrong model after Antigravity renames a model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDefaultModel = applyDefaultModel;
const logger_1 = require("../utils/logger");
/**
 * Apply the user's default model preference to a CDP session.
 *
 * 1. Read modelService.getDefaultModel() — if null, skip
 * 2. Read cdp.getCurrentModel() — if already matches, skip (mark synced)
 * 3. Get available models via cdp.getUiModels()
 * 4. Exact match → cdp.setUiModel() → mark synced
 * 5. No match → return stale result with message + available model list
 */
async function applyDefaultModel(cdp, modelService) {
    const defaultModel = modelService.getDefaultModel();
    if (!defaultModel) {
        return { applied: false, modelName: null, stale: false, staleMessage: null };
    }
    const currentModel = await cdp.getCurrentModel();
    if (currentModel && currentModel.toLowerCase() === defaultModel.toLowerCase()) {
        modelService.markSynced();
        logger_1.logger.debug(`[DefaultModelApplicator] Already on default model: ${defaultModel}`);
        return { applied: true, modelName: defaultModel, stale: false, staleMessage: null };
    }
    const availableModels = await cdp.getUiModels();
    const exactMatch = availableModels.find(m => m.toLowerCase() === defaultModel.toLowerCase());
    if (exactMatch) {
        const result = await cdp.setUiModel(exactMatch);
        if (result.ok) {
            modelService.markSynced();
            logger_1.logger.debug(`[DefaultModelApplicator] Applied default model: ${exactMatch}`);
            return { applied: true, modelName: exactMatch, stale: false, staleMessage: null };
        }
        logger_1.logger.warn(`[DefaultModelApplicator] setUiModel failed: ${result.error}`);
        return { applied: false, modelName: defaultModel, stale: false, staleMessage: null };
    }
    // No exact match — model is stale
    const availableList = availableModels.join(', ');
    const staleMessage = `Saved default model "${defaultModel}" is no longer available. Available models: ${availableList}`;
    logger_1.logger.warn(`[DefaultModelApplicator] ${staleMessage}`);
    return {
        applied: false,
        modelName: defaultModel,
        stale: true,
        staleMessage,
    };
}
