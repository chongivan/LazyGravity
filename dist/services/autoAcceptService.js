"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoAcceptService = void 0;
const i18n_1 = require("../utils/i18n");
class AutoAcceptService {
    enabled;
    constructor(initialEnabled = false) {
        this.enabled = initialEnabled;
    }
    isEnabled() {
        return this.enabled;
    }
    handle(rawAction) {
        const action = this.normalizeAction(rawAction);
        if (!action) {
            return {
                success: false,
                enabled: this.enabled,
                changed: false,
                message: (0, i18n_1.t)('⚠️ Invalid argument. Usage: `/autoaccept [on/off/status]`'),
            };
        }
        if (action === 'status') {
            return {
                success: true,
                enabled: this.enabled,
                changed: false,
                message: (0, i18n_1.t)(`⚙️ Auto-accept mode: **${this.enabled ? 'ON' : 'OFF'}**`),
            };
        }
        if (action === 'on') {
            if (this.enabled) {
                return {
                    success: true,
                    enabled: true,
                    changed: false,
                    message: (0, i18n_1.t)('ℹ️ Auto-accept mode is already **ON**.'),
                };
            }
            this.enabled = true;
            return {
                success: true,
                enabled: true,
                changed: true,
                message: (0, i18n_1.t)('✅ Auto-accept mode turned **ON**. Future dialogs will be auto-allowed.'),
            };
        }
        if (!this.enabled) {
            return {
                success: true,
                enabled: false,
                changed: false,
                message: (0, i18n_1.t)('ℹ️ Auto-accept mode is already **OFF**.'),
            };
        }
        this.enabled = false;
        return {
            success: true,
            enabled: false,
            changed: true,
            message: (0, i18n_1.t)('✅ Auto-accept mode turned **OFF**. Returned to manual approval.'),
        };
    }
    normalizeAction(rawAction) {
        if (!rawAction || rawAction.trim().length === 0)
            return 'status';
        const normalized = rawAction.trim().toLowerCase();
        if (['on', 'enable', 'enabled', 'true', '1'].includes(normalized)) {
            return 'on';
        }
        if (['off', 'disable', 'disabled', 'false', '0'].includes(normalized)) {
            return 'off';
        }
        if (['status', 'state', 'show'].includes(normalized)) {
            return 'status';
        }
        return null;
    }
}
exports.AutoAcceptService = AutoAcceptService;
