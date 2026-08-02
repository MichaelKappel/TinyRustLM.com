//! Key/value cache for autoregressive attention.

use crate::content_identity::Digest32;
use crate::errors::ErrorCode;

/// Layer-major key/value cache.
pub struct KvCache {
    layers: usize,
    max_context: usize,
    kv_heads: usize,
    head_dim: usize,
    len: usize,
    owner_graph_digest: Option<Digest32>,
    sequence_key: Option<Digest32>,
    keys: Vec<f32>,
    values: Vec<f32>,
}

impl KvCache {
    /// Creates a new zero-initialized key/value cache.
    pub fn new(
        layers: usize,
        max_context: usize,
        kv_heads: usize,
        head_dim: usize,
    ) -> Result<Self, ErrorCode> {
        if layers == 0 || max_context == 0 || kv_heads == 0 || head_dim == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        let total = layers
            .checked_mul(max_context)
            .and_then(|v| v.checked_mul(kv_heads))
            .and_then(|v| v.checked_mul(head_dim))
            .ok_or(ErrorCode::InvalidLength)?;
        Ok(Self {
            layers,
            max_context,
            kv_heads,
            head_dim,
            len: 0,
            owner_graph_digest: None,
            sequence_key: None,
            keys: vec![0.0; total],
            values: vec![0.0; total],
        })
    }

    /// Returns the allocated key/value storage size in bytes for diagnostics.
    pub fn byte_budget(&self) -> usize {
        (self.keys.len() + self.values.len()) * core::mem::size_of::<f32>()
    }

    /// Returns the 64 KiB WebAssembly page count needed to hold the cache bytes.
    pub fn page_count(&self) -> usize {
        page_count_for_bytes(self.byte_budget())
    }

    /// Returns the current token count in the cache.
    pub fn len(&self) -> usize {
        self.len
    }

    /// Returns whether the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Clears all cached positions.
    pub fn reset(&mut self) {
        self.len = 0;
        self.clear_identity();
    }

    /// Binds the fully committed positions to one graph and exact token sequence.
    pub fn bind_identity(
        &mut self,
        owner_graph_digest: Digest32,
        sequence_key: Digest32,
        token_count: usize,
    ) -> Result<(), ErrorCode> {
        if token_count == 0
            || token_count != self.len
            || owner_graph_digest == [0; 32]
            || sequence_key == [0; 32]
        {
            return Err(ErrorCode::InvalidLength);
        }
        self.owner_graph_digest = Some(owner_graph_digest);
        self.sequence_key = Some(sequence_key);
        Ok(())
    }

    /// Returns whether every visible position belongs to the exact graph and sequence.
    pub fn matches_identity(
        &self,
        owner_graph_digest: Digest32,
        sequence_key: Digest32,
        token_count: usize,
    ) -> bool {
        token_count != 0
            && self.len == token_count
            && self.owner_graph_digest == Some(owner_graph_digest)
            && self.sequence_key == Some(sequence_key)
    }

    /// Commits the visible cache length after all layers store a position.
    pub fn commit_len(&mut self, len: usize) -> Result<(), ErrorCode> {
        if len > self.max_context {
            return Err(ErrorCode::ContextExceeded);
        }
        self.clear_identity();
        self.len = len;
        Ok(())
    }

    /// Appends a single position for one layer.
    pub fn append_layer(
        &mut self,
        layer: usize,
        key: &[f32],
        value: &[f32],
    ) -> Result<(), ErrorCode> {
        if layer >= self.layers || self.len >= self.max_context {
            return Err(ErrorCode::ContextExceeded);
        }
        let expected = self.kv_heads * self.head_dim;
        if key.len() != expected || value.len() != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        self.clear_identity();
        let base = self.offset(layer, self.len, 0, 0)?;
        self.keys[base..base + expected].copy_from_slice(key);
        self.values[base..base + expected].copy_from_slice(value);
        if layer + 1 == self.layers {
            self.len += 1;
        }
        Ok(())
    }

    /// Stores a single layer at an explicit token position.
    pub fn store_layer_at(
        &mut self,
        layer: usize,
        position: usize,
        key: &[f32],
        value: &[f32],
    ) -> Result<(), ErrorCode> {
        if layer >= self.layers || position >= self.max_context {
            return Err(ErrorCode::ContextExceeded);
        }
        let expected = self.kv_heads * self.head_dim;
        if key.len() != expected || value.len() != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        self.clear_identity();
        let base = self.offset(layer, position, 0, 0)?;
        self.keys[base..base + expected].copy_from_slice(key);
        self.values[base..base + expected].copy_from_slice(value);
        Ok(())
    }

    /// Reads a cached key vector for one layer and position.
    pub fn key(&self, layer: usize, position: usize) -> Result<&[f32], ErrorCode> {
        self.read(&self.keys, layer, position)
    }

    /// Reads a cached value vector for one layer and position.
    pub fn value(&self, layer: usize, position: usize) -> Result<&[f32], ErrorCode> {
        self.read(&self.values, layer, position)
    }

    /// Reads a cached key head at a position that has been stored.
    pub fn key_head_at(
        &self,
        layer: usize,
        position: usize,
        head: usize,
    ) -> Result<&[f32], ErrorCode> {
        self.read_head(&self.keys, layer, position, head)
    }

    /// Reads a cached value head at a position that has been stored.
    pub fn value_head_at(
        &self,
        layer: usize,
        position: usize,
        head: usize,
    ) -> Result<&[f32], ErrorCode> {
        self.read_head(&self.values, layer, position, head)
    }

    fn read<'a>(
        &self,
        store: &'a [f32],
        layer: usize,
        position: usize,
    ) -> Result<&'a [f32], ErrorCode> {
        if layer >= self.layers || position >= self.len {
            return Err(ErrorCode::ContextExceeded);
        }
        let expected = self.kv_heads * self.head_dim;
        let base = self.offset(layer, position, 0, 0)?;
        Ok(&store[base..base + expected])
    }

    fn read_head<'a>(
        &self,
        store: &'a [f32],
        layer: usize,
        position: usize,
        head: usize,
    ) -> Result<&'a [f32], ErrorCode> {
        if layer >= self.layers || position >= self.max_context || head >= self.kv_heads {
            return Err(ErrorCode::ContextExceeded);
        }
        let base = self.offset(layer, position, head, 0)?;
        Ok(&store[base..base + self.head_dim])
    }

    fn offset(
        &self,
        layer: usize,
        position: usize,
        head: usize,
        dim: usize,
    ) -> Result<usize, ErrorCode> {
        if layer >= self.layers
            || position >= self.max_context
            || head >= self.kv_heads
            || dim >= self.head_dim
        {
            return Err(ErrorCode::ShapeMismatch);
        }
        Ok((((layer * self.max_context + position) * self.kv_heads + head) * self.head_dim) + dim)
    }

    fn clear_identity(&mut self) {
        self.owner_graph_digest = None;
        self.sequence_key = None;
    }
}

fn page_count_for_bytes(bytes: usize) -> usize {
    // Rounds the cache byte envelope up to WebAssembly page units for diagnostics.
    let page_bytes = 64 * 1024;
    bytes.div_ceil(page_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kv_cache_append_read() {
        let mut cache = KvCache::new(1, 4, 2, 2).unwrap();
        cache
            .append_layer(0, &[1.0, 2.0, 3.0, 4.0], &[5.0, 6.0, 7.0, 8.0])
            .unwrap();
        assert_eq!(cache.len(), 1);
        assert_eq!(cache.key(0, 0).unwrap(), &[1.0, 2.0, 3.0, 4.0]);
        assert_eq!(cache.value(0, 0).unwrap(), &[5.0, 6.0, 7.0, 8.0]);
    }

    #[test]
    fn kv_cache_reports_byte_budget_and_page_count_from_all_shape_parameters() {
        let cache = KvCache::new(2, 8192, 2, 4).unwrap();
        assert_eq!(cache.byte_budget(), 2 * 8192 * 2 * 4 * 2 * 4);
        assert_eq!(cache.page_count(), 16);
    }

    #[test]
    fn kv_cache_identity_requires_exact_committed_length_and_invalidates_on_writes() {
        let mut cache = KvCache::new(1, 4, 1, 2).unwrap();
        let graph = [0x11; 32];
        let sequence = [0x22; 32];

        assert_eq!(
            cache.bind_identity(graph, sequence, 0).unwrap_err(),
            ErrorCode::InvalidLength
        );
        cache.append_layer(0, &[1.0, 2.0], &[3.0, 4.0]).unwrap();
        cache.bind_identity(graph, sequence, 1).unwrap();
        assert!(cache.matches_identity(graph, sequence, 1));
        assert!(!cache.matches_identity(graph, [0x33; 32], 1));

        cache
            .store_layer_at(0, 0, &[5.0, 6.0], &[7.0, 8.0])
            .unwrap();
        assert!(!cache.matches_identity(graph, sequence, 1));
        cache.bind_identity(graph, sequence, 1).unwrap();
        cache.reset();
        assert!(!cache.matches_identity(graph, sequence, 0));
    }
}
