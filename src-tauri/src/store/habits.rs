//! store::habits —— 打卡项读写（PRD 6.11 v1.25；SQL 收口本模块）。
//!
//! 规则：打卡项是打卡记录（items.is_checkin=1）的归类实体；
//! 删除打卡项仅解除其打卡记录的打卡身份（事项保留，回到日历/待办正常展示）。
//! 注：写操作经 undo 包装在 commands 层接入（红线 4）。

use rusqlite::Connection;
use serde::Serialize;

use super::{Error, Result};

/// 打卡项（与前端 `services/types.ts` 对齐）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Habit {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
    pub created_at: String,
    /// 模板 JSON（v1.25 ③：默认分类/标题/字段值，带出用；None=未配置）。
    pub template_json: Option<String>,
}

/// 全部打卡项按排序返回。
pub fn list(conn: &Connection) -> Result<Vec<Habit>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, sort_order, created_at, template_json
         FROM habits ORDER BY sort_order ASC, id ASC",
    )?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Habit> {
    Ok(Habit {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        sort_order: row.get(3)?,
        created_at: row.get(4)?,
        template_json: row.get(5)?,
    })
}

/// 是否存在（items 打卡校验用）。
pub fn exists(conn: &Connection, id: i64) -> Result<bool> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM habits WHERE id = ?1", [id], |r| {
        r.get(0)
    })?;
    Ok(n > 0)
}

/// 名称是否已被占用（查重，排除自身）。
pub fn name_taken(conn: &Connection, name: &str, exclude_id: Option<i64>) -> Result<bool> {
    let n: i64 = match exclude_id {
        Some(id) => conn.query_row(
            "SELECT COUNT(*) FROM habits WHERE name = ?1 AND id != ?2",
            rusqlite::params![name, id],
            |r| r.get(0),
        )?,
        None => conn.query_row("SELECT COUNT(*) FROM habits WHERE name = ?1", [name], |r| {
            r.get(0)
        })?,
    };
    Ok(n > 0)
}

/// 新建：追加到末尾（sort = 当前最大 + 1）；名称唯一（schema UNIQUE 兜底 + 此处友好报错）。
pub fn create(conn: &Connection, name: &str, color: &str) -> Result<Habit> {
    if name.trim().is_empty() {
        return Err(Error::Business("打卡项名称不能为空".to_string()));
    }
    if name_taken(conn, name, None)? {
        return Err(Error::Business("已存在同名打卡项".to_string()));
    }
    let next_sort: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order) + 1, 0) FROM habits",
        [],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO habits (name, color, sort_order) VALUES (?1, ?2, ?3)",
        rusqlite::params![name.trim(), color, next_sort],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Habit> {
    conn.query_row(
        "SELECT id, name, color, sort_order, created_at, template_json FROM habits WHERE id = ?1",
        [id],
        map_row,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Error::Business("打卡项不存在".to_string()),
        other => Error::Sqlite(other),
    })
}

/// 重命名（全局生效：打卡记录按 id 关联，无需改历史）。
pub fn rename(conn: &Connection, id: i64, name: &str) -> Result<()> {
    if name.trim().is_empty() {
        return Err(Error::Business("打卡项名称不能为空".to_string()));
    }
    if name_taken(conn, name, Some(id))? {
        return Err(Error::Business("已存在同名打卡项".to_string()));
    }
    let affected = conn.execute(
        "UPDATE habits SET name = ?2 WHERE id = ?1",
        rusqlite::params![id, name.trim()],
    )?;
    if affected == 0 {
        return Err(Error::Business("打卡项不存在".to_string()));
    }
    Ok(())
}

pub fn set_color(conn: &Connection, id: i64, color: &str) -> Result<()> {
    let affected = conn.execute(
        "UPDATE habits SET color = ?2 WHERE id = ?1",
        rusqlite::params![id, color],
    )?;
    if affected == 0 {
        return Err(Error::Business("打卡项不存在".to_string()));
    }
    Ok(())
}

/// 设置/清除模板（v1.25 ③）：None 或空串=清除；非空须为合法 JSON 对象（结构由前端保证，此处做可解析防御）。
pub fn set_template(conn: &Connection, id: i64, template: Option<&str>) -> Result<()> {
    let value = match template {
        None => None,
        Some(s) if s.trim().is_empty() => None,
        Some(s) => {
            let v: serde_json::Value = serde_json::from_str(s)
                .map_err(|_| Error::Business("模板数据格式异常".to_string()))?;
            if !v.is_object() {
                return Err(Error::Business("模板数据格式异常".to_string()));
            }
            Some(s.to_string())
        }
    };
    let affected = conn.execute(
        "UPDATE habits SET template_json = ?2 WHERE id = ?1",
        rusqlite::params![id, value],
    )?;
    if affected == 0 {
        return Err(Error::Business("打卡项不存在".to_string()));
    }
    Ok(())
}

/// 删除打卡项：事务内先解除其打卡记录的身份（is_checkin=0、habit_id=NULL，事项保留），再删行。
/// 返回受影响（被解除身份）的事项 id 列表，供撤销快照恢复。
pub fn delete(conn: &mut Connection, id: i64) -> Result<Vec<i64>> {
    let _ = get(conn, id)?; // 确认存在
    let tx = conn.transaction()?;
    let affected: Vec<i64> = {
        let mut stmt = tx.prepare("SELECT id FROM items WHERE habit_id = ?1 AND is_checkin = 1")?;
        let rows = stmt.query_map([id], |r| r.get(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    tx.execute(
        "UPDATE items SET is_checkin = 0, habit_id = NULL WHERE habit_id = ?1",
        [id],
    )?;
    tx.execute("DELETE FROM habits WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(affected)
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
        // 事项含 category 外键，播种基础分类
        crate::store::categories::ensure_seeded(&mut conn).expect("种子失败");
        conn
    }

    #[test]
    fn create_rename_setcolor_roundtrip() {
        let conn = db();
        let h = create(&conn, "健身", "#F0883A").expect("新建失败");
        assert_eq!(h.name, "健身");
        assert_eq!(h.sort_order, 0);

        // 名称查重（含排除自身）
        assert!(create(&conn, "健身", "#000000").is_err());
        assert!(!name_taken(&conn, "健身", Some(h.id)).expect("查重失败"));

        rename(&conn, h.id, "运动").expect("改名失败");
        assert_eq!(get(&conn, h.id).expect("查询失败").name, "运动");
        set_color(&conn, h.id, "#123456").expect("改色失败");
        assert_eq!(get(&conn, h.id).expect("查询失败").color, "#123456");

        // 空名拒绝
        assert!(create(&conn, "  ", "#000000").is_err());
        assert!(rename(&conn, h.id, " ").is_err());
    }

    #[test]
    fn create_appends_in_order() {
        let conn = db();
        create(&conn, "A", "#111111").expect("新建失败");
        let b = create(&conn, "B", "#222222").expect("新建失败");
        let list = list(&conn).expect("查询失败");
        assert_eq!(list.len(), 2);
        assert_eq!(list.last().expect("非空").id, b.id);
        assert!(list[1].sort_order > list[0].sort_order);
    }

    #[test]
    fn template_set_clear_and_validate() {
        let conn = db();
        let h = create(&conn, "健身", "#F0883A").expect("新建失败");
        assert!(get(&conn, h.id).expect("查询失败").template_json.is_none());

        // 非法 JSON / 非对象拒绝
        assert!(set_template(&conn, h.id, Some("{bad")).is_err());
        assert!(set_template(&conn, h.id, Some("[1,2]")).is_err());

        // 合法对象存取往返；空串与 None 均为清除
        let tpl = r#"{"categoryId":1,"title":"健身房训练","values":{"13":"\"卧推\""}}"#;
        set_template(&conn, h.id, Some(tpl)).expect("设置模板失败");
        assert_eq!(
            get(&conn, h.id).expect("查询失败").template_json.as_deref(),
            Some(tpl)
        );
        set_template(&conn, h.id, Some("")).expect("清除失败");
        assert!(get(&conn, h.id).expect("查询失败").template_json.is_none());
        set_template(&conn, h.id, Some(tpl)).expect("再设置失败");
        set_template(&conn, h.id, None).expect("None 清除失败");
        assert!(get(&conn, h.id).expect("查询失败").template_json.is_none());

        // 不存在
        assert!(set_template(&conn, 99999, None).is_err());
    }

    #[test]
    fn delete_detaches_checkin_items() {
        let mut conn = db();
        let habit = create(&conn, "健身", "#F0883A").expect("新建失败");
        conn.execute(
            "INSERT INTO items (category_id, title, start_date, end_date, is_checkin, habit_id)
             VALUES (1, '打卡1', '2026-08-01', '2026-08-01', 1, ?1)",
            [habit.id],
        )
        .expect("插入打卡事项失败");
        conn.execute(
            "INSERT INTO items (category_id, title, habit_id)
             VALUES (1, '已取消打卡但留关联', ?1)",
            [habit.id],
        )
        .expect("插入非打卡事项失败");

        let affected = delete(&mut conn, habit.id).expect("删除失败");
        assert_eq!(affected.len(), 1, "只有勾打卡身份的事项被解除");
        assert!(get(&conn, habit.id).is_err());

        // 打卡事项保留但身份解除
        let (ck, hid, title): (i64, Option<i64>, String) = conn
            .query_row(
                "SELECT is_checkin, habit_id, title FROM items WHERE title = '打卡1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("查询失败");
        assert_eq!(ck, 0);
        assert!(hid.is_none());
        assert_eq!(title, "打卡1");
    }
}
