"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMetadataFromFooter = extractMetadataFromFooter;
function extractMetadataFromFooter(footerText) {
    const result = {};
    const taskIdMatch = footerText.match(/TaskID:\s*([^\s|]+)/i);
    if (taskIdMatch && taskIdMatch[1]) {
        result.taskId = taskIdMatch[1];
    }
    const dirMatch = footerText.match(/Dir:\s*([^\s|]+)/i);
    if (dirMatch && dirMatch[1]) {
        result.directory = dirMatch[1];
    }
    return result;
}
