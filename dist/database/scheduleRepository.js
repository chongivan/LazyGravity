"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleRepository = void 0;
/**
 * Repository class for SQLite persistence of scheduled jobs.
 * Handles saving, retrieving, updating, and deleting cron expressions and prompts.
 */
class ScheduleRepository {
    db;
    constructor(db) {
        this.db = db;
        this.initialize();
    }
    /**
     * Initialize table (create if not exists)
     */
    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cron_expression TEXT NOT NULL,
                prompt TEXT NOT NULL,
                workspace_path TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);
    }
    /**
     * Create a new schedule
     */
    create(input) {
        const stmt = this.db.prepare(`
            INSERT INTO schedules (cron_expression, prompt, workspace_path, enabled)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(input.cronExpression, input.prompt, input.workspacePath, input.enabled ? 1 : 0);
        return {
            id: result.lastInsertRowid,
            cronExpression: input.cronExpression,
            prompt: input.prompt,
            workspacePath: input.workspacePath,
            enabled: input.enabled,
        };
    }
    /**
     * Get all schedules
     */
    findAll() {
        const rows = this.db.prepare('SELECT * FROM schedules ORDER BY id ASC').all();
        return rows.map(this.mapRow);
    }
    /**
     * Get a schedule by ID
     */
    findById(id) {
        const row = this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    /**
     * Get only enabled schedules (for re-registration on bot startup)
     */
    findEnabled() {
        const rows = this.db.prepare('SELECT * FROM schedules WHERE enabled = 1 ORDER BY id ASC').all();
        return rows.map(this.mapRow);
    }
    /**
     * Delete a schedule
     */
    delete(id) {
        const result = this.db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
        return result.changes > 0;
    }
    /**
     * Partially update a schedule
     */
    update(id, input) {
        const sets = [];
        const values = [];
        if (input.cronExpression !== undefined) {
            sets.push('cron_expression = ?');
            values.push(input.cronExpression);
        }
        if (input.prompt !== undefined) {
            sets.push('prompt = ?');
            values.push(input.prompt);
        }
        if (input.workspacePath !== undefined) {
            sets.push('workspace_path = ?');
            values.push(input.workspacePath);
        }
        if (input.enabled !== undefined) {
            sets.push('enabled = ?');
            values.push(input.enabled ? 1 : 0);
        }
        if (sets.length === 0)
            return false;
        values.push(id);
        const sql = `UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    /**
     * Map a DB row to ScheduleRecord
     */
    mapRow(row) {
        return {
            id: row.id,
            cronExpression: row.cron_expression,
            prompt: row.prompt,
            workspacePath: row.workspace_path,
            enabled: row.enabled === 1,
            createdAt: row.created_at,
        };
    }
}
exports.ScheduleRepository = ScheduleRepository;
