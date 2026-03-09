"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManager = void 0;
const child_process_1 = require("child_process");
class ProcessManager {
    maxConcurrentTasks;
    queue = [];
    runningProcesses = new Map();
    constructor(maxConcurrentTasks = 1) {
        this.maxConcurrentTasks = maxConcurrentTasks;
    }
    async submitTask(options) {
        this.queue.push(options);
        this.runNext();
    }
    runNext() {
        if (this.runningProcesses.size >= this.maxConcurrentTasks) {
            return;
        }
        const nextTask = this.queue.shift();
        if (!nextTask) {
            return;
        }
        const { id, command, args, cwd, onStdout, onStderr, onClose } = nextTask;
        const child = (0, child_process_1.spawn)(command, args, { cwd });
        this.runningProcesses.set(id, child);
        child.stdout?.on('data', (data) => {
            if (onStdout) {
                onStdout(data.toString());
            }
        });
        child.stderr?.on('data', (data) => {
            if (onStderr) {
                onStderr(data.toString());
            }
        });
        child.on('close', (code) => {
            this.runningProcesses.delete(id);
            if (onClose) {
                onClose(code ?? 0);
            }
            this.runNext();
        });
    }
    stopTask(taskId) {
        const child = this.runningProcesses.get(taskId);
        if (child) {
            child.kill();
            this.runningProcesses.delete(taskId);
            return true;
        }
        // Check if queued
        const indexInQueue = this.queue.findIndex((task) => task.id === taskId);
        if (indexInQueue !== -1) {
            this.queue.splice(indexInQueue, 1);
            return true;
        }
        return false;
    }
}
exports.ProcessManager = ProcessManager;
