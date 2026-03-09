"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressSender = void 0;
class ProgressSender {
    throttleMs;
    maxLength;
    wrapInCodeBlock;
    buffer = '';
    timer = null;
    sendContent;
    constructor(options) {
        if (!options.send && !options.message) {
            throw new Error('ProgressSender requires either message or send option');
        }
        this.sendContent = options.send
            ? options.send
            : async (content) => options.message.reply({ content });
        this.throttleMs = options.throttleMs ?? 3000;
        this.maxLength = options.maxLength ?? 4000;
        this.wrapInCodeBlock = options.wrapInCodeBlock ?? true;
    }
    append(text) {
        this.buffer += text;
        if (!this.timer) {
            this.timer = setTimeout(() => {
                this.emit();
            }, this.throttleMs);
        }
    }
    forceEmit() {
        this.emit();
    }
    emit() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (!this.buffer)
            return;
        const payload = this.buffer;
        this.buffer = '';
        const chunks = this.splitByLength(payload, this.maxLength);
        for (const chunk of chunks) {
            const content = this.wrapInCodeBlock ? `\`\`\`\n${chunk}\n\`\`\`` : chunk;
            this.sendContent(content).catch(() => { });
        }
    }
    splitByLength(text, maxLength) {
        if (text.length <= maxLength) {
            return [text];
        }
        const result = [];
        let cursor = 0;
        while (cursor < text.length) {
            result.push(text.slice(cursor, cursor + maxLength));
            cursor += maxLength;
        }
        return result;
    }
}
exports.ProgressSender = ProgressSender;
