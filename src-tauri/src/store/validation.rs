//! 数据校验（应用层；入库/导入共用，导入语义校验对应 TC-BAK-006）。
//! 统一返回中文友好错误信息，便于 IPC 层直接透传给界面（AGENTS 第 5 节）。

/// 分类名称：必填且 ≤20 字符（PRD 4.1/6.2）。
pub fn validate_category_name(name: &str) -> Result<(), String> {
    let n = name.trim();
    if n.is_empty() {
        return Err("分类名称不能为空".to_string());
    }
    if n.chars().count() > 20 {
        return Err("分类名称不能超过 20 个字符".to_string());
    }
    Ok(())
}

/// 分类颜色：`#RRGGBB`（PRD 4.1；色盘/自定义均以此格式落库）。
pub fn validate_color(color: &str) -> Result<(), String> {
    let ok = color.len() == 7
        && color.starts_with('#')
        && color[1..].chars().all(|c| c.is_ascii_hexdigit());
    if !ok {
        return Err("颜色格式应为 #RRGGBB".to_string());
    }
    Ok(())
}

/// 事项标题：必填且 ≤100 字符（PRD 4.2/6.3）。
pub fn validate_item_title(title: &str) -> Result<(), String> {
    let n = title.trim();
    if n.is_empty() {
        return Err("标题不能为空".to_string());
    }
    if n.chars().count() > 100 {
        return Err("标题不能超过 100 个字符".to_string());
    }
    Ok(())
}

/// 日期与时刻成对：日期为空则时刻必须为空（技术方案 3.1）。
pub fn check_date_time_pair(
    date: Option<&str>,
    time: Option<&str>,
    label: &str,
) -> Result<(), String> {
    if date.is_none() && time.is_some() {
        return Err(format!("{label}未填日期时不能只填时刻"));
    }
    Ok(())
}

/// 结束日期不得早于开始日期（PRD 4.2/TC-IT-010：只比较日期部分）。
pub fn check_end_not_before_start(
    start_date: Option<&str>,
    end_date: Option<&str>,
) -> Result<(), String> {
    match (start_date, end_date) {
        (Some(s), Some(e)) if e < s => Err("结束时间的日期不能早于开始时间".to_string()),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn category_name_rules() {
        assert!(validate_category_name("生活").is_ok());
        assert!(validate_category_name("").is_err());
        assert!(validate_category_name("   ").is_err());
        assert!(validate_category_name(&"长".repeat(21)).is_err());
        assert!(validate_category_name(&"长".repeat(20)).is_ok());
    }

    #[test]
    fn color_rules() {
        assert!(validate_color("#4F8EF7").is_ok());
        assert!(validate_color("#4F8EF7").is_ok());
        assert!(validate_color("4F8EF7").is_err());
        assert!(validate_color("#4F8EF").is_err());
        assert!(validate_color("#GGGGGG").is_err());
    }

    #[test]
    fn item_title_rules() {
        assert!(validate_item_title("写周报").is_ok());
        assert!(validate_item_title("").is_err());
        assert!(validate_item_title(&"标".repeat(101)).is_err());
        assert!(validate_item_title(&"标".repeat(100)).is_ok());
    }

    #[test]
    fn date_time_pair_rules() {
        assert!(check_date_time_pair(Some("2026-09-01"), Some("09:00"), "开始时间").is_ok());
        assert!(check_date_time_pair(None, None, "开始时间").is_ok());
        assert!(check_date_time_pair(Some("2026-09-01"), None, "开始时间").is_ok());
        assert!(check_date_time_pair(None, Some("09:00"), "开始时间").is_err());
    }

    #[test]
    fn end_not_before_start() {
        assert!(check_end_not_before_start(Some("2026-09-05"), Some("2026-09-01")).is_err());
        assert!(check_end_not_before_start(Some("2026-09-01"), Some("2026-09-05")).is_ok());
        assert!(check_end_not_before_start(Some("2026-09-01"), None).is_ok());
    }
}
