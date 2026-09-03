//! store：SQLite 唯一写库方（AGENTS 红线 3，所有 SQL 收口本模块）。
//!
//! 职责：连接管理（Mutex 单连接，决策 D3/D7）、schema 迁移、归属/排序查询。
//! 归属规则不落库，由查询条件表达（PRD 5.1/技术方案 3.1）。

pub mod schema;
pub mod validation;

use std::fmt;
use std::fs;
use std::path::Path;

#[cfg(test)]
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;

/// 数据库文件名（位于 exe 同目录 `data\`，运行期解析，禁止硬编码绝对路径）。
const DB_FILE: &str = "calendar.db";

/// store 统一错误：内部使用，IPC 层负责转成界面友好提示。
#[derive(Debug)]
pub enum Error {
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
    Lock(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => write!(f, "数据目录操作失败：{e}"),
            Error::Sqlite(e) => write!(f, "数据库操作失败：{e}"),
            Error::Lock(msg) => write!(f, "{msg}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e)
    }
}

impl From<rusqlite::Error> for Error {
    fn from(e: rusqlite::Error) -> Self {
        Error::Sqlite(e)
    }
}

pub type Result<T> = std::result::Result<T, Error>;

/// 日历视图内的一条事项（起止日期均非空，技术方案 3.1）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CalendarItem {
    pub id: i64,
    pub category_id: i64,
    pub title: String,
    pub start_date: String,
    pub start_time: Option<String>,
    pub end_date: String,
    pub end_time: Option<String>,
}

/// 待办列表内的一条事项（开始或结束缺失；截止可空，空=「长期规划」沉底）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TodoItem {
    pub id: i64,
    pub category_id: i64,
    pub title: String,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub created_at: String,
}

/// SQLite 单连接（Mutex 串行化，单用户桌面场景足够）。
pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    /// 在 `data_dir` 下打开/创建 `calendar.db` 并执行迁移（幂等）。
    pub fn open(data_dir: &Path) -> Result<Self> {
        fs::create_dir_all(data_dir)?;
        let conn = Connection::open(data_dir.join(DB_FILE))?;
        let mut db = Db {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    /// 连接级初始化：外键开关 + 增量迁移。
    fn initialize(&mut self) -> Result<()> {
        let mut guard = self.lock()?;
        guard.execute_batch("PRAGMA foreign_keys = ON;")?;
        schema::migrate(&mut guard)?;
        Ok(())
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|_| Error::Lock("数据库连接已被占用".to_string()))
    }

    /// 日历集合：窗口交集 `start_date <= view_end AND end_date >= view_start`。
    pub fn list_calendar_items(
        &self,
        view_start: &str,
        view_end: &str,
        category_id: Option<i64>,
    ) -> Result<Vec<CalendarItem>> {
        const SQL: &str = r#"
SELECT id, category_id, title, start_date, start_time, end_date, end_time
FROM items
WHERE start_date IS NOT NULL AND end_date IS NOT NULL
  AND start_date <= ?1 AND end_date >= ?2
  AND (?3 IS NULL OR category_id = ?3)
ORDER BY start_date ASC, COALESCE(start_time, '00:00') ASC, created_at ASC, id ASC
"#;
        let guard = self.lock()?;
        let mut stmt = guard.prepare(SQL)?;
        let rows = stmt.query_map(
            rusqlite::params![view_end, view_start, category_id],
            |row| {
                Ok(CalendarItem {
                    id: row.get(0)?,
                    category_id: row.get(1)?,
                    title: row.get(2)?,
                    start_date: row.get(3)?,
                    start_time: row.get(4)?,
                    end_date: row.get(5)?,
                    end_time: row.get(6)?,
                })
            },
        )?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// 待办集合：无截止视为哨兵 `9999-12-31` 沉底（PRD 5.2），created_at 兜底排序。
    pub fn list_todo_items(&self, category_id: Option<i64>) -> Result<Vec<TodoItem>> {
        const SQL: &str = r#"
SELECT id, category_id, title, due_date, due_time, created_at
FROM items
WHERE (start_date IS NULL OR end_date IS NULL)
  AND (?1 IS NULL OR category_id = ?1)
ORDER BY COALESCE(due_date, '9999-12-31') ASC,
         COALESCE(due_time, '00:00') ASC,
         created_at ASC, id ASC
"#;
        let guard = self.lock()?;
        let mut stmt = guard.prepare(SQL)?;
        let rows = stmt.query_map([category_id], |row| {
            Ok(TodoItem {
                id: row.get(0)?,
                category_id: row.get(1)?,
                title: row.get(2)?,
                due_date: row.get(3)?,
                due_time: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

/// 测试用临时数据目录（结束自动清理）。
#[cfg(test)]
struct TempDir(PathBuf);

#[cfg(test)]
impl TempDir {
    fn new(tag: &str) -> Self {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("系统时间早于 1970")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "calendar_todo_{tag}_{}_{nanos}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("创建临时目录失败");
        TempDir(path)
    }
}

#[cfg(test)]
impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 插入一条事项（测试辅助；显式 created_at 便于验证排序兜底）。
    #[allow(clippy::too_many_arguments)] // 测试辅助，保持直白调用
    fn insert_item(
        db: &Db,
        category_id: i64,
        title: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
        due_date: Option<&str>,
        due_time: Option<&str>,
        created_at: &str,
    ) -> i64 {
        let guard = db.lock().expect("取锁失败");
        guard
            .execute(
                "INSERT INTO items (category_id, title, start_date, end_date, due_date, due_time, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    category_id,
                    title,
                    start_date,
                    end_date,
                    due_date,
                    due_time,
                    created_at
                ],
            )
            .expect("插入失败");
        guard.last_insert_rowid()
    }

    fn insert_category(db: &Db, name: &str, color: &str, sort_order: i64) -> i64 {
        let guard = db.lock().expect("取锁失败");
        guard
            .execute(
                "INSERT INTO categories (name, color, sort_order, kind) VALUES (?1, ?2, ?3, 'normal')",
                rusqlite::params![name, color, sort_order],
            )
            .expect("插入分类失败");
        guard.last_insert_rowid()
    }

    #[test]
    fn open_creates_db_and_migrates() {
        let dir = TempDir::new("open");
        let db = Db::open(dir.0.as_path()).expect("打开数据库失败");
        assert!(dir.0.join(DB_FILE).exists());
        let guard = db.lock().expect("取锁失败");
        let v: i64 = guard
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |r| {
                r.get(0)
            })
            .expect("查询版本失败");
        assert_eq!(v, 1);
    }

    #[test]
    fn calendar_and_todo_partition() {
        let dir = TempDir::new("partition");
        let db = Db::open(dir.0.as_path()).expect("打开失败");
        let cat = insert_category(&db, "工作", "#4F8EF7", 0);

        // A：有起止 → 日历
        insert_item(
            &db,
            cat,
            "A 完整日程",
            Some("2026-09-01"),
            Some("2026-09-03"),
            None,
            None,
            "t1",
        );
        // B：仅开始 → 待办
        insert_item(
            &db,
            cat,
            "B 仅开始",
            Some("2026-09-01"),
            None,
            None,
            None,
            "t2",
        );
        // C：仅截止 → 待办（2026-09-10 组）
        insert_item(
            &db,
            cat,
            "C 仅截止",
            None,
            None,
            Some("2026-09-10"),
            Some("10:00"),
            "t3",
        );
        // D：无时间无截止 → 待办「长期规划」沉底
        insert_item(&db, cat, "D 无时间", None, None, None, None, "t4");
        // E：有起止且有截止 → 仍日历（截止只详情展示）
        insert_item(
            &db,
            cat,
            "E 日历带截止",
            Some("2026-09-05"),
            Some("2026-09-06"),
            Some("2026-09-10"),
            None,
            "t5",
        );

        let cal = db
            .list_calendar_items("2026-09-01", "2026-09-30", None)
            .expect("查询日历失败");
        let titles: Vec<&str> = cal.iter().map(|i| i.title.as_str()).collect();
        assert_eq!(
            titles,
            vec!["A 完整日程", "E 日历带截止"],
            "日历集合错：{titles:?}"
        );

        let todo = db.list_todo_items(None).expect("查询待办失败");
        // 排序：D(无截止沉底) 在 C(09-10) 之后；B 无截止同样沉底，按 created_at(id) 兜底
        assert_eq!(
            todo.iter().map(|i| i.title.as_str()).collect::<Vec<_>>(),
            vec!["C 仅截止", "B 仅开始", "D 无时间"]
        );
    }

    #[test]
    fn calendar_window_intersection_and_category_filter() {
        let dir = TempDir::new("window");
        let db = Db::open(dir.0.as_path()).expect("打开失败");
        let cat1 = insert_category(&db, "工作", "#4F8EF7", 0);
        let cat2 = insert_category(&db, "生活", "#34B96F", 1);

        // 跨窗口事项：08-30 ~ 09-02（8 月视图显示 08-31、9 月视图显示 09-01）
        insert_item(
            &db,
            cat1,
            "跨月长条",
            Some("2026-08-30"),
            Some("2026-09-02"),
            None,
            None,
            "t1",
        );
        // 窗口内 9 月事项（生活分类）
        insert_item(
            &db,
            cat2,
            "9 月中段",
            Some("2026-09-10"),
            Some("2026-09-12"),
            None,
            None,
            "t2",
        );

        // 8 月视图窗口（08-31~09-06 所在月）：应命中跨月长条
        let aug = db
            .list_calendar_items("2026-08-01", "2026-08-31", None)
            .expect("查询失败");
        assert!(aug.iter().any(|i| i.title == "跨月长条"));
        assert!(!aug.iter().any(|i| i.title == "9 月中段"));

        // 9 月视图窗口 + 分类过滤
        let sep_work = db
            .list_calendar_items("2026-09-01", "2026-09-30", Some(cat1))
            .expect("查询失败");
        assert!(sep_work.iter().all(|i| i.category_id == cat1));

        // 事项开始列归属测试不在此层（布局为前端纯函数），此处仅验证查询窗口。
        let sep_all = db
            .list_calendar_items("2026-09-01", "2026-09-30", None)
            .expect("查询失败");
        assert!(sep_all.iter().any(|i| i.title == "跨月长条"));
        assert!(sep_all.iter().any(|i| i.title == "9 月中段"));
    }

    #[test]
    fn todo_same_day_created_at_fallback() {
        let dir = TempDir::new("created");
        let db = Db::open(dir.0.as_path()).expect("打开失败");
        let cat = insert_category(&db, "工作", "#4F8EF7", 0);
        // 同截止日期、同无时刻，按 created_at 升序（PRD 5.2 / TC-DUE-004）
        insert_item(
            &db,
            cat,
            "早建",
            None,
            None,
            Some("2026-09-10"),
            None,
            "2026-09-01T01:00:00",
        );
        insert_item(
            &db,
            cat,
            "晚建",
            None,
            None,
            Some("2026-09-10"),
            None,
            "2026-09-02T01:00:00",
        );
        let todo = db.list_todo_items(None).expect("查询失败");
        let titles: Vec<&str> = todo.iter().map(|i| i.title.as_str()).collect();
        assert_eq!(titles, vec!["早建", "晚建"]);
    }
}
