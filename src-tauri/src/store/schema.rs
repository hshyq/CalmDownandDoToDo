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
        // v2：日期类型覆盖项（PRD 5.5 v1.12）：work/rest/holiday；
        // 未指定的日期不落库，按周一~五工作日、周六日休息日推算。
        (
            2,
            r#"
CREATE TABLE day_types (
    date     TEXT PRIMARY KEY,
    day_type TEXT NOT NULL
);
"#,
        ),
        // v3：自定义字段全局化 + 分类可见性（PRD 4.3 v1.17）。
        // 字段定义不再挂分类（重建 field_defs 去掉 category_id）；
        // 可见性由 category_fields 决定；存量字段迁移后仅对其原所属分类可见。
        (
            3,
            r#"
CREATE TABLE category_fields (
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    field_id    INTEGER NOT NULL REFERENCES field_defs(id) ON DELETE CASCADE,
    PRIMARY KEY (category_id, field_id)
);

INSERT INTO category_fields (category_id, field_id)
    SELECT category_id, id FROM field_defs;

CREATE TABLE field_defs_new (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,
    options_json TEXT,
    sort_order   INTEGER NOT NULL
);
INSERT INTO field_defs_new (id, name, type, options_json, sort_order)
    SELECT id, name, type, options_json, sort_order FROM field_defs;
DROP TABLE field_defs;
ALTER TABLE field_defs_new RENAME TO field_defs;
CREATE INDEX idx_field_defs_sort ON field_defs(sort_order);
"#,
        ),
    ]
}

/// 应用全部未执行的迁移（幂等）。表重建类迁移需要临时关闭外键，结束后恢复为 ON。
pub fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.execute_batch(MIGRATION_TABLE)?;

    // 取已应用的最大版本（空表视为 0，避免 NULL 列类型问题）。
    let applied: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    let pending: Vec<(i64, &'static str)> = migrations()
        .into_iter()
        .filter(|(version, _)| *version > applied)
        .collect();
    if pending.is_empty() {
        return Ok(());
    }

    // PRAGMA foreign_keys 不能在事务内切换；表重建（v3）期间临时关闭，迁移完恢复。
    conn.pragma_update(None, "foreign_keys", "OFF")?;
    for (version, sql) in pending {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [version],
        )?;
        tx.commit()?;
    }
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 迁移幂等：同库重复迁移不报错，版本记录与迁移数一致。
    #[test]
    fn migrate_is_idempotent() {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        migrate(&mut conn).expect("首次迁移失败");
        let first: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .expect("查询版本数失败");
        assert_eq!(first, 3, "v1+v2+v3 三条迁移");

        migrate(&mut conn).expect("重复迁移失败");
        let second: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .expect("查询版本数失败");
        assert_eq!(second, first, "重复迁移不新增版本记录");
    }

    /// v3 迁移：field_defs 全局化（无 category_id 列），存量字段原分类可见。
    #[test]
    fn v3_migrates_fields_to_global_with_visibility() {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        // 仅应用到 v2：手工搭出 v1+v2 的旧结构并造存量字段
        conn.execute_batch(MIGRATION_TABLE).expect("迁移表失败");
        for (version, sql) in migrations().into_iter().filter(|(v, _)| *v <= 2) {
            conn.execute_batch(sql).expect("应用旧迁移失败");
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?1)",
                [version],
            )
            .expect("记录版本失败");
        }
        conn.execute(
            "INSERT INTO categories (name, color, sort_order, kind) VALUES ('生活', '#34B96F', 0, 'normal')",
            [],
        )
        .expect("建分类失败");
        conn.execute(
            "INSERT INTO field_defs (category_id, name, type, options_json, sort_order)
             VALUES (1, '花费', 'number', NULL, 1)",
            [],
        )
        .expect("建旧字段失败");

        migrate(&mut conn).expect("v3 迁移失败");

        // field_defs 不再有 category_id 列
        let has_cat_col: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('field_defs') WHERE name = 'category_id'",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map(|n| n > 0)
            .expect("查列失败");
        assert!(!has_cat_col, "category_id 列应已移除");
        // 可见性迁移：原分类可见
        let vis: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM category_fields WHERE category_id = 1 AND field_id = 1",
                [],
                |r| r.get(0),
            )
            .expect("查可见性失败");
        assert_eq!(vis, 1, "存量字段应仅对原分类可见");
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
            "category_fields",
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
