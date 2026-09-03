//! store::fields —— 字段模板 CRUD、选项维护与类型转换的数据迁移（SQL 收口本模块）。
//! 类型转换矩阵的纯逻辑在 fieldconvert；此处负责事务内读值→转换→回写。

use rusqlite::Connection;
use serde::Serialize;

use super::fieldconvert::{self, FieldType};
use super::{Error, Result};

/// 字段模板（对应前端 services/types.ts；options_json 为 JSON 数组文本，仅单选/多选有）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FieldDef {
    pub id: i64,
    pub category_id: i64,
    pub name: String,
    pub r#type: String,
    pub options_json: Option<String>,
    pub sort_order: i64,
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FieldDef> {
    Ok(FieldDef {
        id: row.get(0)?,
        category_id: row.get(1)?,
        name: row.get(2)?,
        r#type: row.get(3)?,
        options_json: row.get(4)?,
        sort_order: row.get(5)?,
    })
}

const COLS: &str = "id, category_id, name, type, options_json, sort_order";

pub fn list(conn: &Connection, category_id: i64) -> Result<Vec<FieldDef>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM field_defs WHERE category_id = ?1 ORDER BY sort_order ASC, id ASC"
    ))?;
    let rows = stmt.query_map([category_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get(conn: &Connection, id: i64) -> Result<FieldDef> {
    conn.query_row(
        &format!("SELECT {COLS} FROM field_defs WHERE id = ?1"),
        [id],
        map_row,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Error::Business("字段不存在".to_string()),
        other => Error::Sqlite(other),
    })
}

/// 新建字段：sort 追加到该分类末尾；单选/多选必须带非空选项。
pub fn create(
    conn: &Connection,
    category_id: i64,
    name: &str,
    ftype: &str,
    options: Option<&[String]>,
) -> Result<FieldDef> {
    let ft = FieldType::parse(ftype).ok_or_else(|| Error::Business("字段类型无效".to_string()))?;
    let options_json = if ft.is_choice() {
        let opts =
            options.ok_or_else(|| Error::Business("单选/多选字段必须提供选项".to_string()))?;
        if opts.is_empty() {
            return Err(Error::Business("选项列表不能为空".to_string()));
        }
        Some(serde_json::to_string(opts).expect("选项序列化不会失败"))
    } else {
        None
    };
    let next: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order) + 1, 0) FROM field_defs WHERE category_id = ?1",
        [category_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO field_defs (category_id, name, type, options_json, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![category_id, name, ftype, options_json, next],
    )?;
    get(conn, conn.last_insert_rowid())
}

pub fn rename(conn: &Connection, id: i64, name: &str) -> Result<()> {
    let n = conn.execute(
        "UPDATE field_defs SET name = ?2 WHERE id = ?1",
        rusqlite::params![id, name],
    )?;
    if n == 0 {
        return Err(Error::Business("字段不存在".to_string()));
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    let n = conn.execute("DELETE FROM field_defs WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::Business("字段不存在".to_string()));
    }
    Ok(())
}
/// 读取字段全部已填值：[(item_id, value_json)]。
fn raw_values(conn: &Connection, field_id: i64) -> Result<Vec<(i64, Option<String>)>> {
    let mut stmt =
        conn.prepare("SELECT item_id, value_json FROM item_field_values WHERE field_def_id = ?1")?;
    let rows = stmt.query_map([field_id], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, Option<String>>(1)?))
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// 生成选项：历史值字符串化去重（PRD 6.6 v1.2：文本/数字/日期→单选/多选 时）。
fn options_from_history(conn: &Connection, field_id: i64, from: FieldType) -> Result<Vec<String>> {
    let mut seen = Vec::<String>::new();
    for (_, vj) in raw_values(conn, field_id)? {
        let vals = fieldconvert::decode_value(from, vj.as_deref());
        if let Some(list) = vals {
            for v in list {
                if !seen.contains(&v) {
                    seen.push(v);
                }
            }
        }
    }
    Ok(seen)
}

/// 编辑选项列表：单选失效值清空；多选仅移除失效项（PRD 6.5 / TC-FLD-012/013）。
pub fn set_options(conn: &mut Connection, id: i64, options: &[String]) -> Result<()> {
    if options.is_empty() {
        return Err(Error::Business("选项列表不能为空".to_string()));
    }
    let def = get(conn, id)?;
    let ft =
        FieldType::parse(&def.r#type).ok_or_else(|| Error::Business("字段类型无效".to_string()))?;
    if !ft.is_choice() {
        return Err(Error::Business("仅单选/多选字段可维护选项".to_string()));
    }
    let json = serde_json::to_string(options).expect("选项序列化不会失败");
    let tx = conn.transaction()?;
    for (item_id, vj) in raw_values(&tx, id)? {
        let vals = fieldconvert::decode_value(ft, vj.as_deref());
        let kept = match ft {
            FieldType::Single => vals.filter(|v| options.iter().any(|o| v.first() == Some(o))),
            FieldType::Multi => vals
                .map(|v| {
                    v.into_iter()
                        .filter(|x| options.iter().any(|o| o == x))
                        .collect::<Vec<_>>()
                })
                .filter(|v: &Vec<String>| !v.is_empty()),
            _ => vals,
        };
        let enc = fieldconvert::encode_value(ft, kept);
        tx.execute(
            "UPDATE item_field_values SET value_json = ?3 WHERE item_id = ?1 AND field_def_id = ?2",
            rusqlite::params![item_id, id, enc],
        )?;
    }
    tx.execute(
        "UPDATE field_defs SET options_json = ?2 WHERE id = ?1",
        rusqlite::params![id, json],
    )?;
    tx.commit()?;
    Ok(())
}

/// 修改字段类型：事务内按矩阵转换全部历史值并更新选项（PRD 6.6）。
pub fn change_type(conn: &mut Connection, id: i64, new_type: &str) -> Result<()> {
    let to =
        FieldType::parse(new_type).ok_or_else(|| Error::Business("字段类型无效".to_string()))?;
    let def = get(conn, id)?;
    let from =
        FieldType::parse(&def.r#type).ok_or_else(|| Error::Business("字段类型无效".to_string()))?;
    if from == to {
        return Ok(());
    }
    // 旧选项（单选/多选路径校验用）
    let old_options: Vec<String> = def
        .options_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();
    // 目标选项：文本/数字/日期→单选/多选 时由历史值生成；否则沿用旧选项
    let new_options: Vec<String> = if to.is_choice() && !from.is_choice() {
        options_from_history(conn, id, from)?
    } else {
        old_options.clone()
    };
    let new_options_json = if to.is_choice() {
        Some(serde_json::to_string(&new_options).expect("选项序列化不会失败"))
    } else {
        None
    };

    let tx = conn.transaction()?;
    for (item_id, vj) in raw_values(&tx, id)? {
        let vals = fieldconvert::decode_value(from, vj.as_deref());
        let converted = fieldconvert::convert_value(from, to, vals, &old_options);
        let enc = fieldconvert::encode_value(to, converted);
        tx.execute(
            "UPDATE item_field_values SET value_json = ?3 WHERE item_id = ?1 AND field_def_id = ?2",
            rusqlite::params![item_id, id, enc],
        )?;
    }
    tx.execute(
        "UPDATE field_defs SET type = ?2, options_json = ?3 WHERE id = ?1",
        rusqlite::params![id, new_type, new_options_json],
    )?;
    tx.commit()?;
    Ok(())
}

/// 上移/下移（与该分类相邻字段交换 sort_order）。
pub fn move_field(conn: &mut Connection, id: i64, direction: &str) -> Result<()> {
    let def = get(conn, id)?;
    let all = list(conn, def.category_id)?;
    let idx = all
        .iter()
        .position(|f| f.id == id)
        .ok_or_else(|| Error::Business("字段不存在".to_string()))?;
    let swap_idx = match direction {
        "up" => idx.checked_sub(1),
        "down" => {
            if idx + 1 < all.len() {
                Some(idx + 1)
            } else {
                None
            }
        }
        _ => return Err(Error::Business("移动方向无效".to_string())),
    };
    let Some(other_idx) = swap_idx else {
        return Ok(());
    };
    let other = &all[other_idx];
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE field_defs SET sort_order = ?2 WHERE id = ?1",
        rusqlite::params![id, other.sort_order],
    )?;
    tx.execute(
        "UPDATE field_defs SET sort_order = ?2 WHERE id = ?1",
        rusqlite::params![other.id, def.sort_order],
    )?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::categories;
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

    fn cat(conn: &Connection) -> i64 {
        categories::list(conn)
            .expect("查询分类")
            .into_iter()
            .find(|c| c.name == "工作")
            .expect("有工作")
            .id
    }

    /// 建一个事项返回 id（item_field_values 有 FK 约束）。
    fn mk_item(conn: &Connection, title: &str) -> i64 {
        let c = cat(conn);
        conn.execute(
            "INSERT INTO items (category_id, title) VALUES (?1, ?2)",
            rusqlite::params![c, title],
        )
        .expect("建事项失败");
        conn.last_insert_rowid()
    }

    fn set_value(conn: &Connection, item_id: i64, field_id: i64, vj: Option<&str>) {
        conn.execute(
            "INSERT INTO item_field_values (item_id, field_def_id, value_json) VALUES (?1,?2,?3)
             ON CONFLICT(item_id, field_def_id) DO UPDATE SET value_json = excluded.value_json",
            rusqlite::params![item_id, field_id, vj],
        )
        .expect("写值失败");
    }

    fn raw(conn: &Connection, item_id: i64, field_id: i64) -> Option<String> {
        match conn.query_row(
            "SELECT value_json FROM item_field_values WHERE item_id=?1 AND field_def_id=?2",
            rusqlite::params![item_id, field_id],
            |r| r.get::<_, Option<String>>(0),
        ) {
            Ok(v) => v,
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e) => panic!("读值失败: {e}"),
        }
    }

    #[test]
    fn field_crud_and_move() {
        let mut conn = db();
        let c = cat(&conn);
        let f1 = create(&conn, c, "项目", "text", None).expect("新建失败");
        let f2 = create(&conn, c, "工时", "number", None).expect("新建失败");
        assert_eq!(list(&conn, c).expect("列表").len(), 2);
        assert!(f1.sort_order < f2.sort_order);

        move_field(&mut conn, f2.id, "up").expect("上移失败");
        let all = list(&conn, c).expect("列表");
        assert_eq!(all[0].id, f2.id);
        move_field(&mut conn, f2.id, "up").expect("再上移失败(已顶)");
        rename(&conn, f2.id, "耗时").expect("改名失败");
        assert_eq!(get(&conn, f2.id).expect("读取").name, "耗时");
        delete(&conn, f1.id).expect("删除失败");
        assert!(get(&conn, f1.id).is_err());
    }

    #[test]
    fn single_options_edit_filters_invalid() {
        let mut conn = db();
        let c = cat(&conn);
        let f = create(
            &conn,
            c,
            "优先级",
            "single_choice",
            Some(&["高".into(), "中".into(), "低".into()]),
        )
        .expect("新建失败");
        let item_id = mk_item(&conn, "A");
        set_value(&conn, item_id, f.id, Some("\"高\""));
        set_options(&mut conn, f.id, &["中".to_string(), "低".to_string()]).expect("改选项失败");
        assert_eq!(raw(&conn, item_id, f.id), None);
    }

    #[test]
    fn multi_options_edit_removes_invalid() {
        let mut conn = db();
        let c = cat(&conn);
        let f = create(
            &conn,
            c,
            "类别",
            "multi_choice",
            Some(&["A".into(), "B".into()]),
        )
        .expect("新建失败");
        let item_id = mk_item(&conn, "B");
        set_value(&conn, item_id, f.id, Some("[\"A\",\"B\"]"));
        set_options(&mut conn, f.id, &["B".to_string()]).expect("改选项失败");
        assert_eq!(raw(&conn, item_id, f.id).as_deref(), Some("[\"B\"]"));
    }

    #[test]
    fn change_type_migrates_values() {
        let mut conn = db();
        let c = cat(&conn);
        let i1 = mk_item(&conn, "1");
        let i2 = mk_item(&conn, "2");
        let i3 = mk_item(&conn, "3");

        let f = create(&conn, c, "F", "text", None).expect("新建失败");
        set_value(&conn, i1, f.id, Some("\"123\""));
        set_value(&conn, i2, f.id, Some("\"abc\""));
        change_type(&mut conn, f.id, "number").expect("转换失败");
        assert_eq!(raw(&conn, i1, f.id).as_deref(), Some("\"123\""));
        assert_eq!(raw(&conn, i2, f.id), None);
        assert_eq!(get(&conn, f.id).expect("读取").r#type, "number");

        let g = create(&conn, c, "G", "text", None).expect("新建失败");
        set_value(&conn, i1, g.id, Some("\"学习\""));
        set_value(&conn, i2, g.id, Some("\"学习\""));
        set_value(&conn, i3, g.id, Some("\"摸鱼\""));
        change_type(&mut conn, g.id, "single_choice").expect("转换失败");
        let def = get(&conn, g.id).expect("读取");
        let opts: Vec<String> =
            serde_json::from_str(def.options_json.as_deref().expect("有选项")).expect("解析");
        assert_eq!(opts, vec!["学习".to_string(), "摸鱼".to_string()]);
        assert_eq!(raw(&conn, i1, g.id).as_deref(), Some("\"学习\""));
    }

    #[test]
    fn change_type_choice_cross() {
        let mut conn = db();
        let c = cat(&conn);
        let f = create(
            &conn,
            c,
            "S",
            "single_choice",
            Some(&["X".into(), "Y".into()]),
        )
        .expect("新建失败");
        let i1 = mk_item(&conn, "a");
        set_value(&conn, i1, f.id, Some("\"X\""));
        change_type(&mut conn, f.id, "multi_choice").expect("转换失败");
        assert_eq!(raw(&conn, i1, f.id).as_deref(), Some("[\"X\"]"));

        let g = create(
            &conn,
            c,
            "M",
            "multi_choice",
            Some(&["A".into(), "B".into()]),
        )
        .expect("新建失败");
        let i2 = mk_item(&conn, "b");
        set_value(&conn, i2, g.id, Some("[\"B\",\"A\"]"));
        change_type(&mut conn, g.id, "single_choice").expect("转换失败");
        assert_eq!(raw(&conn, i2, g.id).as_deref(), Some("\"B\""));
    }

    #[test]
    fn values_set_and_list() {
        let mut conn = db();
        let c = cat(&conn);
        let f = create(&conn, c, "标签", "text", None).expect("新建失败");
        let item_id = mk_item(&conn, "v");
        values::set_values(&mut conn, item_id, &[(f.id, Some("\"v1\"".to_string()))])
            .expect("写值失败");
        let all = values::list_for_item(&conn, item_id).expect("读值失败");
        assert_eq!(all, vec![(f.id, Some("\"v1\"".to_string()))]);
        values::set_values(&mut conn, item_id, &[(f.id, None)]).expect("覆盖失败");
        assert_eq!(
            values::list_for_item(&conn, item_id).expect("读值"),
            vec![(f.id, None)]
        );
    }
}
