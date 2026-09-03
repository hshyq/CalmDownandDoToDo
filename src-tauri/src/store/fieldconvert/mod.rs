//! store::fieldconvert —— 字段类型转换矩阵（PRD 6.6 / 技术方案 5.3）。
//! 纯函数、无 SQL：(from,to) 表驱动，穷举单测覆盖全路径。

use serde_json::Value;

/// 六种字段类型（PRD 4.3）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FieldType {
    Text,
    Multiline,
    Number,
    Date,
    Single,
    Multi,
}

impl FieldType {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "text" => Some(FieldType::Text),
            "multiline" => Some(FieldType::Multiline),
            "number" => Some(FieldType::Number),
            "date" => Some(FieldType::Date),
            "single_choice" => Some(FieldType::Single),
            "multi_choice" => Some(FieldType::Multi),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            FieldType::Text => "text",
            FieldType::Multiline => "multiline",
            FieldType::Number => "number",
            FieldType::Date => "date",
            FieldType::Single => "single_choice",
            FieldType::Multi => "multi_choice",
        }
    }

    pub fn is_choice(self) -> bool {
        matches!(self, FieldType::Single | FieldType::Multi)
    }
}

/// 把某类型字段的 value_json 解码为「值集合」：
/// 单值类型 → 长度 1；多选 → 多元素；NULL → None。
pub fn decode_value(ftype: FieldType, value_json: Option<&str>) -> Option<Vec<String>> {
    let raw = value_json?;
    if ftype == FieldType::Multi {
        let v: Value = serde_json::from_str(raw).ok()?;
        let arr = v.as_array()?;
        let list: Vec<String> = arr
            .iter()
            .filter_map(|x| x.as_str().map(String::from))
            .collect();
        if list.is_empty() {
            None
        } else {
            Some(list)
        }
    } else {
        let v: Value = serde_json::from_str(raw).ok()?;
        let s = v.as_str()?;
        if s.is_empty() {
            None
        } else {
            Some(vec![s.to_string()])
        }
    }
}

/// 把「值集合」编码回 value_json（按目标类型：多选=JSON 数组，其余=JSON 字符串）。
pub fn encode_value(ftype: FieldType, vals: Option<Vec<String>>) -> Option<String> {
    let list = vals?;
    if list.is_empty() {
        return None;
    }
    if ftype == FieldType::Multi {
        Some(serde_json::to_string(&list).expect("数组序列化不会失败"))
    } else {
        Some(serde_json::to_string(&list[0]).expect("字符串序列化不会失败"))
    }
}

/// 「可解析为数字」：去除首尾空格后是合法整数或小数（PRD 6.6）。
pub fn parse_number(s: &str) -> Option<String> {
    let t = s.trim();
    if t.parse::<f64>().is_ok() {
        Some(t.to_string())
    } else {
        None
    }
}

/// 「可解析为日期」：YYYY-MM-DD 或 YYYY-MM-DD HH:mm 且为真实日期（PRD 6.6）。
pub fn parse_date(s: &str) -> Option<String> {
    let t = s.trim();
    let date_part = t.split_whitespace().next()?;
    let parts: Vec<&str> = date_part.split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let y: i64 = parts[0].parse().ok()?;
    let m: i64 = parts[1].parse().ok()?;
    let d: i64 = parts[2].parse().ok()?;
    if !(1..=12).contains(&m) {
        return None;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
    let dim = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        _ => return None,
    };
    if !(1..=dim).contains(&d) {
        return None;
    }
    Some(t.to_string())
}

/// 取单值集合的第一个值（无值/空 → None）。
fn single(vals: Option<Vec<String>>) -> Option<String> {
    vals.and_then(|v| v.into_iter().next())
}

/**
 * 字段类型转换矩阵（PRD 6.6）。`options` 为字段既有选项（单选/多选校验用；
 * 文本/数字/日期 → 单选/多选 时选项由调用方基于历史值生成，故值原样保留）。
 * 返回目标类型语义下的值集合（None=清空）。
 */
pub fn convert_value(
    from: FieldType,
    to: FieldType,
    vals: Option<Vec<String>>,
    options: &[String],
) -> Option<Vec<String>> {
    if from == to {
        return vals;
    }
    let scalar = |v: Option<Vec<String>>| single(v);
    match (from, to) {
        // —— 单值型（text/multiline/number/date）→ 任意 ——
        (FieldType::Text | FieldType::Multiline | FieldType::Number | FieldType::Date, to)
            if !to.is_choice() =>
        {
            let s = scalar(vals)?;
            let ok = match to {
                FieldType::Number => parse_number(&s)?,
                FieldType::Date => parse_date(&s)?,
                _ => s,
            };
            Some(vec![ok])
        }
        (FieldType::Text | FieldType::Multiline | FieldType::Number | FieldType::Date, to) => {
            let s = scalar(vals)?;
            Some(vec![s]).filter(|_| to == FieldType::Single || to == FieldType::Multi)
        }
        // —— 单选 → 目标 ——
        (FieldType::Single, FieldType::Text | FieldType::Multiline) => {
            let s = scalar(vals)?;
            Some(vec![s])
        }
        (FieldType::Single, FieldType::Number) => {
            let s = scalar(vals)?;
            parse_number(&s).map(|n| vec![n])
        }
        (FieldType::Single, FieldType::Date) => {
            let s = scalar(vals)?;
            parse_date(&s).map(|d| vec![d])
        }
        (FieldType::Single, FieldType::Multi) => {
            let s = scalar(vals)?;
            if options.iter().any(|o| o == &s) {
                Some(vec![s])
            } else {
                None
            }
        }
        // —— 多选 → 目标 ——
        (FieldType::Multi, FieldType::Text | FieldType::Multiline) => {
            let arr = vals?;
            let joined = arr.join("、");
            if joined.is_empty() {
                None
            } else {
                Some(vec![joined])
            }
        }
        (FieldType::Multi, FieldType::Number) => {
            let arr = vals?;
            parse_number(&arr.join("、")).map(|n| vec![n])
        }
        (FieldType::Multi, FieldType::Date) => {
            let arr = vals?;
            parse_date(&arr.join("、")).map(|d| vec![d])
        }
        (FieldType::Multi, FieldType::Single) => {
            let arr = vals?;
            arr.into_iter()
                .find(|x| options.iter().any(|o| o == x))
                .map(|x| vec![x])
        }
        (FieldType::Multi, FieldType::Multi) => {
            let arr = vals?;
            let kept: Vec<String> = arr
                .into_iter()
                .filter(|x| options.iter().any(|o| o == x))
                .collect();
            if kept.is_empty() {
                None
            } else {
                Some(kept)
            }
        }
        _ => vals,
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &str) -> Option<Vec<String>> {
        Some(vec![v.to_string()])
    }

    #[test]
    fn text_to_number_or_date() {
        // TC-FLD-004："123"→保留；"abc"→清空；" 45 "→去空格保留
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Number, s("123"), &[]),
            s("123")
        );
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Number, s("abc"), &[]),
            None
        );
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Number, s(" 45 "), &[]),
            s("45")
        );
        // TC-FLD-006："2026-09-01" 保留；"9月1日" 清空
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Date, s("2026-09-01"), &[]),
            s("2026-09-01")
        );
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Date, s("9月1日"), &[]),
            None
        );
    }

    #[test]
    fn number_date_to_text() {
        // TC-FLD-005/007：数字→文本、日期→文本 无损
        assert_eq!(
            convert_value(FieldType::Number, FieldType::Text, s("3.14"), &[]),
            s("3.14")
        );
        assert_eq!(
            convert_value(FieldType::Date, FieldType::Multiline, s("2026-09-01"), &[]),
            s("2026-09-01")
        );
        // 日期→数字 清空；数字→日期 可解析则转
        assert_eq!(
            convert_value(FieldType::Date, FieldType::Number, s("2026-09-01"), &[]),
            None
        );
        assert_eq!(
            convert_value(FieldType::Number, FieldType::Date, s("2026-09-01"), &[]),
            s("2026-09-01")
        );
        assert_eq!(
            convert_value(FieldType::Number, FieldType::Date, s("3.14"), &[]),
            None
        );
    }

    #[test]
    fn scalar_to_single_multi_keeps_value() {
        // TC-FLD-008/009/015/016：文本/数字/日期 → 单选/多选 值保留（选项由历史生成）
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Single, s("学习"), &[]),
            s("学习")
        );
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Multi, s("学习"), &[]),
            s("学习")
        );
        assert_eq!(
            convert_value(FieldType::Number, FieldType::Single, s("3.14"), &[]),
            s("3.14")
        );
        assert_eq!(
            convert_value(FieldType::Date, FieldType::Multi, s("2026-09-01"), &[]),
            s("2026-09-01")
        );
    }

    #[test]
    fn single_multi_cross() {
        let opts: Vec<String> = ["X", "Y"].iter().map(|x| x.to_string()).collect();
        // 单选→多选：值在选项中保留（TC-FLD-010）
        assert_eq!(
            convert_value(FieldType::Single, FieldType::Multi, s("X"), &opts),
            s("X")
        );
        assert_eq!(
            convert_value(FieldType::Single, FieldType::Multi, s("Z"), &opts),
            None
        );
        // 多选→单选：保留第一个仍在选项中的（TC-FLD-011）
        let arr = Some(vec!["Z".to_string(), "X".to_string(), "Y".to_string()]);
        assert_eq!(
            convert_value(FieldType::Multi, FieldType::Single, arr.clone(), &opts),
            s("X")
        );
        let bad = Some(vec!["Z".to_string()]);
        assert_eq!(
            convert_value(FieldType::Multi, FieldType::Single, bad, &opts),
            None
        );
        // 多选→多选（同类型）：change_type 不改动（选项编辑失效项过滤在 set_options，TC-FLD-013）
        let mixed = Some(vec!["X".to_string(), "Z".to_string(), "Y".to_string()]);
        assert_eq!(
            convert_value(FieldType::Multi, FieldType::Multi, mixed.clone(), &opts),
            mixed
        );
    }

    #[test]
    fn multi_join_and_single_to_scalar() {
        let opts: Vec<String> = ["X", "Y"].iter().map(|x| x.to_string()).collect();
        let arr = Some(vec!["A".to_string(), "B".to_string()]);
        // 多选→文本：以「、」连接（PRD 6.6）
        assert_eq!(
            convert_value(FieldType::Multi, FieldType::Text, arr.clone(), &opts),
            s("A、B")
        );
        // 多选→数字：连接后可解析才转（通常清空）
        assert_eq!(
            convert_value(FieldType::Multi, FieldType::Number, arr, &opts),
            None
        );
        // 单选→文本/数字/日期
        assert_eq!(
            convert_value(FieldType::Single, FieldType::Text, s("3.14"), &opts),
            s("3.14")
        );
        assert_eq!(
            convert_value(FieldType::Single, FieldType::Number, s("3.14"), &opts),
            s("3.14")
        );
        assert_eq!(
            convert_value(FieldType::Single, FieldType::Number, s("abc"), &opts),
            None
        );
    }

    #[test]
    fn empty_value_stays_empty() {
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Single, None, &[]),
            None
        );
        assert_eq!(
            convert_value(FieldType::Multi, FieldType::Text, None, &[]),
            None
        );
        // 同类型不变
        assert_eq!(
            convert_value(FieldType::Text, FieldType::Text, s("x"), &[]),
            s("x")
        );
    }

    #[test]
    fn json_roundtrip() {
        assert_eq!(decode_value(FieldType::Text, Some("\"abc\"")), s("abc"));
        assert_eq!(
            encode_value(FieldType::Text, s("abc")).as_deref(),
            Some("\"abc\"")
        );
        let multi = Some(vec!["a".to_string(), "b".to_string()]);
        let enc = encode_value(FieldType::Multi, multi.clone()).expect("编码失败");
        assert_eq!(decode_value(FieldType::Multi, Some(&enc)), multi);
        assert_eq!(decode_value(FieldType::Text, Some("\"\"")), None);
        assert_eq!(decode_value(FieldType::Text, None), None);
    }
}
