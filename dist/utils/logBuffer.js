"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logBuffer = exports.LogBuffer = void 0;
const MAX_ENTRIES = 200;
// Strip ANSI escape codes for clean buffer storage
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
function stripAnsi(text) {
    return text.replace(ANSI_REGEX, '');
}
class LogBuffer {
    buffer = [];
    head = 0;
    count = 0;
    append(level, message) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message: stripAnsi(message),
        };
        if (this.count < MAX_ENTRIES) {
            this.buffer.push(entry);
            this.count++;
        }
        else {
            this.buffer[this.head] = entry;
        }
        this.head = (this.head + 1) % MAX_ENTRIES;
    }
    getRecent(count, levelFilter) {
        const all = [];
        for (let i = 0; i < this.count; i++) {
            const idx = (this.head - this.count + i + MAX_ENTRIES * 2) % MAX_ENTRIES;
            all.push(this.buffer[idx]);
        }
        const filtered = levelFilter
            ? all.filter((e) => e.level === levelFilter)
            : all;
        return filtered.slice(-count);
    }
    clear() {
        this.buffer.length = 0;
        this.head = 0;
        this.count = 0;
    }
}
exports.LogBuffer = LogBuffer;
exports.logBuffer = new LogBuffer();
