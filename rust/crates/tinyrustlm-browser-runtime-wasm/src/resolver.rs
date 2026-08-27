use std::io::{self, Read, Seek, SeekFrom};
use std::sync::Arc;

use tinyrustlm_composition2::{Acg2Member, Acg2Read, MemberResolver, MemberRole};
use tinyrustlm_runtime::RuntimeMemberResolver;

pub(crate) struct MemoryResolver {
    model: Option<Arc<Vec<u8>>>,
    tokenizer: Option<Arc<Vec<u8>>>,
    template: Option<Arc<Vec<u8>>>,
    sampling: Option<Arc<Vec<u8>>>,
    prompt: Option<Arc<Vec<u8>>>,
}

impl MemoryResolver {
    pub(crate) fn new(
        model: Vec<u8>,
        tokenizer: Vec<u8>,
        template: Vec<u8>,
        sampling: Vec<u8>,
        prompt: Vec<u8>,
    ) -> Self {
        Self {
            model: Some(Arc::new(model)),
            tokenizer: Some(Arc::new(tokenizer)),
            template: Some(Arc::new(template)),
            sampling: Some(Arc::new(sampling)),
            prompt: Some(Arc::new(prompt)),
        }
    }

    fn member(&self, role: MemberRole) -> Option<&Arc<Vec<u8>>> {
        match role {
            MemberRole::Model => self.model.as_ref(),
            MemberRole::Tokenizer => self.tokenizer.as_ref(),
            MemberRole::Template => self.template.as_ref(),
            MemberRole::Sampling => self.sampling.as_ref(),
            MemberRole::Prompt => self.prompt.as_ref(),
        }
    }
}

impl MemberResolver for MemoryResolver {
    fn open(&mut self, role: MemberRole, identity: Acg2Member) -> Option<Box<dyn Acg2Read>> {
        if identity.role() != role {
            return None;
        }
        let bytes = Arc::clone(self.member(role)?);
        if u64::try_from(bytes.len()).ok()? != identity.artifact_bytes() {
            return None;
        }
        Some(Box::new(SharedBytesReader { bytes, position: 0 }))
    }
}

impl RuntimeMemberResolver for MemoryResolver {
    fn take_model(&mut self, identity: Acg2Member) -> Option<Vec<u8>> {
        if identity.role() != MemberRole::Model {
            return None;
        }
        let bytes = self.model.take()?;
        if u64::try_from(bytes.len()).ok()? != identity.artifact_bytes() {
            return None;
        }
        Arc::try_unwrap(bytes).ok()
    }
}

struct SharedBytesReader {
    bytes: Arc<Vec<u8>>,
    position: u64,
}

impl Read for SharedBytesReader {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        let start = usize::try_from(self.position)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "position overflow"))?;
        if start >= self.bytes.len() || output.is_empty() {
            return Ok(0);
        }
        let count = output.len().min(self.bytes.len() - start);
        output[..count].copy_from_slice(&self.bytes[start..start + count]);
        self.position = self
            .position
            .checked_add(count as u64)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "position overflow"))?;
        Ok(count)
    }
}

impl Seek for SharedBytesReader {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        let next = match position {
            SeekFrom::Start(value) => i128::from(value),
            SeekFrom::End(value) => self.bytes.len() as i128 + i128::from(value),
            SeekFrom::Current(value) => i128::from(self.position) + i128::from(value),
        };
        if !(0..=i128::from(u64::MAX)).contains(&next) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid seek"));
        }
        self.position = next as u64;
        Ok(self.position)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_reader_does_not_prevent_move_only_model_transfer() {
        let model = vec![7_u8; 4096];
        let pointer = model.as_ptr();
        let identity = Acg2Member::new(MemberRole::Model, model.len() as u64, [1; 32])
            .expect("member identity");
        let mut resolver = MemoryResolver::new(model, vec![1], vec![2], vec![3], vec![4]);

        let mut reader = resolver
            .open(MemberRole::Model, identity)
            .expect("model reader");
        let mut observed = Vec::new();
        reader.read_to_end(&mut observed).expect("read model");
        assert_eq!(observed.len(), 4096);
        drop(reader);

        let moved = resolver.take_model(identity).expect("move model");
        assert_eq!(moved.as_ptr(), pointer);
    }

    #[test]
    fn live_validation_reader_prevents_ambiguous_model_ownership() {
        let model = vec![7_u8; 4096];
        let identity = Acg2Member::new(MemberRole::Model, model.len() as u64, [1; 32])
            .expect("member identity");
        let mut resolver = MemoryResolver::new(model, vec![1], vec![2], vec![3], vec![4]);
        let reader = resolver
            .open(MemberRole::Model, identity)
            .expect("model reader");

        assert!(resolver.take_model(identity).is_none());
        drop(reader);
    }
}
