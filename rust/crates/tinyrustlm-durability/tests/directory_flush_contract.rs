#![doc = "Cross-platform owned-directory flush conformance tests."]

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tinyrustlm_durability::{
    flush_owned_directory, DIRECTORY_FLUSH_OBSERVATION_MEMBER_SCHEMA, DIRECTORY_FLUSH_PROFILE_ID,
    DIRECTORY_FLUSH_PROFILE_SHA256,
};

static NEXT_TEST_ROOT: AtomicU64 = AtomicU64::new(0);

struct OwnedTestRoot {
    path: PathBuf,
}

impl OwnedTestRoot {
    fn create(label: &str) -> Self {
        let serial = NEXT_TEST_ROOT.fetch_add(1, Ordering::Relaxed);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "tinyrustlm-durability-{label}-{}-{nanos}-{serial}",
            std::process::id()
        ));
        fs::create_dir(&path).expect("create owned test root");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for OwnedTestRoot {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.path).expect("remove owned test root");
    }
}

#[cfg(windows)]
fn create_directory_link(target: &Path, link: &Path) -> std::io::Result<()> {
    use std::process::{Command, Stdio};

    let status = Command::new("cmd.exe")
        .args(["/d", "/c", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other("junction fixture creation failed"))
    }
}

#[cfg(unix)]
fn create_directory_link(target: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(target, link)
}

#[test]
fn flushes_an_exact_owned_directory_with_public_safe_observation() {
    let root = OwnedTestRoot::create("success");
    fs::create_dir(root.path().join("receipts")).expect("create receipts");
    fs::create_dir(root.path().join("receipts").join("sha256")).expect("create sha root");

    let observation = flush_owned_directory(
        root.path(),
        Path::new("receipts/sha256"),
        "directory-flush-operation-001",
    )
    .expect("flush owned directory");

    assert_eq!(
        observation.schema(),
        DIRECTORY_FLUSH_OBSERVATION_MEMBER_SCHEMA
    );
    assert_eq!(observation.operation_id(), "directory-flush-operation-001");
    assert_eq!(observation.profile_id(), DIRECTORY_FLUSH_PROFILE_ID);
    assert_eq!(observation.profile_sha256(), DIRECTORY_FLUSH_PROFILE_SHA256);
    assert_eq!(observation.status(), "performed");
    assert_eq!(observation.operating_system(), std::env::consts::OS);
    assert_eq!(observation.architecture(), std::env::consts::ARCH);
    assert_eq!(observation.directory_identity_sha256().len(), 64);
    assert!(observation
        .directory_identity_sha256()
        .bytes()
        .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()));
    #[cfg(windows)]
    assert_eq!(
        observation.method(),
        "win32-backup-semantics-flush-file-buffers"
    );
    #[cfg(unix)]
    assert_eq!(observation.method(), "posix-directory-fsync");
}

#[test]
fn flushes_the_explicit_owned_root_scope() {
    let root = OwnedTestRoot::create("root-scope");
    let observation = flush_owned_directory(
        root.path(),
        Path::new("."),
        "directory-flush-operation-root-001",
    )
    .expect("flush owned root scope");

    assert_eq!(observation.status(), "performed");
    assert_eq!(observation.directory_identity_sha256().len(), 64);
}

#[test]
fn rejects_non_absolute_owned_root() {
    let error = flush_owned_directory(
        Path::new("relative-root"),
        Path::new("receipts"),
        "directory-flush-operation-002",
    )
    .expect_err("relative root must fail");
    assert_eq!(error.code(), "directory_root_not_absolute");
}

#[test]
fn rejects_relative_directory_escape_and_absolute_input() {
    let root = OwnedTestRoot::create("escape");
    for relative in [Path::new("../outside"), root.path()] {
        let error = flush_owned_directory(root.path(), relative, "directory-flush-operation-003")
            .expect_err("unsafe relative directory must fail");
        assert_eq!(error.code(), "directory_relative_path_invalid");
    }
}

#[test]
fn rejects_file_leaf_and_missing_directory() {
    let root = OwnedTestRoot::create("leaf");
    fs::write(root.path().join("not-a-directory"), b"bounded").expect("write file leaf");

    let file_error = flush_owned_directory(
        root.path(),
        Path::new("not-a-directory"),
        "directory-flush-operation-004",
    )
    .expect_err("file leaf must fail");
    assert_eq!(file_error.code(), "directory_path_not_directory");

    let missing_error = flush_owned_directory(
        root.path(),
        Path::new("missing"),
        "directory-flush-operation-005",
    )
    .expect_err("missing directory must fail");
    assert_eq!(missing_error.code(), "directory_path_missing");
}

#[cfg(any(windows, unix))]
#[test]
fn rejects_symbolic_link_or_reparse_directory() {
    let root = OwnedTestRoot::create("link");
    let target = root.path().join("target");
    let link = root.path().join("linked");
    fs::create_dir(&target).expect("create link target");
    create_directory_link(&target, &link).expect("create directory link");

    let error = flush_owned_directory(
        root.path(),
        Path::new("linked"),
        "directory-flush-operation-009",
    )
    .expect_err("directory link must fail");
    assert_eq!(error.code(), "directory_path_link");

    fs::remove_dir(&link).expect("remove directory link");
}

#[test]
fn rejects_invalid_operation_identifier() {
    let root = OwnedTestRoot::create("operation");
    for operation_id in ["", "UPPERCASE", "contains space", "ab"] {
        let error = flush_owned_directory(root.path(), Path::new("."), operation_id)
            .expect_err("invalid operation id must fail");
        assert_eq!(error.code(), "directory_operation_id_invalid");
    }
}

#[test]
fn directory_identity_is_stable_and_scope_specific() {
    let root = OwnedTestRoot::create("identity");
    fs::create_dir(root.path().join("first")).expect("create first");
    fs::create_dir(root.path().join("second")).expect("create second");

    let first_a = flush_owned_directory(
        root.path(),
        Path::new("first"),
        "directory-flush-operation-006",
    )
    .expect("flush first a");
    let first_b = flush_owned_directory(
        root.path(),
        Path::new("first"),
        "directory-flush-operation-007",
    )
    .expect("flush first b");
    let second = flush_owned_directory(
        root.path(),
        Path::new("second"),
        "directory-flush-operation-008",
    )
    .expect("flush second");

    assert_eq!(
        first_a.directory_identity_sha256(),
        first_b.directory_identity_sha256()
    );
    assert_ne!(
        first_a.directory_identity_sha256(),
        second.directory_identity_sha256()
    );
}
