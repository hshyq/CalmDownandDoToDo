//! store::values —— 事项字段值读写（切换分类不迁移：只按传入字段 upsert，不删其它分类值，PRD 4.3）。

use rusqlite::{Connection, OptionalExtension};

use super::Result;

/// 覆盖写入某事项在当前模板字段上的值（仅更新传入的 field_def_id，不清其它）。
pub fn set_values(
    conn: &mut Connection,
    item_id: i64,
    values: &[(i64, Option<String>)],
) -> Result<()> {
    let tx = conn.transaction()?;
    for (field_def_id, value_json) in values {
        tx.execute(
            "INSERT INTO item_field_values (item_id, field_def_id, value_json)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(item_id, field_def_id) DO UPDATE SET value_json = excluded.value_json",
            rusqlite::params![item_id, field_def_id, value_json],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// 读取某事项全部字段值。
pub fn list_for_item(conn: &Connection, item_id: i64) -> Result<Vec<(i64, Option<String>)>> {
    let mut stmt =
        conn.prepare("SELECT field_def_id, value_json FROM item_field_values WHERE item_id = ?1")?;
    let rows = stmt.query_map([item_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// 是否存在事项（防御）。
pub fn item_exists(conn: &Connection, item_id: i64) -> Result<bool> {
    let n: Option<i64> = conn
        .query_row("SELECT id FROM items WHERE id = ?1", [item_id], |r| {
            r.get(0)
        })
        .optional()?;
    Ok(n.is_some())
}
