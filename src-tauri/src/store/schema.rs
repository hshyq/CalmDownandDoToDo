//! schema 迁移管理（AGENTS 红线 7：只增不改历史迁移，用 schema_migrations 管理）。
//!
//! 约定：版本号单调递增；每条迁移在事务内执行并记录版本，重复打开同一库幂等。

use rusqlite::Connection;

/// 数据库文件内的迁移记录表。
const MIGRATION_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)"#;

/// 全部迁移（版本号升序）。**历史迁移禁止修改**，新结构变更只能追加新版本。
fn migrations() -> Vec<(i64, &'static str)> {
    vec![
        // v1：一期全表（技术方案 3.1；items.created_at 为待办"同时刻按创建时间"排序所需）
        (
            1,
            r#"
CREATE TABLE categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'normal'
);

CREATE TABLE items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    title       TEXT NOT NULL,
    description TEXT,
    start_date  TEXT,
    start_time  TEXT,
    end_date    TEXT,
    end_time    TEXT,
    due_date    TEXT,
    due_time    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_items_cat   ON items(category_id);
CREATE INDEX idx_items_dates ON items(start_date, end_date);
CREATE INDEX idx_items_due   ON items(due_date, due_time);

CREATE TABLE field_defs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,
    options_json TEXT,
    sort_order   INTEGER NOT NULL
);

CREATE TABLE item_field_values (
    item_id      INTEGER NOT NULL REFERENCES items(id)      ON DELETE CASCADE,
    field_def_id INTEGER NOT NULL REFERENCES field_defs(id) ON DELETE CASCADE,
    value_json   TEXT,
    PRIMARY KEY (item_id, field_def_id)
);

CREATE TABLE app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"#,
        ),
    ]
}

/// 应用全部未执行的迁移（幂等）。`conn` 须已开启外键。
pub fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.execute_batch(MIGRATION_TABLE)?;

    // 取已应用的最大版本（空表视为 0，避免 NULL 列类型问题）。
    let applied: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    for (version, sql) in migrations() {
        if version <= applied {
            continue;
        }
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [version],
        )?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 迁移幂等：同库重复迁移不报错，版本记录只有一条。
    #[test]
    fn migrate_is_idempotent() {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        migrate(&mut conn).expect("首次迁移失败");
        let first: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .expect("查询版本数失败");
        assert_eq!(first, 1);

        migrate(&mut conn).expect("重复迁移失败");
        let second: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .expect("查询版本数失败");
        assert_eq!(second, 1);
    }

    /// v1 迁移应建齐一期表与索引。
    #[test]
    fn v1_creates_all_tables() {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        migrate(&mut conn).expect("迁移失败");

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') ORDER BY name")
            .expect("准备查询失败");
        let names: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .expect("查询失败")
            .collect::<Result<_, _>>()
            .expect("读取失败");

        for expected in [
            "app_settings",
            "categories",
            "field_defs",
            "idx_items_cat",
            "idx_items_dates",
            "idx_items_due",
            "item_field_values",
            "items",
            "schema_migrations",
        ] {
            assert!(names.iter().any(|n| n == expected), "缺少 {}", expected);
        }
    }
}
