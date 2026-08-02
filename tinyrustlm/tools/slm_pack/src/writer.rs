//! Little-endian binary writing helpers.

use std::io;

/// Aligns a byte offset to the next 64-byte boundary.
pub fn align_to_64(value: usize) -> usize {
    (value + 63) & !63
}

/// Writes a little-endian u32 at `offset`.
pub fn write_u32(bytes: &mut [u8], offset: usize, value: u32) -> io::Result<()> {
    write_bytes(bytes, offset, &value.to_le_bytes())
}

/// Writes a little-endian u64 at `offset`.
pub fn write_u64(bytes: &mut [u8], offset: usize, value: u64) -> io::Result<()> {
    write_bytes(bytes, offset, &value.to_le_bytes())
}

/// Writes a little-endian f32 at `offset`.
pub fn write_f32(bytes: &mut [u8], offset: usize, value: f32) -> io::Result<()> {
    write_bytes(bytes, offset, &value.to_le_bytes())
}

fn write_bytes(bytes: &mut [u8], offset: usize, value: &[u8]) -> io::Result<()> {
    let end = offset + value.len();
    if end > bytes.len() {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "write outside buffer",
        ));
    }
    bytes[offset..end].copy_from_slice(value);
    Ok(())
}
