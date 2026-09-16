//! store/export：TXT 导出（PRD 6.9 / v1.14）。
//!
//! 查询（窗口交集 / 截止日期过滤）与 txt 格式化收口本模块；
//! 只读操作，不进撤销栈；写文件 UTF-8 带 BOM（记事本直接打开不乱码）。

use std::fs;
use std::io::Write;
use std::path::Path;

use rusqlite::Connection;

use super::Result;

/// 导出范围最长半年：开始日期 + 6 个月 − 1 天（PRD 6.9，用户定义）。
/// 输入/输出均为 ISO `yyyy-MM-dd`；目标月不存在同日时钳到当月最后一天再减一天
/// （如 2026-08-31 → +6 个月=2027-02-28（钳制）→ −1 天=2027-02-27）。
pub fn half_year_limit(start: &str) -> Result<String> {
    let (y, m, d) = parse_date(start)?;
    // 加 6 个月（仅年月进位）
    let total = y * 12 + (m as i64 - 1) + 6;
    let (y2, m2) = ((total / 12) as u32, (total % 12) as u32 + 1);
    // 目标月无同日则钳到当月最后一天，再减一天
    let clamped = d.min(days_in_month(y2, m2));
    if clamped >= 2 {
        Ok(format!("{y2:04}-{m2:02}-{cli:02}", cli = clamped - 1))
    } else {
        // 1 日减一天 = 上月最后一天
        let t = (y2 as i64) * 12 + (m2 as i64 - 1) - 1;
        let (y3, m3) = ((t / 12) as u32, (t % 12) as u32 + 1);
        Ok(format!("{y3:04}-{m3:02}-{:02}", days_in_month(y3, m3)))
    }
}

/// 导出范围校验：格式、先后顺序、不超过半年（PRD 6.9）。
pub fn validate_range(start: &str, end: &str) -> Result<()> {
    parse_date(start)?;
    parse_date(end)?;
    if start > end {
        return Err(super::Error::Business(format!(
            "开始日期 {start} 晚于结束日期 {end}，请调整后重试"
        )));
    }
    let limit = half_year_limit(start)?;
    if end > limit.as_str() {
        return Err(super::Error::Business(format!(
            "导出范围不能超过半年：开始日期 {start} 对应的结束日期最晚为 {limit}"
        )));
    }
    Ok(())
}

/// 解析 ISO `yyyy-MM-dd` 为 (年, 月, 日)；格式非法报业务错误。
fn parse_date(s: &str) -> Result<(i64, u32, u32)> {
    let bytes = s.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return Err(super::Error::Business(format!(
            "日期格式应为 yyyy-MM-dd，收到：{s}"
        )));
    }
    let seg = |a: usize, b: usize| -> Result<u32> {
        s[a..b]
            .parse::<u32>()
            .map_err(|_| super::Error::Business(format!("日期格式应为 yyyy-MM-dd，收到：{s}")))
    };
    let (y, m, d) = (
        s[..4]
            .parse::<i64>()
            .map_err(|_| super::Error::Business(format!("日期格式应为 yyyy-MM-dd，收到：{s}")))?,
        seg(5, 7)?,
        seg(8, 10)?,
    );
    if !(1..=12).contains(&m) || d == 0 || d > days_in_month(y as u32, m) {
        return Err(super::Error::Business(format!("日期不存在：{s}")));
    }
    Ok((y, m, d))
}

/// 指定年月的天数（含闰年）。
fn days_in_month(y: u32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

/// 导出 TXT：查询范围命中的日历/待办事项，按 PRD 6.9 格式写文件（UTF-8 带 BOM）。
/// 返回 (日历条数, 待办条数)。
pub fn export_txt(
    conn: &Connection,
    path: &Path,
    start: &str,
    end: &str,
) -> Result<(usize, usize)> {
    validate_range(start, end)?;

    // 日历块：起止完整且与选择范围有交集；按开始日期升序、同日按创建顺序（PRD 6.9）
    const CAL_SQL: &str = r#"
SELECT title, start_date, end_date FROM items
WHERE start_date IS NOT NULL AND end_date IS NOT NULL
  AND start_date <= ?2 AND end_date >= ?1
ORDER BY start_date ASC, created_at ASC, id ASC
"#;
    // 待办块：起止不完整且截止日期落范围内（含边界）；按截止日期升序
    const TODO_SQL: &str = r#"
SELECT title, due_date FROM items
WHERE (start_date IS NULL OR end_date IS NULL)
  AND due_date IS NOT NULL AND due_date >= ?1 AND due_date <= ?2
ORDER BY due_date ASC, created_at ASC, id ASC
"#;

    let mut cal: Vec<(String, String, String)> = Vec::new();
    let mut stmt = conn.prepare(CAL_SQL)?;
    let rows = stmt.query_map(rusqlite::params![start, end], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    })?;
    for row in rows {
        cal.push(row?);
    }

    let mut todo: Vec<(String, String)> = Vec::new();
    let mut stmt = conn.prepare(TODO_SQL)?;
    let rows = stmt.query_map(rusqlite::params![start, end], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
    })?;
    for row in rows {
        todo.push(row?);
    }

    let text = build_txt(&cal, &todo);
    write_with_bom(path, &text)?;
    Ok((cal.len(), todo.len()))
}

/// 组装 txt 正文（不含 BOM）：两块各自从 1 编号，行以 CRLF 结尾（Windows 记事本友好）。
fn build_txt(cal: &[(String, String, String)], todo: &[(String, String)]) -> String {
    let mut out = String::from("日历\r\n");
    for (i, (title, sd, ed)) in cal.iter().enumerate() {
        out.push_str(&format!("{}. {sd}~{ed} {title}\r\n", i + 1));
    }
    out.push_str("待办\r\n");
    for (i, (title, dd)) in todo.iter().enumerate() {
        out.push_str(&format!("{}. {dd} {title}\r\n", i + 1));
    }
    out
}

/// 写文件：先写 UTF-8 BOM（EF BB BF），再写 UTF-8 正文。
fn write_with_bom(path: &Path, text: &str) -> Result<()> {
    let mut f = fs::File::create(path)?;
    f.write_all(&[0xEF, 0xBB, 0xBF])?;
    f.write_all(text.as_bytes())?;
    f.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tmp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cal-todo-exp-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("建临时目录失败");
        dir
    }

    fn setup_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("打开内存库失败");
        super::super::schema::migrate(&mut conn).expect("迁移失败");
        conn.execute(
            "INSERT INTO categories (name, color, sort_order, kind) VALUES ('工作', '#4F8EF7', 0, 'normal')",
            [],
        )
        .expect("插入分类失败");
        conn
    }

    /// 插入事项：sd/ed/dd 为 None 表示无对应字段；created_at 递增控制创建顺序。
    fn insert(
        conn: &Connection,
        title: &str,
        sd: Option<&str>,
        ed: Option<&str>,
        dd: Option<&str>,
        created_at: &str,
    ) {
        conn.execute(
            r#"INSERT INTO items
               (category_id, title, start_date, start_time, end_date, end_time, due_date, due_time, created_at)
               VALUES (1, ?1, ?2, NULL, ?3, NULL, ?4, NULL, ?5)"#,
            rusqlite::params![title, sd, ed, dd, created_at],
        )
        .expect("插入事项失败");
    }

    #[test]
    fn half_year_limit_cases() {
        // 用户定义示例：+6 个月 − 1 天
        assert_eq!(
            half_year_limit("2026-09-16").expect("计算失败"),
            "2027-03-15"
        );
        // 月初：1 日减一天 = 上月最后一天
        assert_eq!(
            half_year_limit("2026-09-01").expect("计算失败"),
            "2027-02-28"
        );
        // 月末同日不存在 → 钳到目标月末再减一天
        assert_eq!(
            half_year_limit("2026-08-31").expect("计算失败"),
            "2027-02-27"
        );
        // 年末跨年
        assert_eq!(
            half_year_limit("2026-12-15").expect("计算失败"),
            "2027-06-14"
        );
        // 闰年目标月（2027-08-31 → 2028-02-29 钳制 → 02-28）
        assert_eq!(
            half_year_limit("2027-08-31").expect("计算失败"),
            "2028-02-28"
        );
        // 非法输入
        assert!(half_year_limit("2026-13-01").is_err());
        assert!(half_year_limit("bad-date").is_err());
    }

    #[test]
    fn validate_range_rules() {
        assert!(validate_range("2026-09-01", "2026-10-31").is_ok());
        // 开始晚于结束
        assert!(validate_range("2026-10-01", "2026-09-01").is_err());
        // 恰好半年上限内（含边界）
        assert!(validate_range("2026-09-16", "2027-03-15").is_ok());
        // 超过半年上限
        assert!(validate_range("2026-09-16", "2027-03-16").is_err());
    }

    #[test]
    fn export_filters_and_format() {
        let conn = setup_db();
        // 日历：A 完全在内、B 前跨、C 后跨、D 不相交；E 同日开始（测排序创建顺序）
        insert(
            &conn,
            "B 前跨",
            Some("2026-08-15"),
            Some("2026-09-10"),
            None,
            "t1",
        );
        insert(
            &conn,
            "A 内部",
            Some("2026-09-01"),
            Some("2026-09-30"),
            None,
            "t2",
        );
        insert(
            &conn,
            "E 同日开始",
            Some("2026-09-01"),
            Some("2026-09-05"),
            None,
            "t3",
        );
        insert(
            &conn,
            "C 后跨",
            Some("2026-09-25"),
            Some("2026-10-20"),
            None,
            "t4",
        );
        insert(
            &conn,
            "D 不相交",
            Some("2026-11-01"),
            Some("2026-11-30"),
            None,
            "t5",
        );
        // 日历归属但带截止 → 只进日历块（PRD 6.9）
        insert(
            &conn,
            "F 日历带截止",
            Some("2026-09-05"),
            Some("2026-09-06"),
            Some("2026-09-20"),
            "t6",
        );
        // 待办：G 截止在内、H 截止边界 10-31、I 截止在外、J 无截止
        insert(&conn, "I 截止在外", None, None, Some("2026-11-01"), "t7");
        insert(&conn, "H 边界1031", None, None, Some("2026-10-31"), "t8");
        insert(&conn, "G 截止0915", None, None, Some("2026-09-15"), "t9");
        insert(&conn, "J 无截止", None, None, None, "t10");

        let dir = tmp_dir("fmt");
        let path = dir.join("out.txt");
        let (cal_n, todo_n) =
            export_txt(&conn, &path, "2026-09-01", "2026-10-31").expect("导出失败");
        assert_eq!((cal_n, todo_n), (5, 2), "过滤条数错误");

        let raw = fs::read(&path).expect("读文件失败");
        assert_eq!(&raw[..3], &[0xEF, 0xBB, 0xBF], "应有 UTF-8 BOM");
        let text = String::from_utf8(raw[3..].to_vec()).expect("UTF-8 解码失败");
        let expected = "日历\r\n\
            1. 2026-08-15~2026-09-10 B 前跨\r\n\
            2. 2026-09-01~2026-09-30 A 内部\r\n\
            3. 2026-09-01~2026-09-05 E 同日开始\r\n\
            4. 2026-09-05~2026-09-06 F 日历带截止\r\n\
            5. 2026-09-25~2026-10-20 C 后跨\r\n\
            待办\r\n\
            1. 2026-09-15 G 截止0915\r\n\
            2. 2026-10-31 H 边界1031\r\n";
        assert_eq!(text, expected, "txt 内容/排序/编号错误");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn export_empty_and_invalid_range() {
        let conn = setup_db();
        let dir = tmp_dir("empty");
        let path = dir.join("empty.txt");
        let (cal_n, todo_n) =
            export_txt(&conn, &path, "2030-01-01", "2030-01-31").expect("导出失败");
        assert_eq!((cal_n, todo_n), (0, 0));
        let binding = fs::read_to_string(&path).expect("读文件失败");
        let text = binding.trim_start_matches('\u{feff}');
        assert_eq!(text, "日历\r\n待办\r\n", "空数据应只有两个块标题");

        // 超半年：命令层直接调用也会被校验拦截
        assert!(export_txt(&conn, &dir.join("bad.txt"), "2026-09-16", "2027-03-16").is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
