"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildScreenshotPayload = buildScreenshotPayload;
exports.handleScreenshot = handleScreenshot;
const discord_js_1 = require("discord.js");
const screenshotService_1 = require("../services/screenshotService");
/**
 * Build a platform-agnostic MessagePayload containing the screenshot.
 * Returns a payload with the screenshot as a file attachment, or an error text.
 */
async function buildScreenshotPayload(cdp) {
    if (!cdp) {
        return { text: 'Not connected to Antigravity.' };
    }
    try {
        const screenshot = new screenshotService_1.ScreenshotService({ cdpService: cdp });
        const result = await screenshot.capture({ format: 'png' });
        if (result.success && result.buffer) {
            const file = {
                name: 'screenshot.png',
                data: result.buffer,
                contentType: 'image/png',
            };
            return { files: [file] };
        }
        return { text: `Screenshot failed: ${result.error ?? 'Unknown error'}` };
    }
    catch (e) {
        return { text: `Screenshot error: ${e.message}` };
    }
}
/**
 * Capture a screenshot and send it to Discord
 */
async function handleScreenshot(target, cdp) {
    if (!cdp) {
        const content = 'Not connected to Antigravity.';
        if (target instanceof discord_js_1.Message) {
            await target.reply(content);
        }
        else {
            await target.editReply({ content });
        }
        return;
    }
    try {
        const screenshot = new screenshotService_1.ScreenshotService({ cdpService: cdp });
        const result = await screenshot.capture({ format: 'png' });
        if (result.success && result.buffer) {
            const attachment = new discord_js_1.AttachmentBuilder(result.buffer, { name: 'screenshot.png' });
            if (target instanceof discord_js_1.Message) {
                await target.reply({ files: [attachment] });
            }
            else {
                await target.editReply({ files: [attachment] });
            }
        }
        else {
            const content = `Screenshot failed: ${result.error}`;
            if (target instanceof discord_js_1.Message) {
                await target.reply(content);
            }
            else {
                await target.editReply({ content });
            }
        }
    }
    catch (e) {
        const content = `Screenshot error: ${e.message}`;
        if (target instanceof discord_js_1.Message) {
            await target.reply(content);
        }
        else {
            await target.editReply({ content });
        }
    }
}
