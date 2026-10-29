use std::io::Write;
use std::path::Path;

/// Writes `bytes` to `path` atomically: a temporary file next to the target is renamed over it.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let dir = path
        .parent()
        .filter(|dir| !dir.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    // The temporary file lives in the target directory so the rename stays on one file system.
    // It is removed on drop unless persisted, so a failed write leaves nothing behind.
    let mut temporary = tempfile::NamedTempFile::new_in(dir)?;
    temporary.write_all(bytes)?;
    // A new temporary file is private (0600); a replaced file keeps the permissions it had.
    if let Ok(existing) = std::fs::metadata(path)
        && existing.is_file()
    {
        temporary
            .as_file()
            .set_permissions(existing.permissions())?;
    }
    temporary.as_file().sync_all()?;
    temporary.persist(path).map_err(|error| error.error)?;
    Ok(())
}

/// Tauri command: whether something exists at `path`.
#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Tauri command: writes the bytes of the request body to the percent-encoded path in the `path` header.
#[tauri::command]
pub fn write_file_atomic(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let path = request
        .headers()
        .get("path")
        .and_then(|value| value.to_str().ok())
        .ok_or("missing path header")?;
    let path = percent_encoding::percent_decode_str(path)
        .decode_utf8()
        .map_err(|error| error.to_string())?;
    atomic_write(Path::new(path.as_ref()), bytes).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn names(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn writes_a_new_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("a.tpsheet");
        atomic_write(&target, b"hello").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"hello");
        assert_eq!(names(dir.path()), ["a.tpsheet"]);
    }

    #[test]
    fn replaces_an_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("a.tpsheet");
        fs::write(&target, b"old content that is longer").unwrap();
        atomic_write(&target, b"new").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"new");
        assert_eq!(names(dir.path()), ["a.tpsheet"]);
    }

    #[test]
    fn leaves_the_original_untouched_and_no_temporary_file_when_writing_fails() {
        let dir = tempfile::tempdir().unwrap();
        // A non-empty directory cannot be replaced by a file, so the final rename fails.
        let target = dir.path().join("a.tpsheet");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("keep.txt"), b"keep").unwrap();
        assert!(atomic_write(&target, b"new").is_err());
        assert_eq!(fs::read(target.join("keep.txt")).unwrap(), b"keep");
        assert_eq!(names(dir.path()), ["a.tpsheet"]);
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_permissions_of_the_replaced_file() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("a.tpsheet");
        fs::write(&target, b"old").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o644)).unwrap();
        atomic_write(&target, b"new").unwrap();
        let mode = fs::metadata(&target).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o644);
    }

    #[test]
    fn reports_whether_a_file_exists() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("a.tpsheet");
        assert!(!file_exists(target.to_str().unwrap().into()));
        fs::write(&target, b"x").unwrap();
        assert!(file_exists(target.to_str().unwrap().into()));
    }

    #[test]
    fn fails_when_the_directory_does_not_exist() {
        let dir = tempfile::tempdir().unwrap();
        assert!(atomic_write(&dir.path().join("missing/a.tpsheet"), b"x").is_err());
    }
}
