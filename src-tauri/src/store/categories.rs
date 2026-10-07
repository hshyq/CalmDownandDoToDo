//! store::categories —— 分类读写（SQL 收口本模块）。
//!
//! 规则：kind=`normal` 可增删改；kind=`uncategorized`（未分类）固定不可删不可改名（PRD 4.1/6.1）。
//! 删除二选一：cascade（连同事项删）/ move_to_uncategorized（事项移入未分类）；字段模板随分类删除（PRD 6.2）。
//! 注：写操作经 undo 包装在 P7 统一接入（红线 4，批次计划 P7）。

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;

use super::{Error, Result};

/// 分类（与前端 `services/types.ts` 对齐）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
    pub kind: String, // "normal" | "uncategorized"
}

/// 删除分类时的处理模式（PRD 6.2 二选一）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeleteMode {
    Cascade,
    MoveToUncategorized,
}

impl DeleteMode {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "cascade" => Some(DeleteMode::Cascade),
            "move_to_uncategorized" => Some(DeleteMode::MoveToUncategorized),
            _ => None,
        }
    }
}

/// 首次启动种子（PRD 4.1：预置 生活/工作/娱乐/学习 + 固定 未分类）。
/// 用 app_settings 标志保证只播种一次；若库中已有分类（如导入备份）则跳过。
pub fn ensure_seeded(conn: &mut Connection) -> Result<()> {
    let done: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'seed_categories'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if done.is_some() {
        return Ok(());
    }

    let tx = conn.transaction()?;
    let count: i64 = tx.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;
    if count == 0 {
        // 颜色与原型演示一致（UI 契约）
        let seeds: [(&str, &str, i64, &str); 5] = [
            ("生活", "#34B96F", 0, "normal"),
            ("工作", "#4F8EF7", 1, "normal"),
            ("娱乐", "#F5A623", 2, "normal"),
            ("学习", "#9B59B6", 3, "normal"),
            ("未分类", "#9E9E9E", 1000, "uncategorized"),
        ];
        for (name, color, sort, kind) in seeds {
            tx.execute(
                "INSERT INTO categories (name, color, sort_order, kind) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![name, color, sort, kind],
            )?;
        }
    }
    tx.execute(
        "INSERT INTO app_settings (key, value) VALUES ('seed_categories', '1')
         ON CONFLICT(key) DO NOTHING",
        [],
    )?;
    tx.commit()?;
    Ok(())
}

/// 全部分类按排序返回（普通在前按 sort；未分类 sort 大故沉底）。
pub fn list(conn: &Connection) -> Result<Vec<Category>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, sort_order, kind FROM categories ORDER BY sort_order ASC, id ASC",
    )?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        sort_order: row.get(3)?,
        kind: row.get(4)?,
    })
}

/// 新建普通分类：追加到末尾（sort = 当前最大 + 1）；颜色由前端按色盘传入（可重复，PRD 4.1）。
pub fn create(conn: &Connection, name: &str, color: &str) -> Result<Category> {
    let next_sort: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order) + 1, 0) FROM categories",
        [],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO categories (name, color, sort_order, kind) VALUES (?1, ?2, ?3, 'normal')",
        rusqlite::params![name, color, next_sort],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Category> {
    conn.query_row(
        "SELECT id, name, color, sort_order, kind FROM categories WHERE id = ?1",
        [id],
        map_row,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Error::Business("分类不存在".to_string()),
        other => Error::Sqlite(other),
    })
}

/// 重命名（未分类不可重命名由命令层/此处拦截）。
pub fn rename(conn: &Connection, id: i64, name: &str) -> Result<()> {
    let affected = conn.execute(
        "UPDATE categories SET name = ?2 WHERE id = ?1 AND kind = 'normal'",
        rusqlite::params![id, name],
    )?;
    if affected == 0 {
        return Err(Error::Business(
            "分类不存在或不可重命名（未分类固定）".to_string(),
        ));
    }
    Ok(())
}

/// 设置颜色（未分类也可设置颜色，PRD 4.1）。
pub fn set_color(conn: &Connection, id: i64, color: &str) -> Result<()> {
    let affected = conn.execute(
        "UPDATE categories SET color = ?2 WHERE id = ?1",
        rusqlite::params![id, color],
    )?;
    if affected == 0 {
        return Err(Error::Business("分类不存在".to_string()));
    }
    Ok(())
}

/// 单行 sort 更新（撤销/重做恢复用）。
pub fn set_sort(conn: &Connection, id: i64, sort_order: i64) -> Result<()> {
    let affected = conn.execute(
        "UPDATE categories SET sort_order = ?2 WHERE id = ?1",
        rusqlite::params![id, sort_order],
    )?;
    if affected == 0 {
        return Err(Error::Business("分类不存在".to_string()));
    }
    Ok(())
}

/// 拖拽重排（v1.28 ④）：仅普通分类参与，按传入 id 顺序重写 sort_order（0 起步递增）；
/// 未分类不参与且事务内保持在普通分类之后（沉底）。传入集合须=全部普通分类 id 且无重复。
pub fn reorder(conn: &mut Connection, ordered_ids: &[i64]) -> Result<()> {
    let normal_total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM categories WHERE kind = 'normal'",
        [],
        |r| r.get(0),
    )?;
    if ordered_ids.len() as i64 != normal_total {
        return Err(Error::Business(
            "分类顺序数据不完整，请刷新后重试".to_string(),
        ));
    }
    let mut seen = std::collections::HashSet::new();
    for id in ordered_ids {
        if !seen.insert(*id) {
            return Err(Error::Business(
                "分类顺序数据重复，请刷新后重试".to_string(),
            ));
        }
    }
    let tx = conn.transaction()?;
    for (i, id) in ordered_ids.iter().enumerate() {
        let n = tx.execute(
            "UPDATE categories SET sort_order = ?2 WHERE id = ?1 AND kind = 'normal'",
            rusqlite::params![id, i as i64],
        )?;
        if n == 0 {
            return Err(Error::Business(
                "分类不存在或不可排序（未分类固定）".to_string(),
            ));
        }
    }
    // 防御：未分类排序值紧跟普通分类最大值之后，保证 ORDER BY 沉底
    tx.execute(
        "UPDATE categories SET sort_order = \
         (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories WHERE kind = 'normal') \
         WHERE kind = 'uncategorized'",
        [],
    )?;
    tx.commit()?;
    Ok(())
}

/// 删除分类（PRD 6.2 / TC-CL-003~005）。未分类不可删除。
pub fn delete(conn: &mut Connection, id: i64, mode: DeleteMode) -> Result<()> {
    let cat = get(conn, id)?;
    if cat.kind == "uncategorized" {
        return Err(Error::Business("未分类不可删除".to_string()));
    }

    let tx = conn.transaction()?;
    match mode {
        DeleteMode::Cascade => {
            // items 无 ON DELETE CASCADE，需显式删除；field_defs/item_field_values 由 FK 级联。
            tx.execute("DELETE FROM items WHERE category_id = ?1", [id])?;
        }
        DeleteMode::MoveToUncategorized => {
            let uncat: Option<i64> = tx
                .query_row(
                    "SELECT id FROM categories WHERE kind = 'uncategorized' LIMIT 1",
                    [],
                    |r| r.get(0),
                )
                .optional()?;
            let uncat =
                uncat.ok_or_else(|| Error::Business("未找到「未分类」，无法移入".to_string()))?;
            tx.execute(
                "UPDATE items SET category_id = ?2 WHERE category_id = ?1",
                rusqlite::params![id, uncat],
            )?;
        }
    }
    tx.execute("DELETE FROM categories WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::schema;

    fn db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("外键失败");
        schema::migrate(&mut conn).expect("迁移失败");
        ensure_seeded(&mut conn).expect("种子失败");
        conn
    }

    #[test]
    fn seed_creates_presets_and_marks_done() {
        let conn = db();
        let cats = list(&conn).expect("查询失败");
        assert_eq!(cats.len(), 5);
        assert_eq!(cats[4].kind, "uncategorized");
        assert_eq!(cats[4].name, "未分类");

        // 再次播种应幂等（标志已写）
        let mut conn2 = conn;
        ensure_seeded(&mut conn2).expect("重复播种失败");
        assert_eq!(list(&conn2).expect("查询失败").len(), 5);
    }

    #[test]
    fn reorder_updates_sort_and_validates() {
        // 拖拽重排（v1.28 ④）：仅普通分类参与、未分类始终沉底；非法输入整批拒绝
        let mut conn = db();
        let seed = |conn: &Connection| {
            list(conn)
                .expect("查询失败")
                .into_iter()
                .filter(|c| c.kind == "normal")
                .map(|c| (c.id, c.name))
                .collect::<Vec<_>>()
        };
        let cats = seed(&conn);
        assert_eq!(cats.len(), 4); // 生活/工作/娱乐/学习

        // 逆序重排：未分类仍在最后
        let ids: Vec<i64> = cats.iter().rev().map(|(id, _)| *id).collect();
        reorder(&mut conn, &ids).expect("重排失败");
        let after = list(&conn).expect("查询失败");
        let names: Vec<&str> = after.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, vec!["学习", "娱乐", "工作", "生活", "未分类"]);
        let normal_sorts: Vec<i64> = after
            .iter()
            .filter(|c| c.kind == "normal")
            .map(|c| c.sort_order)
            .collect();
        assert_eq!(normal_sorts, vec![0, 1, 2, 3]);
        assert!(after.last().expect("非空").sort_order > 3);

        // 非法输入：数量不齐 / 未知 id / 重复 id / 混入未分类
        let uncat = after
            .iter()
            .find(|c| c.kind == "uncategorized")
            .expect("未分类存在")
            .id;
        assert!(reorder(&mut conn, &ids[..3]).is_err());
        assert!(reorder(&mut conn, &[ids[0], ids[1], ids[2], 99999]).is_err());
        assert!(reorder(&mut conn, &[ids[0], ids[1], ids[2], ids[2]]).is_err());
        assert!(reorder(&mut conn, &[ids[0], ids[1], ids[2], uncat]).is_err());

        // set_sort 单行更新与存在校验
        set_sort(&conn, ids[0], 42).expect("更新失败");
        assert_eq!(get(&conn, ids[0]).expect("查询失败").sort_order, 42);
        assert!(set_sort(&conn, 99999, 0).is_err());
    }

    #[test]
    fn create_appends_at_end() {
        let conn = db();
        let c = create(&conn, "健身", "#FF7EB6").expect("新建失败");
        let cats = list(&conn).expect("查询失败");
        assert_eq!(cats.len(), 6);
        let last = cats.last().expect("非空");
        assert_eq!(last.name, "健身");
        assert!(last.sort_order > cats[3].sort_order);
        assert_eq!(c.kind, "normal");
    }

    #[test]
    fn rename_and_set_color() {
        let conn = db();
        let c = create(&conn, "临时", "#FF7EB6").expect("新建失败");
        rename(&conn, c.id, "新名").expect("改名失败");
        assert_eq!(get(&conn, c.id).expect("查询失败").name, "新名");

        set_color(&conn, c.id, "#123456").expect("改色失败");
        assert_eq!(get(&conn, c.id).expect("查询失败").color, "#123456");

        // 未分类不可改名
        let uncat = list(&conn)
            .expect("查询失败")
            .into_iter()
            .find(|x| x.kind == "uncategorized")
            .expect("有未分类");
        assert!(rename(&conn, uncat.id, "x").is_err());
    }

    #[test]
    fn delete_cascade_removes_items() {
        let mut conn = db();
        let cat = create(&conn, "工作A", "#4F8EF7").expect("新建失败");
        conn.execute(
            "INSERT INTO items (category_id, title) VALUES (?1, '任务')",
            [cat.id],
        )
        .expect("插入事项失败");
        delete(&mut conn, cat.id, DeleteMode::Cascade).expect("级联删除失败");
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM items WHERE category_id = ?1",
                [cat.id],
                |r| r.get(0),
            )
            .expect("查询失败");
        assert_eq!(n, 0);
        assert!(get(&conn, cat.id).is_err());
    }

    #[test]
    fn delete_move_to_uncategorized() {
        let mut conn = db();
        let cat = create(&conn, "工作B", "#4F8EF7").expect("新建失败");
        conn.execute(
            "INSERT INTO items (category_id, title) VALUES (?1, '任务B')",
            [cat.id],
        )
        .expect("插入事项失败");
        let uncat_id = list(&conn)
            .expect("查询失败")
            .into_iter()
            .find(|x| x.kind == "uncategorized")
            .expect("有未分类")
            .id;
        delete(&mut conn, cat.id, DeleteMode::MoveToUncategorized).expect("移入失败");

        // 分类已删、事项改挂未分类且标题仍在
        assert!(get(&conn, cat.id).is_err());
        let title: String = conn
            .query_row(
                "SELECT title FROM items WHERE category_id = ?1",
                [uncat_id],
                |r| r.get(0),
            )
            .expect("查询事项失败");
        assert_eq!(title, "任务B");
    }

    #[test]
    fn delete_uncategorized_forbidden() {
        let mut conn = db();
        let uncat = list(&conn)
            .expect("查询失败")
            .into_iter()
            .find(|x| x.kind == "uncategorized")
            .expect("有未分类");
        assert!(delete(&mut conn, uncat.id, DeleteMode::Cascade).is_err());
    }
}
