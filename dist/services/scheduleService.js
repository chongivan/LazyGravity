"use strict";
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
exports.ScheduleService = void 0;
const cron = __importStar(require("node-cron"));
/**
 * Service class for managing scheduled jobs.
 *
 * - On bot startup, loads schedules from SQLite and re-registers them with node-cron
 * - Handles adding, removing, and listing schedules
 * - Provides bulk stop of all schedules (e.g. on shutdown)
 */
class ScheduleService {
    repo;
    /** Map managing active cron tasks (schedule ID -> ScheduledTask) */
    activeTasks = new Map();
    constructor(repo) {
        this.repo = repo;
    }
    /**
     * Called on bot startup. Loads all enabled schedules from DB and registers/resumes them with node-cron.
     *
     * @param jobCallback - Callback invoked when each job executes
     * @returns Number of restored schedules
     */
    restoreAll(jobCallback) {
        const enabledSchedules = this.repo.findEnabled();
        for (const schedule of enabledSchedules) {
            this.registerCronTask(schedule, jobCallback);
        }
        return enabledSchedules.length;
    }
    /**
     * Add a new schedule.
     * Processes in order: cron expression validation -> DB save -> node-cron registration.
     *
     * @param cronExpression - Cron expression
     * @param prompt - Prompt to execute
     * @param workspacePath - Target workspace path
     * @param jobCallback - Callback for job execution
     * @returns Created schedule record
     * @throws On invalid cron expression
     */
    addSchedule(cronExpression, prompt, workspacePath, jobCallback) {
        // Validate cron expression
        if (!cron.validate(cronExpression)) {
            throw new Error(`Invalid cron expression: ${cronExpression}`);
        }
        // Save to DB
        const record = this.repo.create({
            cronExpression,
            prompt,
            workspacePath,
            enabled: true,
        });
        // Register with node-cron
        this.registerCronTask(record, jobCallback);
        return record;
    }
    /**
     * Remove a schedule.
     * Stops the running cron job and deletes it from the DB.
     *
     * @param scheduleId - ID of the schedule to remove
     * @returns Whether the removal was successful
     */
    removeSchedule(scheduleId) {
        // Stop the running cron job
        const task = this.activeTasks.get(scheduleId);
        if (task) {
            task.stop();
            this.activeTasks.delete(scheduleId);
        }
        // Delete from DB
        return this.repo.delete(scheduleId);
    }
    /**
     * Stop all running cron jobs (called on bot shutdown)
     */
    stopAll() {
        for (const [id, task] of this.activeTasks) {
            task.stop();
        }
        this.activeTasks.clear();
    }
    /**
     * Get a list of all schedules
     */
    listSchedules() {
        return this.repo.findAll();
    }
    /**
     * Internal method to register a task with node-cron
     */
    registerCronTask(schedule, jobCallback) {
        const task = cron.schedule(schedule.cronExpression, () => {
            jobCallback(schedule);
        });
        this.activeTasks.set(schedule.id, task);
    }
}
exports.ScheduleService = ScheduleService;
