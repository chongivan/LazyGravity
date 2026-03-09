"use strict";
/**
 * Platform-agnostic ButtonAction for model selection interactions.
 *
 * Handles:
 *   model_btn_<name>  — Switch to the specified model
 *   model_refresh_btn — Refresh the model list UI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModelButtonAction = createModelButtonAction;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const modelsUi_1 = require("../ui/modelsUi");
const logger_1 = require("../utils/logger");
function createModelButtonAction(deps) {
    return {
        match(customId) {
            if (customId === 'model_refresh_btn') {
                return { action: 'refresh' };
            }
            if (customId === 'model_set_default_btn') {
                return { action: 'set_default' };
            }
            if (customId === 'model_clear_default_btn') {
                return { action: 'clear_default' };
            }
            if (customId.startsWith('model_btn_')) {
                return { action: 'select', modelName: customId.slice('model_btn_'.length) };
            }
            return null;
        },
        async execute(interaction, params) {
            await interaction.deferUpdate();
            const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(deps.bridge);
            if (!cdp) {
                await interaction.followUp({ text: 'Not connected to CDP.' }).catch(() => { });
                return;
            }
            if (params.action === 'set_default') {
                const currentModel = await cdp.getCurrentModel();
                if (!currentModel) {
                    await interaction.followUp({ text: 'No current model detected.' }).catch(() => { });
                    return;
                }
                if (deps.modelService) {
                    deps.modelService.setDefaultModel(currentModel);
                }
                if (deps.userPrefRepo) {
                    deps.userPrefRepo.setDefaultModel(interaction.user.id, currentModel);
                }
                await refreshModelsUI(cdp, deps, interaction);
                await interaction.followUp({
                    text: `Default model set to ${currentModel}.`,
                }).catch(() => { });
            }
            else if (params.action === 'clear_default') {
                if (deps.modelService) {
                    deps.modelService.setDefaultModel(null);
                }
                if (deps.userPrefRepo) {
                    deps.userPrefRepo.setDefaultModel(interaction.user.id, null);
                }
                await refreshModelsUI(cdp, deps, interaction);
                await interaction.followUp({
                    text: 'Default model cleared.',
                }).catch(() => { });
            }
            else if (params.action === 'select') {
                const res = await cdp.setUiModel(params.modelName);
                if (!res.ok) {
                    await interaction.followUp({
                        text: res.error || 'Failed to change model.',
                    }).catch(() => { });
                    return;
                }
                // Refresh UI after model change
                await refreshModelsUI(cdp, deps, interaction);
                await interaction.followUp({
                    text: `Model changed to ${res.model}.`,
                }).catch(() => { });
            }
            else {
                // refresh
                await refreshModelsUI(cdp, deps, interaction);
            }
        },
    };
}
async function refreshModelsUI(cdp, actionDeps, interaction) {
    try {
        const models = await cdp.getUiModels();
        const currentModel = await cdp.getCurrentModel();
        const quotaData = await actionDeps.fetchQuota();
        const defaultModel = actionDeps.modelService?.getDefaultModel() ?? null;
        const payload = (0, modelsUi_1.buildModelsPayload)(models, currentModel, quotaData, defaultModel);
        if (payload) {
            await interaction.update(payload);
        }
    }
    catch (err) {
        logger_1.logger.warn('[ModelButton] Failed to refresh models UI:', err?.message || err);
    }
}
