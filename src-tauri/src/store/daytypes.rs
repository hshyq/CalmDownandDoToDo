//! store::daytypes —— 日期类型（PRD 5.5 v1.12；SQL 收口本模块）。
//!
//! 只存「覆盖项」：未指定的日期不落库，由前端按周一~五工作日、周六日休息日推算。

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;

use super::{Error, Result};

/// 日期类型覆盖行（与前端 services/types.ts 的 DayTypeRow 对齐）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DayTypeRow {
    pub date: String,
    pub day_type: String,
}

/// 合法类型值：工作日 / 休息日 / 法定假日。
const TYPES: [&str; 3] = ["work", "rest", "holiday"];

/// 闰年二月天数。
fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        _ => {
            if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
                29
            } else {
                28
            }
        }
    }
}

/// 校验日期（YYYY-MM-DD 且真实存在）与类型值（day_type=None 表示清除，仅需校验日期）。
pub fn validate(date: &str, day_type: Option<&str>) -> Result<()> {
    let b = date.as_bytes();
    let (y, m, d) = if date.len() == 10 && b[4] == b'-' && b[7] == b'-' {
        (
            date[..4].parse::<i32>().ok(),
            date[5..7].parse::<u32>().ok(),
            date[8..10].parse::<u32>().ok(),
        )
    } else {
        (None, None, None)
    };
    let valid = match (y, m, d) {
        (Some(y), Some(m), Some(d)) if (1..=12).contains(&m) && d >= 1 => d <= days_in_month(y, m),
        _ => false,
    };
    if !valid {
        return Err(Error::Business(format!(
            "日期不合法：{date}（需 YYYY-MM-DD）"
        )));
    }
    if let Some(t) = day_type {
        if !TYPES.contains(&t) {
            return Err(Error::Business(format!(
                "日期类型不合法：{t}（需 work/rest/holiday）"
            )));
        }
    }
    Ok(())
}

/// 范围内已指定的日期类型（按日期升序）。
pub fn list(conn: &Connection, view_start: &str, view_end: &str) -> Result<Vec<DayTypeRow>> {
    let mut stmt = conn.prepare(
        "SELECT date, day_type FROM day_types WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC",
    )?;
    let rows = stmt
        .query_map([view_start, view_end], |r| {
            Ok(DayTypeRow {
                date: r.get(0)?,
                day_type: r.get(1)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// 读取某日当前值（供撤销记录 before）；无覆盖项返回 None。
pub fn get(conn: &Connection, date: &str) -> Result<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT day_type FROM day_types WHERE date = ?1",
            [date],
            |r| r.get(0),
        )
        .optional()?)
}

/// 设置（UPSERT）或清除（day_type=None）某日类型。
pub fn set(conn: &Connection, date: &str, day_type: Option<&str>) -> Result<()> {
    validate(date, day_type)?;
    match day_type {
        Some(t) => {
            conn.execute(
                "INSERT INTO day_types(date, day_type) VALUES (?1, ?2)
                 ON CONFLICT(date) DO UPDATE SET day_type = excluded.day_type",
                [date, t],
            )?;
        }
        None => {
            conn.execute("DELETE FROM day_types WHERE date = ?1", [date])?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().expect("打开内存库失败");
        conn.execute_batch(
            "CREATE TABLE day_types (date TEXT PRIMARY KEY, day_type TEXT NOT NULL);",
        )
        .expect("建表失败");
        conn
    }

    #[test]
    fn set_upsert_and_clear() {
        let conn = conn();
        set(&conn, "2026-09-12", Some("work")).expect("设置失败");
        assert_eq!(
            get(&conn, "2026-09-12").expect("读取失败"),
            Some("work".into())
        );
        // 同日覆盖为另一类型（UPSERT，不产生第二行）
        set(&conn, "2026-09-12", Some("holiday")).expect("覆盖失败");
        assert_eq!(
            get(&conn, "2026-09-12").expect("读取失败"),
            Some("holiday".into())
        );
        // 清除：删除行
        set(&conn, "2026-09-12", None).expect("清除失败");
        assert_eq!(get(&conn, "2026-09-12").expect("读取失败"), None);
    }

    #[test]
    fn list_filters_by_range_and_sorts() {
        let conn = conn();
        for d in ["2026-09-01", "2026-09-25", "2026-10-01", "2026-08-20"] {
            set(&conn, d, Some("rest")).expect("设置失败");
        }
        let rows = list(&conn, "2026-09-01", "2026-09-30").expect("查询失败");
        let dates: Vec<&str> = rows.iter().map(|r| r.date.as_str()).collect();
        assert_eq!(dates, ["2026-09-01", "2026-09-25"]);
    }

    #[test]
    fn validate_rejects_bad_date_and_type() {
        assert!(validate("2026-02-30", Some("work")).is_err()); // 不存在的日期
        assert!(validate("2026-13-01", Some("work")).is_err()); // 月份越界
        assert!(validate("2026/09/01", Some("work")).is_err()); // 格式错误
        assert!(validate("2024-02-29", Some("work")).is_ok()); // 闰年
        assert!(validate("2026-09-01", Some("holiday2")).is_err()); // 非法类型
        assert!(validate("2026-09-01", None).is_ok()); // 清除仅需校验日期
    }
}
