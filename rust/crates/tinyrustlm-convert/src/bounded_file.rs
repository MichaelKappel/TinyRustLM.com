//! Fixed-allocation reads for admitted nonempty regular files.

use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;

/// Reads exactly the admitted length and rejects both truncation and growth.
///
/// The final EOF probe uses one stack byte; source growth never extends the
/// allocation. Path and opened-handle checks reject observed links and reparse
/// points, but do not promise atomic pathname identity against replacement.
pub(crate) fn read_bounded_regular_file(path: &Path, maximum_bytes: u64) -> io::Result<Vec<u8>> {
    let initial = fs::symlink_metadata(path)?;
    if metadata_is_link(&initial) || !initial.is_file() {
        return Err(invalid_file());
    }
    admitted_length(initial.len(), maximum_bytes)?;

    let mut file = File::open(path)?;
    let opened = file.metadata()?;
    if metadata_is_link(&opened) || !opened.is_file() || opened.len() != initial.len() {
        return Err(invalid_file());
    }
    read_admitted_bytes(&mut file, initial.len(), maximum_bytes)
}

/// Validates the nonzero byte bound before allocating or reading anything.
fn admitted_length(initial_length: u64, maximum_bytes: u64) -> io::Result<usize> {
    if initial_length == 0 || initial_length > maximum_bytes {
        return Err(invalid_file());
    }
    usize::try_from(initial_length).map_err(|_| invalid_file())
}

/// Enforces the metadata admission even when a reader grows after admission.
fn read_admitted_bytes(
    reader: &mut impl Read,
    initial_length: u64,
    maximum_bytes: u64,
) -> io::Result<Vec<u8>> {
    let length = admitted_length(initial_length, maximum_bytes)?;
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(length)
        .map_err(|_| io::Error::other("bounded file allocation failed"))?;
    bytes.resize(length, 0);
    reader.read_exact(&mut bytes)?;

    let mut probe = [0_u8; 1];
    loop {
        match reader.read(&mut probe) {
            Ok(0) => return Ok(bytes),
            Ok(_) => return Err(invalid_file()),
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(error),
        }
    }
}

/// Returns a stable nonsensitive error for failed file admission or length drift.
fn invalid_file() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "bounded file admission failed")
}

/// Includes all Windows reparse points, rather than only symbolic links.
#[cfg(windows)]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0000_0400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

/// Rejects symbolic links on platforms without Windows reparse attributes.
#[cfg(not(windows))]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    struct RecordingReader<R> {
        inner: R,
        calls: usize,
        bytes_read: usize,
        largest_request: usize,
    }

    impl<R> RecordingReader<R> {
        /// Records the actual read bounds without relying on allocator behavior.
        fn new(inner: R) -> Self {
            Self {
                inner,
                calls: 0,
                bytes_read: 0,
                largest_request: 0,
            }
        }
    }

    impl<R: Read> Read for RecordingReader<R> {
        /// Counts requested and returned bytes for finite and growing streams.
        fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
            self.calls += 1;
            self.largest_request = self.largest_request.max(output.len());
            let count = self.inner.read(output)?;
            self.bytes_read += count;
            Ok(count)
        }
    }

    struct FailingReader;

    impl Read for FailingReader {
        /// Makes read errors distinguishable from EOF and growth rejection.
        fn read(&mut self, _output: &mut [u8]) -> io::Result<usize> {
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "fixture read error",
            ))
        }
    }

    struct InterruptedReader<R> {
        inner: R,
        interrupted: bool,
    }

    impl<R: Read> Read for InterruptedReader<R> {
        /// Interrupts once before exposing either EOF or trailing bytes.
        fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
            if self.interrupted {
                self.inner.read(output)
            } else {
                self.interrupted = true;
                Err(io::Error::from(io::ErrorKind::Interrupted))
            }
        }
    }

    /// A larger policy bound must not become the allocated or requested length.
    #[test]
    fn exact_stream_preserves_bytes_and_admitted_length() {
        let mut reader = RecordingReader::new(Cursor::new(b"exact"));
        assert_eq!(read_admitted_bytes(&mut reader, 5, 1024).unwrap(), b"exact");
        assert_eq!(reader.bytes_read, 5);
        assert_eq!(reader.largest_request, 5);
        assert_eq!(reader.calls, 2);
    }

    /// Shrinkage is an error even when all remaining bytes are readable.
    #[test]
    fn short_stream_rejects_truncation() {
        let mut reader = Cursor::new(b"abc");
        assert_eq!(
            read_admitted_bytes(&mut reader, 4, 4).unwrap_err().kind(),
            io::ErrorKind::UnexpectedEof
        );
    }

    /// Even unending growth cannot read or allocate beyond the admitted slice.
    #[test]
    fn growing_stream_stops_after_one_extra_byte() {
        let mut reader = RecordingReader::new(io::repeat(0x5a));
        assert_eq!(
            read_admitted_bytes(&mut reader, 4, 1024)
                .unwrap_err()
                .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(reader.bytes_read, 5);
        assert_eq!(reader.largest_request, 4);
        assert_eq!(reader.calls, 2);
    }

    /// Invalid limits and impossible allocations never consume the reader.
    #[test]
    fn invalid_admission_rejects_without_reading() {
        for (length, maximum) in [(0, 0), (0, 4), (1, 0), (5, 4), (u64::MAX, u64::MAX)] {
            let mut reader = RecordingReader::new(io::repeat(0x5a));
            assert!(read_admitted_bytes(&mut reader, length, maximum).is_err());
            assert_eq!(reader.calls, 0, "length={length}, maximum={maximum}");
        }
    }

    /// Neither a failed payload read nor a failed EOF probe may produce success.
    #[test]
    fn read_and_probe_errors_are_preserved() {
        let mut payload_failure = FailingReader;
        assert_eq!(
            read_admitted_bytes(&mut payload_failure, 3, 3)
                .unwrap_err()
                .kind(),
            io::ErrorKind::PermissionDenied
        );
        let mut probe_failure = Cursor::new(b"abc").chain(FailingReader);
        assert_eq!(
            read_admitted_bytes(&mut probe_failure, 3, 3)
                .unwrap_err()
                .kind(),
            io::ErrorKind::PermissionDenied
        );
    }

    /// An interrupted probe must not turn a complete file into a false failure.
    #[test]
    fn interrupted_probe_retries_until_eof() {
        let mut reader = Cursor::new(b"abc").chain(InterruptedReader {
            inner: io::empty(),
            interrupted: false,
        });
        assert_eq!(read_admitted_bytes(&mut reader, 3, 3).unwrap(), b"abc");
    }

    /// An interrupted probe must not conceal trailing bytes as a false EOF.
    #[test]
    fn interrupted_probe_still_rejects_growth() {
        let mut reader = Cursor::new(b"abc").chain(InterruptedReader {
            inner: Cursor::new(b"d"),
            interrupted: false,
        });
        assert_eq!(
            read_admitted_bytes(&mut reader, 3, 3).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    /// Exercises the real filesystem boundary without creating any test payloads.
    #[test]
    fn regular_source_file_is_read_and_directories_are_rejected() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"));
        let source = root.join("src/bounded_file.rs");
        let expected = include_bytes!("bounded_file.rs");
        let length = u64::try_from(expected.len()).unwrap();
        assert_eq!(
            read_bounded_regular_file(&source, length).unwrap(),
            expected
        );
        assert_eq!(
            read_bounded_regular_file(&source, length - 1)
                .unwrap_err()
                .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            read_bounded_regular_file(root, length).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }
}
