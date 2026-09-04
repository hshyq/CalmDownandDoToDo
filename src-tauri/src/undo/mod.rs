//! undo —— 撤销/重做双栈（PRD 6.7 / 技术方案 5.3：上限 10 步，重启清空）。
//! 行级/级联操作用快照（store::snapshot）；整库导入快照按 D10 落 `data\undo_tmp` 临时文件
//! （内存只存路径，重启清理；一期无 mail_config，导入/快照均不含授权码）。

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use crate::store::categories::{Category, DeleteMode};
use crate::store::snapshot::{CategorySnapshot, FieldSnapshot, ItemSnapshot};
use crate::store::{Db, Result};

/// 单步命令：apply=重做执行，revert=撤销执行。
pub trait Command: Send {
    fn apply(&self, db: &Db) -> Result<()>;
    fn revert(&self, db: &Db) -> Result<()>;
    fn describe(&self) -> String;
}

/// 撤销临时文件句柄：离开撤销栈（丢弃/重启）时自动删除（D10）。
pub struct TmpFile {
    path: PathBuf,
}

impl TmpFile {
    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TmpFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

/// 具体命令（enum 化，避免大量零散 struct；数据均为快照，Send）。
pub enum UndoCmd {
    /// 新建分类：revert=删除（级联兜底），apply=重建行。
    CategoryCreate { cat: Category },
    /// 分类改名/改色：按行前后快照覆盖。
    CategoryUpdate { before: Category, after: Category },
    /// 删除分类（cascade / 移入未分类）：revert=整分类级联恢复，apply=重放删除。
    CategoryDelete {
        snap: Box<CategorySnapshot>,
        mode: DeleteMode,
    },
    /// 新增事项：revert=删除该事项，apply=重建行与字段值。
    ItemCreate { snap: Box<ItemSnapshot> },
    /// 编辑事项（含字段值保存、可换分类）：按前后全量快照覆盖。
    ItemUpdate {
        before: Box<ItemSnapshot>,
        after: Box<ItemSnapshot>,
    },
    /// 删除事项：revert=重建行与字段值，apply=删除。
    ItemDelete { snap: Box<ItemSnapshot> },
    /// 新建字段：revert=删除字段（值级联），apply=重建模板。
    FieldCreate { snap: Box<FieldSnapshot> },
    /// 字段改名/改类型/选项变更：按前后模板+值快照覆盖。
    FieldUpdate {
        before: Box<FieldSnapshot>,
        after: Box<FieldSnapshot>,
    },
    /// 删除字段：revert=重建模板与值，apply=删除。
    FieldDelete { snap: Box<FieldSnapshot> },
    /// 字段上移/下移：恢复受影响字段的 sort_order。
    FieldSort {
        before: Vec<(i64, i64)>,
        after: Vec<(i64, i64)>,
    },
    /// 备份导入：revert=恢复导入前整库快照（落盘 undo_tmp，D10）；apply=重放导入内容。
    Import { before: TmpFile, import: String },
}

impl Command for UndoCmd {
    fn apply(&self, db: &Db) -> Result<()> {
        match self {
            UndoCmd::CategoryCreate { cat } => db.restore_category_row(cat),
            UndoCmd::CategoryUpdate { before: _, after } => db.restore_category_row(after),
            UndoCmd::CategoryDelete { snap, mode } => db.delete_category(snap.category.id, *mode),
            UndoCmd::ItemCreate { snap } => db.restore_item(snap),
            UndoCmd::ItemUpdate { before: _, after } => db.restore_item(after),
            UndoCmd::ItemDelete { snap } => db.delete_item(snap.item.id),
            UndoCmd::FieldCreate { snap } => db.restore_field(snap),
            UndoCmd::FieldUpdate { before: _, after } => db.restore_field(after),
            UndoCmd::FieldDelete { snap } => db.delete_field(snap.def.id),
            UndoCmd::FieldSort { before: _, after } => {
                for (id, sort) in after {
                    db.set_field_sort(*id, *sort)?;
                }
                Ok(())
            }
            UndoCmd::Import { before: _, import } => db.import_json(import),
        }
    }

    fn revert(&self, db: &Db) -> Result<()> {
        match self {
            UndoCmd::CategoryCreate { cat } => db.delete_category(cat.id, DeleteMode::Cascade),
            UndoCmd::CategoryUpdate { before, after: _ } => db.restore_category_row(before),
            UndoCmd::CategoryDelete { snap, mode: _ } => db.restore_category(snap),
            UndoCmd::ItemCreate { snap } => db.delete_item(snap.item.id),
            UndoCmd::ItemUpdate { before, after: _ } => db.restore_item(before),
            UndoCmd::ItemDelete { snap } => db.restore_item(snap),
            UndoCmd::FieldCreate { snap } => db.delete_field(snap.def.id),
            UndoCmd::FieldUpdate { before, after: _ } => db.restore_field(before),
            UndoCmd::FieldDelete { snap } => db.restore_field(snap),
            UndoCmd::FieldSort { before, after: _ } => {
                for (id, sort) in before {
                    db.set_field_sort(*id, *sort)?;
                }
                Ok(())
            }
            UndoCmd::Import { before, import: _ } => {
                let text = fs::read_to_string(before.path()).map_err(crate::store::Error::Io)?;
                db.import_json(&text)
            }
        }
    }

    fn describe(&self) -> String {
        match self {
            UndoCmd::CategoryCreate { .. } => "新建分类".into(),
            UndoCmd::CategoryUpdate { .. } => "修改分类".into(),
            UndoCmd::CategoryDelete { .. } => "删除分类".into(),
            UndoCmd::ItemCreate { .. } => "新增事项".into(),
            UndoCmd::ItemUpdate { .. } => "编辑事项".into(),
            UndoCmd::ItemDelete { .. } => "删除事项".into(),
            UndoCmd::FieldCreate { .. } => "新增字段".into(),
            UndoCmd::FieldUpdate { .. } => "修改字段".into(),
            UndoCmd::FieldDelete { .. } => "删除字段".into(),
            UndoCmd::FieldSort { .. } => "调整字段排序".into(),
            UndoCmd::Import { .. } => "导入备份".into(),
        }
    }
}

/// 撤销栈上限（PRD 6.7：最多 10 步，超出丢弃最旧）。
const MAX_STEPS: usize = 10;

struct StackInner {
    undo: Vec<Box<dyn Command>>,
    redo: Vec<Box<dyn Command>>,
}

/// 双栈（撤销 + 重做）；线程安全，由 Tauri manage 全局共享。
pub struct UndoStack {
    inner: Mutex<StackInner>,
    /// `data\undo_tmp`（D10：整库快照落盘目录，重启清空）。
    tmp_dir: PathBuf,
    file_seq: AtomicUsize,
}

impl UndoStack {
    /// data_dir 为运行期数据目录（exe 同目录 `data\`）；启动即清空上次残留的 undo_tmp。
    pub fn new(data_dir: &Path) -> Self {
        let tmp_dir = data_dir.join("undo_tmp");
        let _ = fs::remove_dir_all(&tmp_dir);
        let _ = fs::create_dir_all(&tmp_dir);
        UndoStack {
            inner: Mutex::new(StackInner {
                undo: Vec::new(),
                redo: Vec::new(),
            }),
            tmp_dir,
            file_seq: AtomicUsize::new(0),
        }
    }

    /// 写整库快照到 undo_tmp，返回临时文件句柄（随命令生命周期删除）。
    pub fn write_tmp(&self, prefix: &str, content: &str) -> std::io::Result<TmpFile> {
        let n = self.file_seq.fetch_add(1, Ordering::SeqCst);
        let path = self
            .tmp_dir
            .join(format!("{prefix}_{}_{n}.json", std::process::id()));
        fs::write(&path, content)?;
        Ok(TmpFile { path })
    }

    /// 新操作入栈：清空重做栈；超出上限丢弃最旧一步（其临时文件随 Drop 删除）。
    pub fn push(&self, cmd: Box<dyn Command>) {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.undo.push(cmd);
        inner.redo.clear();
        if inner.undo.len() > MAX_STEPS {
            inner.undo.remove(0);
        }
    }

    /// 撤销一步：revert 栈顶命令后移入重做栈。返回被撤销操作的描述。
    pub fn undo(&self, db: &Db) -> Result<Option<String>> {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(cmd) = inner.undo.pop() else {
            return Ok(None);
        };
        cmd.revert(db)?;
        let desc = cmd.describe();
        inner.redo.push(cmd);
        Ok(Some(desc))
    }

    /// 重做一步：apply 重做栈顶命令后移回撤销栈。返回被重做操作的描述。
    pub fn redo(&self, db: &Db) -> Result<Option<String>> {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(cmd) = inner.redo.pop() else {
            return Ok(None);
        };
        cmd.apply(db)?;
        let desc = cmd.describe();
        inner.undo.push(cmd);
        Ok(Some(desc))
    }

    /// (可撤销步数, 可重做步数)。
    pub fn depth(&self) -> (usize, usize) {
        let inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        (inner.undo.len(), inner.redo.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::items;

    fn tmp_dir(tag: &str) -> PathBuf {
        static SEQ: AtomicUsize = AtomicUsize::new(0);
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        std::env::temp_dir().join(format!("undo_{tag}_{}_{n}", std::process::id()))
    }

    fn db(dir: &Path) -> Db {
        Db::open(dir).expect("打开库")
    }

    fn work_id(db: &Db) -> i64 {
        db.list_categories()
            .expect("分类")
            .into_iter()
            .find(|c| c.name == "工作")
            .expect("工作")
            .id
    }

    fn mk_item<'a>(cat: i64, title: &'a str) -> items::NewItem<'a> {
        items::NewItem {
            category_id: cat,
            title,
            description: None,
            start_date: None,
            start_time: None,
            end_date: None,
            end_time: None,
            due_date: None,
            due_time: None,
        }
    }

    #[test]
    fn undo_redo_item_create_and_delete() {
        let dir = tmp_dir("icd");
        let db = db(&dir);
        let stack = UndoStack::new(&dir);
        let cat = work_id(&db);

        let it = db.create_item(&mk_item(cat, "写周报")).expect("新增");
        let snap = db.snapshot_item(it.id).expect("快照").expect("存在");
        stack.push(Box::new(UndoCmd::ItemCreate {
            snap: Box::new(snap),
        }));
        assert_eq!(stack.depth(), (1, 0));

        let desc = stack.undo(&db).expect("撤销").expect("有描述");
        assert_eq!(desc, "新增事项");
        assert!(db.get_item(it.id).is_err());
        assert_eq!(stack.depth(), (0, 1));

        stack.redo(&db).expect("重做");
        assert_eq!(db.get_item(it.id).expect("读").title, "写周报");

        let snap2 = db.snapshot_item(it.id).expect("快照2").expect("存在");
        db.delete_item(it.id).expect("删除");
        let stack2 = UndoStack::new(&dir);
        stack2.push(Box::new(UndoCmd::ItemDelete {
            snap: Box::new(snap2),
        }));
        stack2.undo(&db).expect("撤销删除");
        assert_eq!(db.get_item(it.id).expect("读").title, "写周报");
        stack2.redo(&db).expect("重做删除");
        assert!(db.get_item(it.id).is_err());
    }

    #[test]
    fn cap_at_ten_drops_oldest() {
        let dir = tmp_dir("cap");
        let db = db(&dir);
        let stack = UndoStack::new(&dir);
        let cat = work_id(&db);
        for i in 0..12 {
            let it = db
                .create_item(&mk_item(cat, &format!("事项{i}")))
                .expect("新增");
            let snap = db.snapshot_item(it.id).expect("快照").expect("存在");
            stack.push(Box::new(UndoCmd::ItemCreate {
                snap: Box::new(snap),
            }));
        }
        assert_eq!(stack.depth().0, 10);
        for _ in 0..10 {
            assert!(stack.undo(&db).expect("撤销").is_some());
        }
        assert_eq!(stack.depth(), (0, 10));
        assert!(stack.undo(&db).expect("栈空").is_none());
    }

    #[test]
    fn new_operation_clears_redo() {
        let dir = tmp_dir("clear");
        let db = db(&dir);
        let stack = UndoStack::new(&dir);
        let cat = work_id(&db);
        let it = db.create_item(&mk_item(cat, "A")).expect("新增");
        let snap = db.snapshot_item(it.id).expect("快照").expect("存在");
        stack.push(Box::new(UndoCmd::ItemCreate {
            snap: Box::new(snap),
        }));
        stack.undo(&db).expect("撤销");
        assert_eq!(stack.depth(), (0, 1));

        let it2 = db.create_item(&mk_item(cat, "B")).expect("新增");
        let snap2 = db.snapshot_item(it2.id).expect("快照2").expect("存在");
        stack.push(Box::new(UndoCmd::ItemCreate {
            snap: Box::new(snap2),
        }));
        assert_eq!(stack.depth(), (1, 0));
    }

    #[test]
    fn undo_category_update_and_delete_cascade() {
        let dir = tmp_dir("cat");
        let db = db(&dir);
        let c = db.create_category("临时", "#111111").expect("建分类");
        let mut after = c.clone();
        after.name = "临时2".into();
        let stack = UndoStack::new(&dir);
        stack.push(Box::new(UndoCmd::CategoryUpdate {
            before: c.clone(),
            after,
        }));
        stack.undo(&db).expect("撤销改名");
        assert_eq!(
            db.list_categories()
                .expect("分类")
                .iter()
                .find(|x| x.id == c.id)
                .expect("有")
                .name,
            "临时"
        );

        let field = db.create_field(c.id, "备注", "text", None).expect("建字段");
        let it = db.create_item(&mk_item(c.id, "事项")).expect("新增");
        db.set_item_field_values(it.id, vec![(field.id, Some("\"v\"".to_string()))])
            .expect("写值");
        let snap = db.snapshot_category(c.id).expect("快照").expect("存在");
        db.delete_category(c.id, DeleteMode::Cascade).expect("删除");
        let stack2 = UndoStack::new(&dir);
        stack2.push(Box::new(UndoCmd::CategoryDelete {
            snap: Box::new(snap),
            mode: DeleteMode::Cascade,
        }));
        stack2.undo(&db).expect("撤销删除");
        let restored = db.get_item(it.id).expect("恢复事项");
        assert_eq!(restored.title, "事项");
        assert_eq!(
            db.list_item_field_values(it.id).expect("值"),
            vec![(field.id, Some("\"v\"".to_string()))]
        );
    }

    #[test]
    fn import_undo_restores_before_state() {
        let dir = tmp_dir("imp");
        let db = db(&dir);
        let stack = UndoStack::new(&dir);
        let work = work_id(&db);

        // 导入前状态：只有种子分类
        let before_text = db.dump_json().expect("导入前整库快照");

        // 构造导入文件：含一条事项 X；随后把库恢复到导入前（种子）
        let x = db.create_item(&mk_item(work, "X")).expect("新增");
        let import_json = db.dump_json().expect("导出导入文件");
        db.delete_item(x.id).expect("删除 X");
        assert!(db.get_item(x.id).is_err());

        // 执行导入（覆盖为导入文件内容：种子 + X）
        db.import_json(&import_json).expect("导入");
        assert!(db.get_item(x.id).is_ok());

        // 入栈：before=导入前快照（落盘 undo_tmp），import=原文件内容
        let before_file = stack
            .write_tmp("before_import", &before_text)
            .expect("写临时快照");
        stack.push(Box::new(UndoCmd::Import {
            before: before_file,
            import: import_json,
        }));

        // 撤销 → 恢复导入前状态（X 消失）
        stack.undo(&db).expect("撤销导入");
        assert!(db.get_item(x.id).is_err());

        // 重做 → 再次应用导入内容（X 恢复）
        stack.redo(&db).expect("重做导入");
        assert!(db.get_item(x.id).is_ok());
    }
}
