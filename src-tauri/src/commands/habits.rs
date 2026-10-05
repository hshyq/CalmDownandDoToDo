//! 打卡项 IPC（PRD 6.11 v1.25；验收 TC-CK）。
//! 写操作经 undo 包装：新增/改名/换色/删除各为一步撤销。

use tauri::{AppHandle, State};

use crate::store::habits::Habit;
use crate::store::Db;
use crate::undo::{UndoCmd, UndoStack};

use super::undo::emit_depth;

#[tauri::command]
pub fn list_habits(db: State<'_, Db>) -> Result<Vec<Habit>, String> {
    db.list_habits().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_habit(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    name: String,
    color: String,
) -> Result<Habit, String> {
    let habit = db.create_habit(&name, &color).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::HabitCreate {
        habit: Box::new(habit.clone()),
    }));
    emit_depth(&app, &stack);
    Ok(habit)
}

#[tauri::command]
pub fn rename_habit(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    name: String,
) -> Result<(), String> {
    let before = db.get_habit(id).map_err(|e| e.to_string())?;
    db.rename_habit(id, &name).map_err(|e| e.to_string())?;
    let after = db.get_habit(id).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::HabitUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn set_habit_color(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    color: String,
) -> Result<(), String> {
    let before = db.get_habit(id).map_err(|e| e.to_string())?;
    db.set_habit_color(id, &color).map_err(|e| e.to_string())?;
    let after = db.get_habit(id).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::HabitUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

/// 设置/清除打卡项模板（v1.25 ③）：None=清除；一步撤销（复用 HabitUpdate 整行快照）。
#[tauri::command]
pub fn set_habit_template(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    template: Option<String>,
) -> Result<(), String> {
    let before = db.get_habit(id).map_err(|e| e.to_string())?;
    db.set_habit_template(id, template.as_deref())
        .map_err(|e| e.to_string())?;
    let after = db.get_habit(id).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::HabitUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

/// 删除打卡项：仅解除其打卡记录的打卡身份（事项保留）；撤销=重建行并恢复身份关联。
#[tauri::command]
pub fn delete_habit(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
) -> Result<usize, String> {
    let habit = db.get_habit(id).map_err(|e| e.to_string())?;
    let affected = db.delete_habit(id).map_err(|e| e.to_string())?;
    let n = affected.len();
    stack.push(Box::new(UndoCmd::HabitDelete {
        habit: Box::new(habit),
        affected,
    }));
    emit_depth(&app, &stack);
    Ok(n)
}
