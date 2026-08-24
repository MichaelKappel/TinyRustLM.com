//! Bounded resolver order, identity, dependency, and preflight tests.

use std::collections::BTreeMap;
use std::io::Cursor;
use std::sync::{Arc, Mutex};

use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_composition2::{
    prepare_composition, write_acg2, Acg2Graph, Acg2Member, Acg2Policy, Acg2Read, MemberResolver,
    MemberRole, ResourcePlan, ResourcePreflight,
};

const SLM2_VECTORS: &[u8] =
    include_bytes!("../../../../contracts/vnext/slm2-q8-weight-vectors.v1.json");

#[derive(Clone)]
struct TrackedSource {
    cursor: Cursor<Vec<u8>>,
    active: Arc<Mutex<usize>>,
}

impl std::io::Read for TrackedSource {
    fn read(&mut self, bytes: &mut [u8]) -> std::io::Result<usize> {
        std::io::Read::read(&mut self.cursor, bytes)
    }
}

impl std::io::Seek for TrackedSource {
    fn seek(&mut self, position: std::io::SeekFrom) -> std::io::Result<u64> {
        std::io::Seek::seek(&mut self.cursor, position)
    }
}

impl Drop for TrackedSource {
    fn drop(&mut self) {
        let mut active = self.active.lock().expect("active lock");
        *active -= 1;
    }
}

struct Resolver {
    bytes: BTreeMap<&'static str, Vec<u8>>,
    active: Arc<Mutex<usize>>,
    maximum_active: usize,
    opened: Vec<MemberRole>,
}

impl MemberResolver for Resolver {
    fn open(&mut self, role: MemberRole, _identity: Acg2Member) -> Option<Box<dyn Acg2Read>> {
        let bytes = self
            .bytes
            .get(role.name())
            .cloned()
            .expect("registered test member");
        let current = {
            let mut active = self.active.lock().expect("active lock");
            *active += 1;
            *active
        };
        self.maximum_active = self.maximum_active.max(current);
        self.opened.push(role);
        Some(Box::new(TrackedSource {
            cursor: Cursor::new(bytes),
            active: Arc::clone(&self.active),
        }))
    }
}

#[derive(Default)]
struct Preflight {
    calls: usize,
    last: Option<ResourcePlan>,
}

impl ResourcePreflight for Preflight {
    fn accept(&mut self, plan: ResourcePlan) -> bool {
        self.calls += 1;
        self.last = Some(plan);
        true
    }
}

#[test]
fn dependency_mismatch_opens_one_source_at_a_time_and_never_preflights() {
    let model = canonical_model();
    let artifacts = BTreeMap::from([
        ("model", model),
        ("tokenizer", vec![2]),
        ("template", vec![3]),
        ("sampling", vec![4]),
        ("prompt", vec![5]),
    ]);
    let graph = graph_for(&artifacts);
    let active = Arc::new(Mutex::new(0));
    let mut resolver = Resolver {
        bytes: artifacts,
        active: Arc::clone(&active),
        maximum_active: 0,
        opened: Vec::new(),
    };
    let mut preflight = Preflight::default();
    let error = prepare_composition(graph, &mut resolver, &mut preflight)
        .expect_err("fixture dependencies cannot satisfy Prompt2")
        .code();
    assert_eq!(error, "acg2-dependency");
    assert_eq!(
        resolver.opened,
        [
            MemberRole::Model,
            MemberRole::Tokenizer,
            MemberRole::Template,
            MemberRole::Sampling,
            MemberRole::Prompt,
        ]
    );
    assert_eq!(resolver.maximum_active, 1);
    assert_eq!(*active.lock().expect("active lock"), 0);
    assert_eq!(preflight.calls, 0);
    assert!(preflight.last.is_none());
}

#[test]
fn member_hash_drift_fails_before_canonical_parser_and_later_opens() {
    let mut artifacts = BTreeMap::from([
        ("model", canonical_model()),
        ("tokenizer", vec![2]),
        ("template", vec![3]),
        ("sampling", vec![4]),
        ("prompt", vec![5]),
    ]);
    let graph = graph_for(&artifacts);
    artifacts.get_mut("model").unwrap()[0] ^= 1;
    let active = Arc::new(Mutex::new(0));
    let mut resolver = Resolver {
        bytes: artifacts,
        active: Arc::clone(&active),
        maximum_active: 0,
        opened: Vec::new(),
    };
    let mut preflight = Preflight::default();
    assert_eq!(
        prepare_composition(graph, &mut resolver, &mut preflight)
            .expect_err("hash drift")
            .code(),
        "acg2-resolve-hash"
    );
    assert_eq!(resolver.opened, [MemberRole::Model]);
    assert_eq!(resolver.maximum_active, 1);
    assert_eq!(*active.lock().expect("active lock"), 0);
    assert_eq!(preflight.calls, 0);
}

fn graph_for(artifacts: &BTreeMap<&'static str, Vec<u8>>) -> Acg2Graph {
    let members = std::array::from_fn(|index| {
        let role = [
            MemberRole::Model,
            MemberRole::Tokenizer,
            MemberRole::Template,
            MemberRole::Sampling,
            MemberRole::Prompt,
        ][index];
        let bytes = &artifacts[role.name()];
        Acg2Member::new(role, bytes.len() as u64, Sha256::digest(bytes).into()).unwrap()
    });
    let mut bytes = Vec::new();
    write_acg2(&mut bytes, &members).unwrap();
    Acg2Graph::from_bytes(&bytes, Acg2Policy::exact_profile_limits()).unwrap()
}

fn canonical_model() -> Vec<u8> {
    let vectors: Value = serde_json::from_slice(SLM2_VECTORS).expect("SLM2 vectors");
    decode_hex(vectors["canonical"]["artifactHex"].as_str().unwrap())
}

fn decode_hex(value: &str) -> Vec<u8> {
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| (nibble(pair[0]) << 4) | nibble(pair[1]))
        .collect()
}

fn nibble(value: u8) -> u8 {
    match value {
        b'0'..=b'9' => value - b'0',
        b'a'..=b'f' => value - b'a' + 10,
        _ => panic!("non-hex vector"),
    }
}
