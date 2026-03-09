"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenshotService = void 0;
const logger_1 = require("../utils/logger");
/**
 * Service for capturing Antigravity UI screenshots
 *
 * Uses the Chrome DevTools Protocol Page.captureScreenshot command
 * to capture the current browser screen and return it as a Buffer sendable to Discord.
 */
class ScreenshotService {
    cdpService;
    constructor(options) {
        this.cdpService = options.cdpService;
    }
    /**
     * Capture the current screen.
     *
     * @param options Capture options
     * @returns Capture result (Buffer on success, error message on failure)
     */
    async capture(options = {}) {
        try {
            const params = {
                format: options.format ?? 'png',
            };
            if (options.quality !== undefined) {
                params.quality = options.quality;
            }
            if (options.clip) {
                params.clip = options.clip;
            }
            if (options.captureBeyondViewport !== undefined) {
                params.captureBeyondViewport = options.captureBeyondViewport;
            }
            const result = await this.cdpService.callWithRetry('Page.captureScreenshot', params);
            const base64Data = result?.data ?? '';
            if (!base64Data) {
                return {
                    success: false,
                    error: 'Screenshot data was empty.',
                };
            }
            const buffer = Buffer.from(base64Data, 'base64');
            return {
                success: true,
                buffer,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('[ScreenshotService] Error during capture:', error);
            return {
                success: false,
                error: message,
            };
        }
    }
    /**
     * Return a Base64-encoded image string (for use in Discord embeds).
     *
     * @param options Capture options
     * @returns Base64-encoded image string (null on failure)
     */
    async getBase64(options = {}) {
        try {
            const params = {
                format: options.format ?? 'png',
            };
            if (options.quality !== undefined) {
                params.quality = options.quality;
            }
            if (options.clip) {
                params.clip = options.clip;
            }
            const result = await this.cdpService.callWithRetry('Page.captureScreenshot', params);
            return result?.data ?? null;
        }
        catch (error) {
            logger_1.logger.error('[ScreenshotService] Error while getting Base64:', error);
            return null;
        }
    }
}
exports.ScreenshotService = ScreenshotService;
