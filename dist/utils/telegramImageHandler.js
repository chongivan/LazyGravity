"use strict";
/**
 * Telegram image download utility.
 *
 * Downloads photos from Telegram Bot API and saves them to a temp directory,
 * producing InboundImageAttachment[] that can be passed to
 * cdp.injectMessageWithImageFiles().
 *
 * Reuses shared types and helpers from imageHandler.ts.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadTelegramPhotos = downloadTelegramPhotos;
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const imageHandler_1 = require("./imageHandler");
const logger_1 = require("./logger");
const MAX_TELEGRAM_IMAGE_ATTACHMENTS = 4;
const TEMP_IMAGE_DIR = path.join(os.tmpdir(), 'lazy-gravity-images');
/**
 * Extract the Telegram file_id from a telegram-file:// URL.
 * Returns null if the URL doesn't match the expected scheme.
 */
function extractFileId(url) {
    const prefix = 'telegram-file://';
    if (!url.startsWith(prefix))
        return null;
    return url.slice(prefix.length);
}
/**
 * Download Telegram photo attachments to local temp files.
 *
 * Uses the Telegram Bot API getFile endpoint to resolve file_id → file_path,
 * then downloads the file via https://api.telegram.org/file/bot<token>/<path>.
 *
 * @param attachments - PlatformAttachment[] from the wrapped Telegram message
 * @param botToken - The bot token for constructing download URLs
 * @param api - The bot API object (needs getFile method)
 * @returns Downloaded images as InboundImageAttachment[]
 */
async function downloadTelegramPhotos(attachments, botToken, api) {
    if (!api.getFile) {
        logger_1.logger.warn('[TelegramImageHandler] bot.api.getFile is not available');
        return [];
    }
    const imageAttachments = attachments
        .filter((att) => (att.contentType || '').startsWith('image/'))
        .slice(0, MAX_TELEGRAM_IMAGE_ATTACHMENTS);
    if (imageAttachments.length === 0)
        return [];
    await fs.mkdir(TEMP_IMAGE_DIR, { recursive: true });
    const downloaded = [];
    for (let i = 0; i < imageAttachments.length; i++) {
        const attachment = imageAttachments[i];
        const fileId = extractFileId(attachment.url);
        if (!fileId) {
            logger_1.logger.warn(`[TelegramImageHandler] Invalid file URL: ${attachment.url}`);
            continue;
        }
        try {
            // Resolve file_id to file_path via Bot API
            const fileInfo = await api.getFile(fileId);
            if (!fileInfo.file_path) {
                logger_1.logger.warn(`[TelegramImageHandler] No file_path returned for file_id=${fileId}`);
                continue;
            }
            // Download the file
            const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                logger_1.logger.warn(`[TelegramImageHandler] Download failed (file_id=${fileId}, status=${response.status})`);
                continue;
            }
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length === 0)
                continue;
            const mimeType = attachment.contentType || 'image/jpeg';
            const ext = (0, imageHandler_1.mimeTypeToExtension)(mimeType);
            const name = (0, imageHandler_1.sanitizeFileName)(attachment.name || `telegram-photo-${i + 1}.${ext}`);
            const localPath = path.join(TEMP_IMAGE_DIR, `${Date.now()}-tg-${i}-${name}`);
            await fs.writeFile(localPath, bytes);
            downloaded.push({
                localPath,
                url: downloadUrl,
                name,
                mimeType,
            });
        }
        catch (error) {
            logger_1.logger.warn(`[TelegramImageHandler] Failed to download photo (file_id=${fileId}):`, error?.message || error);
        }
    }
    return downloaded;
}
