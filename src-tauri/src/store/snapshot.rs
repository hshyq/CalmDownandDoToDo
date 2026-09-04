//! store::snapshot —— 撤销/重做所需的「受影响行」快照与恢复原语（PRD 6.7 / 技术方案 5.3）。
//! 所有 SQL 收口本模块；恢复采用「行 upsert + 值集合 replace」，配合 LIFO 撤销栈精确还原。

use rusqlite::Connection;

use super::categories::{self, Category};
use super::fields::{self, FieldDef};
use super::items::{self, Item};
use super::{Error, Result};

/// 事项 + 其全部字段值（撤销「事项新增/编辑/删除」快照）。
#[derive(Debug, Clone)]
pub struct ItemSnapshot {
    pub item: Item,
    /// (field_def_id, value_json)，来自 item_field_values。
    pub values: Vec<(i64, Option<String>)>,
}

/// 字段模板 + 该字段全部值（撤销「字段新增/删除/改名/改类型/选项变更」快照）。
#[derive(Debug, Clone)]
pub struct FieldSnapshot {
    pub def: FieldDef,
    /// (item_id, value_json)。
    pub values: Vec<(i64, Option<String>)>,
}

/// 分类 + 其字段模板 + 其下事项（含字段值）——删除分类（cascade / 移入未分类）撤销快照。
#[derive(Debug, Clone)]
pub struct CategorySnapshot {
    pub category: Category,
    pub field_defs: Vec<FieldDef>,
    pub items: Vec<ItemSnapshot>,
}

fn item_values(conn: &Connection, item_id: i64) -> Result<Vec<(i64, Option<String>)>> {
    let mut stmt = conn.prepare(
        "SELECT field_def_id, value_json FROM item_field_values WHERE item_id = ?1 ORDER BY field_def_id",
    )?;
    let rows = stmt.query_map([item_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn field_values(conn: &Connection, field_def_id: i64) -> Result<Vec<(i64, Option<String>)>> {
    let mut stmt = conn.prepare(
        "SELECT item_id, value_json FROM item_field_values WHERE field_def_id = ?1 ORDER BY item_id",
    )?;
    let rows = stmt.query_map([field_def_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// 读取事项快照（不存在 → None）。
pub fn snapshot_item(conn: &Connection, id: i64) -> Result<Option<ItemSnapshot>> {
    let Ok(item) = items::get(conn, id) else {
        return Ok(None);
    };
    Ok(Some(ItemSnapshot {
        values: item_values(conn, id)?,
        item,
    }))
}

/// 读取字段快照（不存在 → None）。
pub fn snapshot_field(conn: &Connection, id: i64) -> Result<Option<FieldSnapshot>> {
    let Ok(def) = fields::get(conn, id) else {
        return Ok(None);
    };
    Ok(Some(FieldSnapshot {
        values: field_values(conn, id)?,
        def,
    }))
}

/// 读取分类级联快照（分类行 + 字段模板 + 全部事项及其字段值；不存在 → None）。
pub fn snapshot_category(conn: &Connection, id: i64) -> Result<Option<CategorySnapshot>> {
    let Ok(category) = categories::get(conn, id) else {
        return Ok(None);
    };
    let defs = fields::list(conn, id)?;
    let items = items::list(conn, Some(id))?;
    let mut snaps = Vec::with_capacity(items.len());
    for it in items {
        snaps.push(ItemSnapshot {
            values: item_values(conn, it.id)?,
            item: it,
        });
    }
    Ok(Some(CategorySnapshot {
        category,
        field_defs: defs,
        items: snaps,
    }))
}

fn upsert_category(tx: &Connection, cat: &Category) -> Result<()> {
    tx.execute(
        "INSERT INTO categories (id, name, color, sort_order, kind)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color,
             sort_order=excluded.sort_order, kind=excluded.kind",
        rusqlite::params![cat.id, cat.name, cat.color, cat.sort_order, cat.kind],
    )?;
    Ok(())
}

fn upsert_field_def(tx: &Connection, def: &FieldDef) -> Result<()> {
    tx.execute(
        "INSERT INTO field_defs (id, category_id, name, type, options_json, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, name=excluded.name,
             type=excluded.type, options_json=excluded.options_json, sort_order=excluded.sort_order",
        rusqlite::params![def.id, def.category_id, def.name, def.r#type, def.options_json, def.sort_order],
    )?;
    Ok(())
}

fn upsert_item(tx: &Connection, item: &Item) -> Result<()> {
    tx.execute(
        "INSERT INTO items (id, category_id, title, description, start_date, start_time,
                            end_date, end_time, due_date, due_time, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, title=excluded.title,
             description=excluded.description, start_date=excluded.start_date,
             start_time=excluded.start_time, end_date=excluded.end_date, end_time=excluded.end_time,
             due_date=excluded.due_date, due_time=excluded.due_time, created_at=excluded.created_at",
        rusqlite::params![
            item.id,
            item.category_id,
            item.title,
            item.description,
            item.start_date,
            item.start_time,
            item.end_date,
            item.end_time,
            item.due_date,
            item.due_time,
            item.created_at
        ],
    )?;
    Ok(())
}

/// 用某事项的快照值集合**替换**该事项当前全部值行（精确还原，PRD 4.3 保留值语义由快照覆盖）。
fn replace_item_values(
    tx: &Connection,
    item_id: i64,
    values: &[(i64, Option<String>)],
) -> Result<()> {
    tx.execute(
        "DELETE FROM item_field_values WHERE item_id = ?1",
        [item_id],
    )?;
    for (field_def_id, vj) in values {
        tx.execute(
            "INSERT INTO item_field_values (item_id, field_def_id, value_json) VALUES (?1, ?2, ?3)",
            rusqlite::params![item_id, field_def_id, vj],
        )?;
    }
    Ok(())
}

/// 用某字段的快照值集合**替换**该字段当前全部值行。
fn replace_field_values(
    tx: &Connection,
    field_def_id: i64,
    values: &[(i64, Option<String>)],
) -> Result<()> {
    tx.execute(
        "DELETE FROM item_field_values WHERE field_def_id = ?1",
        [field_def_id],
    )?;
    for (item_id, vj) in values {
        tx.execute(
            "INSERT INTO item_field_values (item_id, field_def_id, value_json) VALUES (?1, ?2, ?3)",
            rusqlite::params![item_id, field_def_id, vj],
        )?;
    }
    Ok(())
}

/// 恢复事项：标准行 upsert + 值集合 replace（撤销编辑/删除 / 重做新增）。
pub fn restore_item(conn: &mut Connection, snap: &ItemSnapshot) -> Result<()> {
    let tx = conn.transaction()?;
    upsert_item(&tx, &snap.item)?;
    replace_item_values(&tx, snap.item.id, &snap.values)?;
    tx.commit()?;
    Ok(())
}

/// 恢复字段：模板行 upsert + 该字段值集合 replace（撤销字段删除/改类型/选项 / 重做新增）。
pub fn restore_field(conn: &mut Connection, snap: &FieldSnapshot) -> Result<()> {
    let tx = conn.transaction()?;
    upsert_field_def(&tx, &snap.def)?;
    replace_field_values(&tx, snap.def.id, &snap.values)?;
    tx.commit()?;
    Ok(())
}

/// 恢复分类级联快照（撤销删除分类；cascade 重建事项，移入未分类则把事项改回并重建字段模板与值）。
pub fn restore_category(conn: &mut Connection, snap: &CategorySnapshot) -> Result<()> {
    let tx = conn.transaction()?;
    upsert_category(&tx, &snap.category)?;
    for def in &snap.field_defs {
        upsert_field_def(&tx, def)?;
    }
    for it in &snap.items {
        upsert_item(&tx, &it.item)?;
    }
    for it in &snap.items {
        replace_item_values(&tx, it.item.id, &it.values)?;
    }
    tx.commit()?;
    Ok(())
}

/// 按行覆盖某分类（撤销/重做「改名/改色」用）。
pub fn restore_category_row(conn: &mut Connection, cat: &Category) -> Result<()> {
    let tx = conn.transaction()?;
    upsert_category(&tx, cat)?;
    tx.commit()?;
    Ok(())
}

/// 设置某字段的 sort_order（撤销/重做「上移/下移」用）。
pub fn set_field_sort(conn: &mut Connection, id: i64, sort_order: i64) -> Result<()> {
    let n = conn.execute(
        "UPDATE field_defs SET sort_order = ?2 WHERE id = ?1",
        rusqlite::params![id, sort_order],
    )?;
    if n == 0 {
        return Err(Error::Business("字段不存在".to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::schema;
    use crate::store::values;

    fn db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("外键失败");
        schema::migrate(&mut conn).expect("迁移失败");
        categories::ensure_seeded(&mut conn).expect("种子失败");
        conn
    }

    fn cat_id(conn: &Connection, name: &str) -> i64 {
        categories::list(conn)
            .expect("分类")
            .into_iter()
            .find(|c| c.name == name)
            .expect(name)
            .id
    }

    fn mk_item(conn: &Connection, cat: i64, title: &str) -> Item {
        items::create(
            conn,
            &items::NewItem {
                category_id: cat,
                title,
                description: None,
                start_date: None,
                start_time: None,
                end_date: None,
                end_time: None,
                due_date: None,
                due_time: None,
            },
        )
        .expect("新增事项")
    }

    #[test]
    fn item_restore_roundtrip() {
        let mut conn = db();
        let work = cat_id(&conn, "工作");
        let f = fields::create(&conn, work, "备注", "text", None).expect("建字段");
        let it = mk_item(&conn, work, "写周报");
        values::set_values(&mut conn, it.id, &[(f.id, Some("\"v1\"".to_string()))]).expect("写值");

        let snap = snapshot_item(&conn, it.id).expect("快照").expect("存在");
        // 模拟一次编辑：标题与值都改
        items::update(
            &conn,
            it.id,
            &items::NewItem {
                category_id: work,
                title: "写周报（改）",
                description: None,
                start_date: None,
                start_time: None,
                end_date: None,
                end_time: None,
                due_date: None,
                due_time: None,
            },
        )
        .expect("更新");
        values::set_values(&mut conn, it.id, &[(f.id, Some("\"v2\"".to_string()))]).expect("改值");
        assert_eq!(items::get(&conn, it.id).expect("读").title, "写周报（改）");

        restore_item(&mut conn, &snap).expect("恢复");
        let restored = items::get(&conn, it.id).expect("读");
        assert_eq!(restored.title, "写周报");
        assert_eq!(
            item_values(&conn, it.id).expect("值"),
            vec![(f.id, Some("\"v1\"".to_string()))]
        );
    }

    #[test]
    fn item_restore_recreates_deleted() {
        let mut conn = db();
        let work = cat_id(&conn, "工作");
        let it = mk_item(&conn, work, "临时事项");
        let snap = snapshot_item(&conn, it.id).expect("快照").expect("存在");
        items::delete(&conn, it.id).expect("删除");
        assert!(items::get(&conn, it.id).is_err());
        restore_item(&mut conn, &snap).expect("恢复");
        assert_eq!(items::get(&conn, it.id).expect("读").title, "临时事项");
    }

    #[test]
    fn field_restore_after_change_type_and_options() {
        let mut conn = db();
        let work = cat_id(&conn, "工作");
        let f = fields::create(&conn, work, "评分", "text", None).expect("建字段");
        let it = mk_item(&conn, work, "A");
        values::set_values(&mut conn, it.id, &[(f.id, Some("\"123\"".to_string()))]).expect("写值");
        let snap = snapshot_field(&conn, f.id).expect("快照").expect("存在");

        fields::change_type(&mut conn, f.id, "number").expect("改类型");
        let after = fields::get(&conn, f.id).expect("读");
        assert_eq!(after.r#type, "number");

        restore_field(&mut conn, &snap).expect("恢复");
        let def = fields::get(&conn, f.id).expect("读");
        assert_eq!(def.r#type, "text");
        assert_eq!(
            field_values(&conn, f.id).expect("值"),
            vec![(it.id, Some("\"123\"".to_string()))]
        );
    }

    #[test]
    fn category_delete_cascade_restore() {
        let mut conn = db();
        let c = categories::create(&conn, "临时分类", "#112233").expect("建分类");
        let f = fields::create(&conn, c.id, "备注", "text", None).expect("建字段");
        let it = mk_item(&conn, c.id, "事项1");
        let it2 = mk_item(&conn, c.id, "事项2");
        values::set_values(&mut conn, it.id, &[(f.id, Some("\"x\"".to_string()))]).expect("写值");
        values::set_values(&mut conn, it2.id, &[(f.id, Some("\"y\"".to_string()))]).expect("写值");

        let snap = snapshot_category(&conn, c.id).expect("快照").expect("存在");
        categories::delete(&mut conn, c.id, categories::DeleteMode::Cascade).expect("删除");
        assert!(categories::get(&conn, c.id).is_err());
        assert!(items::get(&conn, it.id).is_err());

        restore_category(&mut conn, &snap).expect("恢复");
        assert_eq!(categories::get(&conn, c.id).expect("读").color, "#112233");
        assert_eq!(items::get(&conn, it.id).expect("读").title, "事项1");
        assert_eq!(items::get(&conn, it2.id).expect("读").title, "事项2");
        assert_eq!(
            item_values(&conn, it.id).expect("值"),
            vec![(f.id, Some("\"x\"".to_string()))]
        );
    }

    #[test]
    fn category_delete_move_restore() {
        let mut conn = db();
        let c = categories::create(&conn, "临时分类", "#445566").expect("建分类");
        let f = fields::create(&conn, c.id, "备注", "text", None).expect("建字段");
        let it = mk_item(&conn, c.id, "事项1");
        values::set_values(&mut conn, it.id, &[(f.id, Some("\"z\"".to_string()))]).expect("写值");
        let uncat = categories::list(&conn)
            .expect("分类")
            .into_iter()
            .find(|x| x.kind == "uncategorized")
            .expect("未分类")
            .id;

        let snap = snapshot_category(&conn, c.id).expect("快照").expect("存在");
        categories::delete(&mut conn, c.id, categories::DeleteMode::MoveToUncategorized)
            .expect("移入未分类");
        assert_eq!(items::get(&conn, it.id).expect("读").category_id, uncat);

        restore_category(&mut conn, &snap).expect("恢复");
        let restored = items::get(&conn, it.id).expect("读");
        assert_eq!(restored.category_id, c.id);
        assert_eq!(restored.title, "事项1");
        assert_eq!(
            item_values(&conn, it.id).expect("值"),
            vec![(f.id, Some("\"z\"".to_string()))]
        );
    }
}
