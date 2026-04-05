use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
struct FileTimestamps {
    created: Option<u64>,
    modified: Option<u64>,
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_file_size(path: String) -> Result<u64, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(metadata.len())
}

#[tauri::command]
fn get_file_timestamps(path: String) -> Result<FileTimestamps, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

    let to_millis = |time: SystemTime| -> Option<u64> {
        time.duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as u64)
    };

    let created = metadata.created().ok().and_then(to_millis);
    let modified = metadata.modified().ok().and_then(to_millis);

    Ok(FileTimestamps { created, modified })
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "CREATE TABLE IF NOT EXISTS files (
                path TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS file_tags (
                file_path TEXT NOT NULL,
                tag TEXT NOT NULL,
                PRIMARY KEY (file_path, tag),
                FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_indexed_at_column",
            sql: "ALTER TABLE files ADD COLUMN indexed_at INTEGER;
            UPDATE files SET indexed_at = created_at WHERE indexed_at IS NULL;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:fileuri.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_file,
            show_in_folder,
            get_file_size,
            get_file_timestamps,
            write_text_file,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
