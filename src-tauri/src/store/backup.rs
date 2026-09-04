//! store::backup —— 备份导出/导入（PRD 6.8 / 技术方案 3.3；SQL 收口本模块）。
//! 导出带 format_version 的单 JSON；导入先做语义校验（TC-BAK-006），通过后事务内整库替换。
//! 一期无 mail_config/reminders 表（二期），导出天然不含授权码（D8）。

use std::collections::{HashMap, HashSet};

use rusqlite::Connection;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

use super::categories;
use super::fieldconvert::{self, FieldType};
use super::items;
use super::validation;
use super::{Error, Result};

/// 备份格式版本（技术方案 3.3）。
pub const FORMAT_VERSION: i64 = 1;

fn now_iso(conn: &Connection) -> Result<String> {
    conn.query_row("SELECT datetime('now')", [], |r| r.get(0))
        .map_err(Into::into)
}

fn parse_options(options_json: &Option<String>) -> Vec<String> {
    options_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default()
}

/// 导出全库为备份 JSON（分类 + 字段定义 + 事项[含字段值] + 设置）。
pub fn dump(conn: &Connection) -> Result<Value> {
    let cats = categories::list(conn)?;
    let cat_values: Vec<Value> = cats
        .iter()
        .map(|c| serde_json::to_value(c).expect("分类序列化"))
        .collect();

    // field_defs 全表（跨分类）
    let mut stmt = conn.prepare(
        "SELECT id, category_id, name, type, options_json, sort_order FROM field_defs ORDER BY id",
    )?;
    let def_rows = stmt.query_map([], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_, i64>(0)?,
            "category_id": r.get::<_, i64>(1)?,
            "name": r.get::<_, String>(2)?,
            "type": r.get::<_, String>(3)?,
            "options_json": r.get::<_, Option<String>>(4)?,
            "sort_order": r.get::<_, i64>(5)?,
        }))
    })?;
    let def_values: Vec<Value> = def_rows.collect::<rusqlite::Result<Vec<_>>>()?;

    // items 全量 + 各事项字段值
    let all_items = items::list(conn, None)?;
    let mut item_values = Vec::with_capacity(all_items.len());
    for it in &all_items {
        let vals = super::values::list_for_item(conn, it.id)?;
        let fvs: Vec<Value> = vals
            .iter()
            .map(|(fid, vj)| json!({ "field_def_id": fid, "value_json": vj }))
            .collect();
        let mut base = serde_json::to_value(it).expect("事项序列化");
        if let Some(obj) = base.as_object_mut() {
            obj.insert("field_values".into(), Value::Array(fvs));
        }
        item_values.push(base);
    }

    // app_settings
    let mut settings = HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT key, value FROM app_settings ORDER BY key")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for row in rows {
            let (k, v) = row?;
            settings.insert(k, v);
        }
    }

    Ok(json!({
        "format_version": FORMAT_VERSION,
        "exported_at": now_iso(conn)?,
        "categories": cat_values,
        "field_defs": def_values,
        "items": item_values,
        "reminders": [],
        "app_settings": settings,
    }))
}

/// 默认导出路径：`data\backups\日历待办备份_<本地时间>.json`（文件名含导出日期，TC-BAK-001）。
pub fn default_export_path(data_dir: &Path, conn: &Connection) -> Result<PathBuf> {
    let ts: String = conn.query_row(
        "SELECT strftime('%Y%m%d_%H%M%S', 'now', 'localtime')",
        [],
        |r| r.get(0),
    )?;
    let dir = data_dir.join("backups");
    fs::create_dir_all(&dir)?;
    Ok(dir.join(format!("日历待办备份_{ts}.json")))
}

/// 把备份 JSON 文本导入（整库替换）；失败时当前数据不变（调用方在事务前校验）。
pub fn import(conn: &mut Connection, text: &str) -> Result<()> {
    let value: Value = serde_json::from_str(text)
        .map_err(|e| Error::Business(format!("备份文件不是合法 JSON：{e}")))?;
    import_value(conn, &value)
}

fn get_str<'a>(obj: &'a serde_json::Map<String, Value>, key: &str, loc: &str) -> Result<&'a str> {
    obj.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| Error::Business(format!("{loc} 缺少字段：{key}")))
}

/// 解析并校验，然后事务内整库替换。
fn import_value(conn: &mut Connection, value: &Value) -> Result<()> {
    let root = value
        .as_object()
        .ok_or_else(|| Error::Business("备份根节点必须是 JSON 对象".to_string()))?;
    let ver = root
        .get("format_version")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| Error::Business("备份缺少 format_version".to_string()))?;
    if ver != FORMAT_VERSION {
        return Err(Error::Business(format!(
            "备份版本不兼容：文件 {ver}，本程序支持 {FORMAT_VERSION}"
        )));
    }

    let categories = root
        .get("categories")
        .and_then(|v| v.as_array())
        .ok_or_else(|| Error::Business("备份缺少 categories".to_string()))?;
    let field_defs = root
        .get("field_defs")
        .and_then(|v| v.as_array())
        .ok_or_else(|| Error::Business("备份缺少 field_defs".to_string()))?;
    let items = root
        .get("items")
        .and_then(|v| v.as_array())
        .ok_or_else(|| Error::Business("备份缺少 items".to_string()))?;
    let app_settings = root
        .get("app_settings")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    // —— 语义校验（TC-BAK-006），任一失败即整体拒绝 ——
    let mut cat_ids = HashSet::new();
    let mut uncat_id: Option<i64> = None;
    for (i, c) in categories.iter().enumerate() {
        let obj = c
            .as_object()
            .ok_or_else(|| bad(&format!("categories[{i}] 不是对象")))?;
        let id = get_i64(obj, "id", &format!("categories[{i}]"))?;
        let name = get_str(obj, "name", &format!("categories[{i}]"))?;
        validation::validate_category_name(name)
            .map_err(|e| Error::Business(format!("categories[{i}]：{e}")))?;
        let color = get_str(obj, "color", &format!("categories[{i}]"))?;
        validation::validate_color(color)
            .map_err(|e| Error::Business(format!("categories[{i}]：{e}")))?;
        let kind = obj.get("kind").and_then(|v| v.as_str()).unwrap_or("normal");
        if kind == "uncategorized" {
            if uncat_id.is_some() {
                return Err(Error::Business("备份存在多个未分类".to_string()));
            }
            uncat_id = Some(id);
        } else if kind != "normal" {
            return Err(Error::Business(format!(
                "categories[{i}] 的 kind 无效：{kind}"
            )));
        }
        if !cat_ids.insert(id) {
            return Err(Error::Business(format!("categories[{i}] 的 id 重复")));
        }
    }
    if uncat_id.is_none() {
        return Err(Error::Business(
            "备份缺少「未分类」分类，无法导入".to_string(),
        ));
    }

    // field_defs
    let mut field_ids = HashSet::new();
    for (i, f) in field_defs.iter().enumerate() {
        let obj = f
            .as_object()
            .ok_or_else(|| bad(&format!("field_defs[{i}] 不是对象")))?;
        let id = get_i64(obj, "id", &format!("field_defs[{i}]"))?;
        let cat = get_i64(obj, "category_id", &format!("field_defs[{i}]"))?;
        if !cat_ids.contains(&cat) {
            return Err(Error::Business(format!("field_defs[{i}] 引用的分类不存在")));
        }
        let name = get_str(obj, "name", &format!("field_defs[{i}]"))?;
        if name.trim().is_empty() {
            return Err(Error::Business(format!("field_defs[{i}] 名称不能为空")));
        }
        let ftype = get_str(obj, "type", &format!("field_defs[{i}]"))?;
        if FieldType::parse(ftype).is_none() {
            return Err(Error::Business(format!(
                "field_defs[{i}] 的类型无效：{ftype}"
            )));
        }
        if !field_ids.insert(id) {
            return Err(Error::Business(format!("field_defs[{i}] 的 id 重复")));
        }
    }

    // items + 内嵌字段值
    let mut item_ids = HashSet::new();
    for (i, it) in items.iter().enumerate() {
        let obj = it
            .as_object()
            .ok_or_else(|| bad(&format!("items[{i}] 不是对象")))?;
        let id = get_i64(obj, "id", &format!("items[{i}]"))?;
        if !item_ids.insert(id) {
            return Err(Error::Business(format!("items[{i}] 的 id 重复")));
        }
        let cat = get_i64(obj, "category_id", &format!("items[{i}]"))?;
        if !cat_ids.contains(&cat) {
            return Err(Error::Business(format!("items[{i}] 引用的分类不存在")));
        }
        let title = get_str(obj, "title", &format!("items[{i}]"))?;
        let s = |k: &str| obj.get(k).and_then(|v| v.as_str()).map(String::from);
        let start_date = s("start_date");
        let start_time = s("start_time");
        let end_date = s("end_date");
        let end_time = s("end_time");
        let due_date = s("due_date");
        let due_time = s("due_time");
        validation::validate_item_title(title)
            .map_err(|e| Error::Business(format!("items[{i}]：{e}")))?;
        validation::check_date_time_pair(start_date.as_deref(), start_time.as_deref(), "开始时间")
            .map_err(|e| Error::Business(format!("items[{i}]：{e}")))?;
        validation::check_date_time_pair(end_date.as_deref(), end_time.as_deref(), "结束时间")
            .map_err(|e| Error::Business(format!("items[{i}]：{e}")))?;
        validation::check_date_time_pair(due_date.as_deref(), due_time.as_deref(), "截止时间")
            .map_err(|e| Error::Business(format!("items[{i}]：{e}")))?;
        validation::check_end_not_before_start(start_date.as_deref(), end_date.as_deref())
            .map_err(|e| Error::Business(format!("items[{i}]：{e}")))?;

        // 字段值：单/多选须命中选项（TC-BAK-006）
        if let Some(fvs) = obj.get("field_values").and_then(|v| v.as_array()) {
            for (j, fv) in fvs.iter().enumerate() {
                let fobj = fv
                    .as_object()
                    .ok_or_else(|| bad(&format!("items[{i}].field_values[{j}] 不是对象")))?;
                let fid = get_i64(
                    fobj,
                    "field_def_id",
                    &format!("items[{i}].field_values[{j}]"),
                )?;
                if !field_ids.contains(&fid) {
                    return Err(Error::Business(format!(
                        "items[{i}].field_values[{j}] 引用的字段不存在"
                    )));
                }
                let vj = fobj.get("value_json").and_then(|v| v.as_str());
                if let Some(vj) = vj {
                    let Some(def) = field_defs.iter().find(|f| {
                        f.as_object()
                            .and_then(|o| o.get("id"))
                            .and_then(|x| x.as_i64())
                            == Some(fid)
                    }) else {
                        return Err(bad("字段定义缺失"));
                    };
                    let def_obj = def.as_object().expect("对象");
                    let ftype = def_obj.get("type").and_then(|x| x.as_str()).expect("类型");
                    let ft = FieldType::parse(ftype).expect("已校验");
                    let options = parse_options(
                        &def_obj
                            .get("options_json")
                            .and_then(|x| x.as_str())
                            .map(String::from),
                    );
                    if ft == FieldType::Single || ft == FieldType::Multi {
                        let decoded = fieldconvert::decode_value(ft, Some(vj));
                        if let Some(vals) = decoded {
                            for v in vals {
                                if !options.contains(&v) {
                                    return Err(Error::Business(format!(
                                        "items[{i}].field_values[{j}] 的值「{v}」不在该字段选项中"
                                    )));
                                }
                            }
                        }
                    } else if serde_json::from_str::<Value>(vj).is_err() {
                        return Err(Error::Business(format!(
                            "items[{i}].field_values[{j}] 的值不是合法 JSON"
                        )));
                    }
                }
            }
        }
    }

    // —— 事务内整库替换 ——
    let tx = conn.transaction()?;
    tx.execute_batch(
        "DELETE FROM item_field_values; DELETE FROM items; DELETE FROM field_defs; DELETE FROM categories;",
    )?;
    for c in categories {
        let obj = c.as_object().expect("对象");
        tx.execute(
            "INSERT INTO categories (id, name, color, sort_order, kind) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                obj.get("id").and_then(|v| v.as_i64()),
                obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                obj.get("color").and_then(|v| v.as_str()).unwrap_or("#888888"),
                obj.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0),
                obj.get("kind").and_then(|v| v.as_str()).unwrap_or("normal"),
            ],
        )?;
    }
    for f in field_defs {
        let obj = f.as_object().expect("对象");
        tx.execute(
            "INSERT INTO field_defs (id, category_id, name, type, options_json, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                obj.get("id").and_then(|v| v.as_i64()),
                obj.get("category_id").and_then(|v| v.as_i64()),
                obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                obj.get("type").and_then(|v| v.as_str()).unwrap_or("text"),
                obj.get("options_json").and_then(|v| v.as_str()),
                obj.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0),
            ],
        )?;
    }
    for it in items {
        let obj = it.as_object().expect("对象");
        let created_at = obj.get("created_at").and_then(|v| v.as_str());
        match created_at {
            Some(_) => {
                tx.execute(
                    "INSERT INTO items (id, category_id, title, description, start_date, start_time,
                                        end_date, end_time, due_date, due_time, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    rusqlite::params![
                        obj.get("id").and_then(|v| v.as_i64()),
                        obj.get("category_id").and_then(|v| v.as_i64()),
                        obj.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                        obj.get("description").and_then(|v| v.as_str()),
                        obj.get("start_date").and_then(|v| v.as_str()),
                        obj.get("start_time").and_then(|v| v.as_str()),
                        obj.get("end_date").and_then(|v| v.as_str()),
                        obj.get("end_time").and_then(|v| v.as_str()),
                        obj.get("due_date").and_then(|v| v.as_str()),
                        obj.get("due_time").and_then(|v| v.as_str()),
                        created_at,
                    ],
                )?;
            }
            None => {
                tx.execute(
                    "INSERT INTO items (id, category_id, title, description, start_date, start_time,
                                        end_date, end_time, due_date, due_time)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    rusqlite::params![
                        obj.get("id").and_then(|v| v.as_i64()),
                        obj.get("category_id").and_then(|v| v.as_i64()),
                        obj.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                        obj.get("description").and_then(|v| v.as_str()),
                        obj.get("start_date").and_then(|v| v.as_str()),
                        obj.get("start_time").and_then(|v| v.as_str()),
                        obj.get("end_date").and_then(|v| v.as_str()),
                        obj.get("end_time").and_then(|v| v.as_str()),
                        obj.get("due_date").and_then(|v| v.as_str()),
                        obj.get("due_time").and_then(|v| v.as_str()),
                    ],
                )?;
            }
        }
        if let Some(fvs) = obj.get("field_values").and_then(|v| v.as_array()) {
            for fv in fvs {
                let fobj = fv.as_object().expect("对象");
                tx.execute(
                    "INSERT INTO item_field_values (item_id, field_def_id, value_json)
                     VALUES (?1, ?2, ?3)",
                    rusqlite::params![
                        obj.get("id").and_then(|v| v.as_i64()),
                        fobj.get("field_def_id").and_then(|v| v.as_i64()),
                        fobj.get("value_json").and_then(|v| v.as_str()),
                    ],
                )?;
            }
        }
    }
    // 设置：清空后重灌
    tx.execute("DELETE FROM app_settings", [])?;
    for (k, v) in &app_settings {
        if let Some(v) = v.as_str() {
            tx.execute(
                "INSERT INTO app_settings (key, value) VALUES (?1, ?2)",
                rusqlite::params![k, v],
            )?;
        }
    }
    // 让 AUTOINCREMENT 基于当前最大 rowid 继续（导入带显式 id 后）
    let _ = tx.execute("DELETE FROM sqlite_sequence", []);
    tx.commit()?;
    Ok(())
}

fn bad(msg: &str) -> Error {
    Error::Business(msg.to_string())
}

fn get_i64(obj: &serde_json::Map<String, Value>, key: &str, loc: &str) -> Result<i64> {
    obj.get(key)
        .and_then(|v| v.as_i64())
        .ok_or_else(|| Error::Business(format!("{loc} 缺少字段：{key}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::fields;
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

    fn work_id(conn: &Connection) -> i64 {
        categories::list(conn)
            .expect("分类")
            .into_iter()
            .find(|c| c.name == "工作")
            .expect("工作")
            .id
    }

    #[test]
    fn dump_roundtrip_replace() {
        let mut conn = db();
        let work = work_id(&conn);
        let f = fields::create(
            &conn,
            work,
            "优先级",
            "single_choice",
            Some(&["高".into(), "低".into()]),
        )
        .expect("建字段");
        let it = items::create(
            &conn,
            &items::NewItem {
                category_id: work,
                title: "写周报",
                description: None,
                start_date: Some("2026-09-01"),
                start_time: None,
                end_date: Some("2026-09-02"),
                end_time: None,
                due_date: None,
                due_time: None,
            },
        )
        .expect("新增事项");
        values::set_values(&mut conn, it.id, &[(f.id, Some("\"高\"".to_string()))]).expect("写值");

        let text = dump(&conn).expect("导出").to_string();
        // 制造差异后导入，验证整库替换
        categories::create(&conn, "多余分类", "#123456").expect("建多余");
        let extra = items::create(
            &conn,
            &items::NewItem {
                category_id: work,
                title: "将被清除",
                description: None,
                start_date: None,
                start_time: None,
                end_date: None,
                end_time: None,
                due_date: None,
                due_time: None,
            },
        )
        .expect("建多余事项");
        assert!(items::get(&conn, extra.id).is_ok());

        import(&mut conn, &text).expect("导入");
        assert!(items::get(&conn, extra.id).is_err());
        assert_eq!(items::get(&conn, it.id).expect("读").title, "写周报");
        assert_eq!(
            values::list_for_item(&conn, it.id).expect("值"),
            vec![(f.id, Some("\"高\"".to_string()))]
        );
    }

    #[test]
    fn import_rejects_semantic_violations() {
        // 库 A：单选值不在选项内（TC-BAK-006）
        let mut a = db();
        let work = work_id(&a);
        let f = fields::create(
            &a,
            work,
            "单选",
            "single_choice",
            Some(&["高".into(), "低".into()]),
        )
        .expect("建字段");
        let it = items::create(
            &a,
            &items::NewItem {
                category_id: work,
                title: "A",
                description: None,
                start_date: None,
                start_time: None,
                end_date: None,
                end_time: None,
                due_date: None,
                due_time: None,
            },
        )
        .expect("建事项");
        values::set_values(&mut a, it.id, &[(f.id, Some("\"不存在\"".to_string()))]).expect("写值");
        let bad_value = dump(&a).expect("导出含非法值").to_string();

        // 库 B：结束早于开始（篡改导出 JSON）
        let b = db();
        let b_work = work_id(&b);
        let item_b = items::create(
            &b,
            &items::NewItem {
                category_id: b_work,
                title: "B",
                description: None,
                start_date: Some("2026-09-05"),
                start_time: None,
                end_date: Some("2026-09-06"),
                end_time: None,
                due_date: None,
                due_time: None,
            },
        )
        .expect("建事项");
        let mut bad_date_val = dump(&b).expect("导出").to_string();
        // 把 end_date 改为早于 start_date
        let idx = bad_date_val.find(r#""2026-09-06""#).expect("找到结束日期");
        bad_date_val.replace_range(idx..idx + 12, r#""2026-09-01""#);

        // 干净库导入上述两类违规文件都应拒绝且数据不变
        for text in [&bad_value, &bad_date_val] {
            let mut c = db();
            let cat_count = categories::list(&c).expect("分类").len();
            assert!(import(&mut c, text).is_err(), "应拒绝违规备份");
            assert_eq!(
                categories::list(&c).expect("分类").len(),
                cat_count,
                "拒绝后数据不变"
            );
        }
        assert!(items::get(&b, item_b.id).is_ok());
    }

    #[test]
    fn export_has_format_and_no_secrets() {
        let conn = db();
        let out = dump(&conn).expect("导出");
        assert_eq!(out["format_version"].as_i64(), Some(1));
        assert!(out["exported_at"].is_string());
        assert!(out["categories"].is_array());
        assert!(out["items"].is_array());
        assert!(out.get("mail_config").is_none());
        assert_eq!(out["reminders"].as_array().expect("reminders").len(), 0);
    }
}
