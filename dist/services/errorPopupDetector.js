"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorPopupDetector = void 0;
const logger_1 = require("../utils/logger");
const approvalDetector_1 = require("./approvalDetector");
/**
 * Detection script for the Antigravity UI error popup.
 *
 * Looks for dialog/modal containers containing error-related text patterns
 * like "agent terminated", "error", "failed", etc. and extracts popup info.
 */
const DETECT_ERROR_POPUP_SCRIPT = `(() => {
    const ERROR_PATTERNS = [
        'agent terminated',
        'terminated due to error',
        'unexpected error',
        'something went wrong',
        'an error occurred',
    ];

    const normalize = (text) => (text || '').toLowerCase().replace(/\\s+/g, ' ').trim();

    // Try dialog/modal first
    const dialogs = Array.from(document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"], .modal, .dialog'
    )).filter(el => el.offsetParent !== null || el.getAttribute('aria-modal') === 'true');

    // Fallback: look for fixed/absolute positioned overlays
    if (dialogs.length === 0) {
        const overlays = Array.from(document.querySelectorAll('div[class*="fixed"], div[class*="absolute"]'))
            .filter(el => {
                const style = window.getComputedStyle(el);
                return (style.position === 'fixed' || style.position === 'absolute')
                    && style.zIndex && parseInt(style.zIndex, 10) > 10
                    && el.querySelector('button');
            });
        dialogs.push(...overlays);
    }

    for (const dialog of dialogs) {
        const fullText = normalize(dialog.textContent || '');
        const isError = ERROR_PATTERNS.some(p => fullText.includes(p));
        if (!isError) continue;

        // Extract title from heading elements or first prominent text
        const headingEl = dialog.querySelector('h1, h2, h3, h4, [class*="title"], [class*="heading"]');
        const title = headingEl ? (headingEl.textContent || '').trim() : '';

        // Extract body text (excluding button text and title)
        const allButtons = Array.from(dialog.querySelectorAll('button'))
            .filter(btn => btn.offsetParent !== null);
        const buttonTexts = new Set(allButtons.map(btn => (btn.textContent || '').trim()));

        const bodyParts = [];
        const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const text = (node.textContent || '').trim();
            if (!text) continue;
            if (buttonTexts.has(text)) continue;
            if (text === title) continue;
            bodyParts.push(text);
        }
        const body = bodyParts.join(' ').slice(0, 1000);

        const buttons = allButtons.map(btn => (btn.textContent || '').trim()).filter(t => t.length > 0);

        if (buttons.length === 0) continue;

        return { title: title || 'Error', body, buttons };
    }

    return null;
})()`;
/**
 * Read clipboard content via navigator.clipboard.readText().
 * Requires awaitPromise=true since clipboard API returns a Promise.
 */
const READ_CLIPBOARD_SCRIPT = `(async () => {
    try {
        const text = await navigator.clipboard.readText();
        return text || null;
    } catch (e) {
        return null;
    }
})()`;
/**
 * Detects error popup dialogs (e.g. "Agent terminated due to error") in the
 * Antigravity UI via polling.
 *
 * Follows the same polling pattern as PlanningDetector / ApprovalDetector:
 * - start()/stop() lifecycle
 * - Duplicate notification prevention via lastDetectedKey
 * - Cooldown to suppress rapid re-detection
 * - CDP error tolerance (continues polling on error)
 */
class ErrorPopupDetector {
    cdpService;
    pollIntervalMs;
    onErrorPopup;
    onResolved;
    pollTimer = null;
    isRunning = false;
    /** Key of the last detected error popup (for duplicate notification prevention) */
    lastDetectedKey = null;
    /** Full ErrorPopupInfo from the last detection */
    lastDetectedInfo = null;
    /** Timestamp of last notification (for cooldown-based dedup) */
    lastNotifiedAt = 0;
    /** Cooldown period in ms to suppress duplicate notifications (10s for error popups) */
    static COOLDOWN_MS = 10000;
    constructor(options) {
        this.cdpService = options.cdpService;
        this.pollIntervalMs = options.pollIntervalMs ?? 3000;
        this.onErrorPopup = options.onErrorPopup;
        this.onResolved = options.onResolved;
    }
    /** Start monitoring. */
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.lastDetectedKey = null;
        this.lastDetectedInfo = null;
        this.lastNotifiedAt = 0;
        this.schedulePoll();
    }
    /** Stop monitoring. */
    async stop() {
        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }
    /** Return the last detected error popup info. Returns null if nothing has been detected. */
    getLastDetectedInfo() {
        return this.lastDetectedInfo;
    }
    /** Returns whether monitoring is currently active. */
    isActive() {
        return this.isRunning;
    }
    /**
     * Click the Dismiss button via CDP.
     * @returns true if click succeeded
     */
    async clickDismissButton() {
        return this.clickButton('Dismiss');
    }
    /**
     * Click the "Copy debug info" button via CDP.
     * @returns true if click succeeded
     */
    async clickCopyDebugInfoButton() {
        return this.clickButton('Copy debug info');
    }
    /**
     * Click the Retry button via CDP.
     * @returns true if click succeeded
     */
    async clickRetryButton() {
        return this.clickButton('Retry');
    }
    /**
     * Read clipboard content from the browser via navigator.clipboard.readText().
     * Should be called after clickCopyDebugInfoButton() with a short delay.
     * @returns Clipboard text or null if unavailable
     */
    async readClipboard() {
        try {
            const result = await this.runEvaluateScript(READ_CLIPBOARD_SCRIPT, true);
            return typeof result === 'string' ? result : null;
        }
        catch (error) {
            logger_1.logger.error('[ErrorPopupDetector] Error reading clipboard:', error);
            return null;
        }
    }
    /** Schedule the next poll. */
    schedulePoll() {
        if (!this.isRunning)
            return;
        this.pollTimer = setTimeout(async () => {
            await this.poll();
            if (this.isRunning) {
                this.schedulePoll();
            }
        }, this.pollIntervalMs);
    }
    /**
     * Single poll iteration:
     *   1. Detect error popup from DOM (with contextId)
     *   2. Notify via callback only on new detection (prevent duplicates)
     *   3. Reset lastDetectedKey / lastDetectedInfo when popup disappears
     */
    async poll() {
        try {
            const contextId = this.cdpService.getPrimaryContextId();
            const callParams = {
                expression: DETECT_ERROR_POPUP_SCRIPT,
                returnByValue: true,
                awaitPromise: false,
            };
            if (contextId !== null) {
                callParams.contextId = contextId;
            }
            const result = await this.cdpService.call('Runtime.evaluate', callParams);
            const info = result?.result?.value ?? null;
            if (info) {
                // Duplicate prevention: use title + body snippet as key
                const key = `${info.title}::${info.body.slice(0, 100)}`;
                const now = Date.now();
                const withinCooldown = (now - this.lastNotifiedAt) < ErrorPopupDetector.COOLDOWN_MS;
                if (key !== this.lastDetectedKey && !withinCooldown) {
                    this.lastDetectedKey = key;
                    this.lastDetectedInfo = info;
                    this.lastNotifiedAt = now;
                    this.onErrorPopup(info);
                }
                else if (key === this.lastDetectedKey) {
                    // Same key -- update stored info silently
                    this.lastDetectedInfo = info;
                }
            }
            else {
                // Reset when popup disappears (prepare for next detection)
                const wasDetected = this.lastDetectedKey !== null;
                this.lastDetectedKey = null;
                this.lastDetectedInfo = null;
                if (wasDetected && this.onResolved) {
                    this.onResolved();
                }
            }
        }
        catch (error) {
            // Ignore CDP errors and continue monitoring
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('WebSocket is not connected')) {
                return;
            }
            logger_1.logger.error('[ErrorPopupDetector] Error during polling:', error);
        }
    }
    /** Internal click handler using buildClickScript from approvalDetector. */
    async clickButton(buttonText) {
        try {
            const result = await this.runEvaluateScript((0, approvalDetector_1.buildClickScript)(buttonText));
            return result?.ok === true;
        }
        catch (error) {
            logger_1.logger.error('[ErrorPopupDetector] Error while clicking button:', error);
            return false;
        }
    }
    /** Execute Runtime.evaluate with contextId and return result.value. */
    async runEvaluateScript(expression, awaitPromise = false) {
        const contextId = this.cdpService.getPrimaryContextId();
        const callParams = {
            expression,
            returnByValue: true,
            awaitPromise,
        };
        if (contextId !== null) {
            callParams.contextId = contextId;
        }
        const result = await this.cdpService.call('Runtime.evaluate', callParams);
        return result?.result?.value;
    }
}
exports.ErrorPopupDetector = ErrorPopupDetector;
