import { t } from "../utils/i18n";

/**
 * Available LLM models
 * Aligned with models selectable in the Antigravity (Cursor fork) UI
 * Note: Models may change with Antigravity version updates
 */
export const AVAILABLE_MODELS = [
    'gemini-3.1-pro-high',
    'gemini-3.1-pro-low',
    'gemini-3-flash',
    'claude-sonnet-4.6-thinking',
    'claude-opus-4.6-thinking',
    'gpt-oss-120b-medium'
] as const;

/** Default LLM model */
export const DEFAULT_MODEL: Model = 'gemini-3-flash';

/** Model type definition */
export type Model = typeof AVAILABLE_MODELS[number];

/** Model set result type definition */
export interface ModelSetResult {
    success: boolean;
    model?: Model;
    error?: string;
}

/** Default model set result type definition */
export interface DefaultModelSetResult {
    success: boolean;
    defaultModel: string | null;
}

/**
 * Service class for managing LLM models.
 * Handles model switching via the /model command.
 */
export class ModelService {
    private currentModel: Model = DEFAULT_MODEL;
    private defaultModel: string | null = null;
    private pendingSync: boolean = false;

    /**
     * Get the current LLM model
     */
    public getCurrentModel(): Model {
        return this.currentModel;
    }

    /**
     * Check if the current model is pending sync to Antigravity
     */
    public isPendingSync(): boolean {
        return this.pendingSync;
    }

    /**
     * Mark the pending model as synced (clears pendingSync flag)
     */
    public markSynced(): void {
        this.pendingSync = false;
    }

    /**
     * Switch LLM model
     * @param modelName Model name to set (case-insensitive)
     * @param synced Whether the model has been synced to Antigravity (default: false)
     */
    public setModel(modelName: string, synced: boolean = false): ModelSetResult {
        if (!modelName || modelName.trim() === '') {
            return {
                success: false,
                error: t('⚠️ Model name not specified. Available models: ') + AVAILABLE_MODELS.join(', '),
            };
        }

        const normalized = modelName.trim().toLowerCase() as Model;

        if (!AVAILABLE_MODELS.includes(normalized)) {
            return {
                success: false,
                error: t(`⚠️ Invalid model "${modelName}". Available models: ${AVAILABLE_MODELS.join(', ')}`),
            };
        }

        this.currentModel = normalized;
        this.pendingSync = !synced;
        return {
            success: true,
            model: this.currentModel,
        };
    }

    /**
     * Get the list of available models
     */
    public getAvailableModels(): readonly string[] {
        return AVAILABLE_MODELS;
    }

    /**
     * Get the default model name (free-text, may not match AVAILABLE_MODELS)
     */
    public getDefaultModel(): string | null {
        return this.defaultModel;
    }

    /**
     * Set the default model name (free-text, persisted via DB separately)
     * @param name Model name or null to clear
     */
    public setDefaultModel(name: string | null): DefaultModelSetResult {
        this.defaultModel = name ? name.trim() : null;
        return { success: true, defaultModel: this.defaultModel };
    }

    /**
     * Load the default model from an external source (e.g. DB).
     * Only sets the in-memory value if not already set.
     */
    public loadDefaultModel(name: string | null): void {
        if (this.defaultModel === null && name) {
            this.defaultModel = name.trim();
        }
    }
}
