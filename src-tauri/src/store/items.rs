//! store::items —— 事项读写（SQL 收口本模块）。
//!
//! 归属不落库，由查询条件表达（PRD 5.1）。写操作经 undo 包装在 P7 统一接入。

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;

use super::validation;
use super::{Error, Result};

/// 事项（与前端 services/types.ts 对齐；含全部标准字段）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Item {
    pub id: i64,
    pub category_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub start_time: Option<String>,
    pub end_date: Option<String>,
    pub end_time: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub created_at: String,
}

/// 新增事项入参（借用，避免参数过长）。
#[derive(Debug, Clone)]
pub struct NewItem<'a> {
    pub category_id: i64,
    pub title: &'a str,
    pub description: Option<&'a str>,
    pub start_date: Option<&'a str>,
    pub start_time: Option<&'a str>,
    pub end_date: Option<&'a str>,
    pub end_time: Option<&'a str>,
    pub due_date: Option<&'a str>,
    pub due_time: Option<&'a str>,
}

/// 编辑事项入参（可换分类，PRD 6.4）。
pub type ItemUpdate<'a> = NewItem<'a>;

/// 应用层校验：标题、日期/时刻成对、结束不早于开始（PRD 4.2/6.3）。
pub fn validate_input<'a>(
    title: &str,
    start_date: Option<&'a str>,
    start_time: Option<&'a str>,
    end_date: Option<&'a str>,
    end_time: Option<&'a str>,
    due_date: Option<&'a str>,
    due_time: Option<&'a str>,
) -> Result<()> {
    validation::validate_item_title(title).map_err(Error::Business)?;
    validation::check_date_time_pair(start_date, start_time, "开始时间")
        .map_err(Error::Business)?;
    validation::check_date_time_pair(end_date, end_time, "结束时间").map_err(Error::Business)?;
    validation::check_date_time_pair(due_date, due_time, "截止时间").map_err(Error::Business)?;
    validation::check_end_not_before_start(start_date, end_date).map_err(Error::Business)?;
    Ok(())
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Item> {
    Ok(Item {
        id: row.get(0)?,
        category_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        start_date: row.get(4)?,
        start_time: row.get(5)?,
        end_date: row.get(6)?,
        end_time: row.get(7)?,
        due_date: row.get(8)?,
        due_time: row.get(9)?,
        created_at: row.get(10)?,
    })
}

const COLUMNS: &str = "id, category_id, title, description, start_date, start_time,
     end_date, end_time, due_date, due_time, created_at";

pub fn get(conn: &Connection, id: i64) -> Result<Item> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM items WHERE id = ?1"),
        [id],
        map_row,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Error::Business("事项不存在".to_string()),
        other => Error::Sqlite(other),
    })
}

/// 新增：先校验后入库，返回完整事项（含 id/created_at）。
pub fn create(conn: &Connection, new: &NewItem<'_>) -> Result<Item> {
    if !category_exists(conn, new.category_id)? {
        return Err(Error::Business("所属分类不存在".to_string()));
    }
    validate_input(
        new.title,
        new.start_date,
        new.start_time,
        new.end_date,
        new.end_time,
        new.due_date,
        new.due_time,
    )?;
    conn.execute(
        "INSERT INTO items (category_id, title, description, start_date, start_time,
                            end_date, end_time, due_date, due_time)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        rusqlite::params![
            new.category_id,
            new.title,
            new.description,
            new.start_date,
            new.start_time,
            new.end_date,
            new.end_time,
            new.due_date,
            new.due_time
        ],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

/// 编辑：可改分类；先校验后更新，返回更新后事项。
pub fn update(conn: &Connection, id: i64, upd: &ItemUpdate<'_>) -> Result<Item> {
    if !category_exists(conn, upd.category_id)? {
        return Err(Error::Business("所属分类不存在".to_string()));
    }
    validate_input(
        upd.title,
        upd.start_date,
        upd.start_time,
        upd.end_date,
        upd.end_time,
        upd.due_date,
        upd.due_time,
    )?;
    let affected = conn.execute(
        "UPDATE items SET category_id=?2, title=?3, description=?4,
                start_date=?5, start_time=?6, end_date=?7, end_time=?8,
                due_date=?9, due_time=?10
         WHERE id=?1",
        rusqlite::params![
            id,
            upd.category_id,
            upd.title,
            upd.description,
            upd.start_date,
            upd.start_time,
            upd.end_date,
            upd.end_time,
            upd.due_date,
            upd.due_time
        ],
    )?;
    if affected == 0 {
        return Err(Error::Business("事项不存在".to_string()));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    let affected = conn.execute("DELETE FROM items WHERE id = ?1", [id])?;
    if affected == 0 {
        return Err(Error::Business("事项不存在".to_string()));
    }
    Ok(())
}

/// 某分类下全部事项（过渡/管理用途；日历窗口与待办排序查询见 Db::list_*）。
pub fn list(conn: &Connection, category_id: Option<i64>) -> Result<Vec<Item>> {
    let sql = match category_id {
        Some(_) => format!("SELECT {COLUMNS} FROM items WHERE category_id = ?1 ORDER BY id ASC"),
        None => format!("SELECT {COLUMNS} FROM items ORDER BY id ASC"),
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = match category_id {
        Some(id) => stmt.query_map([id], map_row)?,
        None => stmt.query_map([], map_row)?,
    };
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// 校验用：分类是否存在。
pub fn category_exists(conn: &Connection, category_id: i64) -> Result<bool> {
    let n: Option<i64> = conn
        .query_row(
            "SELECT id FROM categories WHERE id = ?1",
            [category_id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(n.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::categories;
    use crate::store::schema;

    fn db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("外键失败");
        schema::migrate(&mut conn).expect("迁移失败");
        categories::ensure_seeded(&mut conn).expect("种子失败");
        conn
    }

    fn new<'a>(cat: i64, title: &'a str) -> NewItem<'a> {
        NewItem {
            category_id: cat,
            title,
            description: None,
            start_date: None,
            start_time: None,
            end_date: None,
            end_time: None,
            due_date: None,
            due_time: None,
        }
    }

    #[test]
    fn create_read_update_delete() {
        let conn = db();
        let work = categories::list(&conn)
            .expect("查询分类")
            .into_iter()
            .find(|c| c.name == "工作")
            .expect("有工作");

        let created = create(&conn, &new(work.id, "写周报")).expect("新增失败");
        assert_eq!(created.title, "写周报");
        assert_eq!(created.category_id, work.id);

        let fetched = get(&conn, created.id).expect("读取失败");
        assert_eq!(fetched, created);

        let mut upd = new(work.id, "写周报（修订）");
        upd.start_date = Some("2026-09-01");
        upd.start_time = Some("09:00");
        upd.end_date = Some("2026-09-01");
        upd.end_time = Some("10:00");
        upd.due_date = Some("2026-09-02");
        let after = update(&conn, created.id, &upd).expect("更新失败");
        assert_eq!(after.title, "写周报（修订）");
        assert_eq!(after.start_date.as_deref(), Some("2026-09-01"));
        assert_eq!(after.due_date.as_deref(), Some("2026-09-02"));

        delete(&conn, created.id).expect("删除失败");
        assert!(get(&conn, created.id).is_err());
    }

    #[test]
    fn validation_blocks_bad_input() {
        let conn = db();
        let work = categories::list(&conn)
            .expect("查询分类")
            .into_iter()
            .find(|c| c.name == "工作")
            .expect("有工作");

        assert!(create(&conn, &new(work.id, "  ")).is_err());
        let mut bad = new(work.id, "A");
        bad.start_time = Some("09:00");
        assert!(create(&conn, &bad).is_err());
        let mut bad2 = new(work.id, "B");
        bad2.start_date = Some("2026-09-05");
        bad2.end_date = Some("2026-09-01");
        assert!(create(&conn, &bad2).is_err());
    }

    #[test]
    fn update_nonexistent_fails() {
        let conn = db();
        let work = categories::list(&conn)
            .expect("查询分类")
            .into_iter()
            .find(|c| c.name == "工作")
            .expect("有工作");
        assert!(update(&conn, 99999, &new(work.id, "X")).is_err());
        assert!(delete(&conn, 99999).is_err());
    }
}
