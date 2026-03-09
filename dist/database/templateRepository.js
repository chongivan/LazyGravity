"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateRepository = void 0;
/**
 * Repository class for SQLite persistence of frequently used prompt templates.
 * Handles template creation, retrieval, updating, and deletion.
 */
class TemplateRepository {
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
            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                prompt TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);
    }
    /**
     * Create a new template
     */
    create(input) {
        const stmt = this.db.prepare(`
            INSERT INTO templates (name, prompt)
            VALUES (?, ?)
        `);
        const result = stmt.run(input.name, input.prompt);
        return {
            id: result.lastInsertRowid,
            name: input.name,
            prompt: input.prompt,
        };
    }
    /**
     * Get all templates
     */
    findAll() {
        const rows = this.db.prepare('SELECT * FROM templates ORDER BY id ASC').all();
        return rows.map(this.mapRow);
    }
    /**
     * Find by ID
     */
    findById(id) {
        const row = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    /**
     * Find by template name
     */
    findByName(name) {
        const row = this.db.prepare('SELECT * FROM templates WHERE name = ?').get(name);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    /**
     * Delete by template name
     */
    deleteByName(name) {
        const result = this.db.prepare('DELETE FROM templates WHERE name = ?').run(name);
        return result.changes > 0;
    }
    /**
     * Partially update by template name
     */
    updateByName(name, input) {
        const sets = [];
        const values = [];
        if (input.prompt !== undefined) {
            sets.push('prompt = ?');
            values.push(input.prompt);
        }
        if (sets.length === 0)
            return false;
        values.push(name);
        const sql = `UPDATE templates SET ${sets.join(', ')} WHERE name = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    /**
     * Map a DB row to TemplateRecord
     */
    mapRow(row) {
        return {
            id: row.id,
            name: row.name,
            prompt: row.prompt,
            createdAt: row.created_at,
        };
    }
}
exports.TemplateRepository = TemplateRepository;
