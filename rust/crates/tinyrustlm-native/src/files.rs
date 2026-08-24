use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

use crate::response::{NativeError, NativeResult};

pub(crate) fn open_regular_file(path: &Path) -> NativeResult<File> {
    if path.as_os_str().is_empty() {
        return Err(NativeError::new("native-path"));
    }
    let metadata = fs::symlink_metadata(path).map_err(|_| NativeError::new("native-io"))?;
    if !metadata.file_type().is_file() || is_reparse_point(&metadata) {
        return Err(NativeError::new("native-path-type"));
    }
    let file = File::open(path).map_err(|_| NativeError::new("native-io"))?;
    let opened = file.metadata().map_err(|_| NativeError::new("native-io"))?;
    if !opened.is_file() || is_reparse_point(&opened) {
        return Err(NativeError::new("native-path-type"));
    }
    Ok(file)
}

pub(crate) fn read_regular_file(path: &Path, maximum_bytes: u64) -> NativeResult<Vec<u8>> {
    let mut source = open_regular_file(path)?;
    let length = source
        .metadata()
        .map_err(|_| NativeError::new("native-io"))?
        .len();
    if length == 0 || length > maximum_bytes {
        return Err(NativeError::new("native-file-size"));
    }
    let length = usize::try_from(length).map_err(|_| NativeError::new("native-arithmetic"))?;
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(length)
        .map_err(|_| NativeError::new("native-allocation"))?;
    bytes.resize(length, 0);
    source
        .read_exact(&mut bytes)
        .map_err(|_| NativeError::new("native-io"))?;
    let mut trailing = [0_u8; 1];
    if source
        .read(&mut trailing)
        .map_err(|_| NativeError::new("native-io"))?
        != 0
    {
        return Err(NativeError::new("native-source-drift"));
    }
    Ok(bytes)
}

pub(crate) fn path_text(path: &Path) -> NativeResult<String> {
    path.to_str()
        .map(str::to_owned)
        .ok_or_else(|| NativeError::new("native-path-encoding"))
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
const fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}
