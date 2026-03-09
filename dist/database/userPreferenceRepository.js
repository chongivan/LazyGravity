"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferenceRepository = void 0;
/**
 * Repository class for SQLite persistence of per-user preferences.
 * Currently stores output format preference (embed vs plain text).
 */
class UserPreferenceRepository {
    db;
    constructor(db) {
        this.db = db;
        this.initialize();
    }
    /**
     * Initialize table (create if not exists) and run migrations
     */
    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                output_format TEXT NOT NULL DEFAULT 'embed',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);
        this.migrateDefaultModel();
    }
    /**
     * Safe migration: add default_model column if it does not exist.
     * Uses pragma when available, falls back to try/catch ALTER TABLE.
     */
    migrateDefaultModel() {
        if (typeof this.db.pragma === 'function') {
            const columns = this.db.pragma('table_info(user_preferences)');
            const hasColumn = columns.some(c => c.name === 'default_model');
            if (!hasColumn) {
                this.db.exec('ALTER TABLE user_preferences ADD COLUMN default_model TEXT DEFAULT NULL');
            }
        }
        else {
            // Fallback for mock/alternate DB implementations without pragma
            try {
                this.db.exec('ALTER TABLE user_preferences ADD COLUMN default_model TEXT DEFAULT NULL');
            }
            catch {
                // Column already exists — safe to ignore
            }
        }
    }
    /**
     * Get the output format preference for a user.
     * Returns 'embed' as default if no preference is stored.
     */
    getOutputFormat(userId) {
        const row = this.db.prepare('SELECT output_format FROM user_preferences WHERE user_id = ?').get(userId);
        if (!row)
            return 'embed';
        return row.output_format === 'plain' ? 'plain' : 'embed';
    }
    /**
     * Set the output format preference for a user (upsert).
     */
    setOutputFormat(userId, format) {
        this.db.prepare(`
            INSERT INTO user_preferences (user_id, output_format)
            VALUES (?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET output_format = excluded.output_format,
                          updated_at = datetime('now')
        `).run(userId, format);
    }
    /**
     * Get the default model for a user.
     * Returns null if no default is stored.
     */
    getDefaultModel(userId) {
        const row = this.db.prepare('SELECT default_model FROM user_preferences WHERE user_id = ?').get(userId);
        return row?.default_model ?? null;
    }
    /**
     * Set the default model for a user (upsert).
     * Pass null to clear the default.
     */
    setDefaultModel(userId, modelName) {
        this.db.prepare(`
            INSERT INTO user_preferences (user_id, default_model)
            VALUES (?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET default_model = excluded.default_model,
                          updated_at = datetime('now')
        `).run(userId, modelName);
    }
    /**
     * Get full preference record for a user
     */
    findByUserId(userId) {
        const row = this.db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    /**
     * Map a DB row to UserPreferenceRecord
     */
    mapRow(row) {
        return {
            id: row.id,
            userId: row.user_id,
            outputFormat: row.output_format,
            defaultModel: row.default_model ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
exports.UserPreferenceRepository = UserPreferenceRepository;
