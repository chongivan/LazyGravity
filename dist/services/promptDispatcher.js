"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptDispatcher = void 0;
/**
 * Dispatcher that calls the existing sendPromptToAntigravity.
 * Unifies dependency injection on the caller side and simplifies event handlers.
 */
class PromptDispatcher {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async send(req) {
        await this.deps.sendPromptImpl(this.deps.bridge, req.message, req.prompt, req.cdp, this.deps.modeService, this.deps.modelService, req.inboundImages ?? [], req.options);
    }
}
exports.PromptDispatcher = PromptDispatcher;
