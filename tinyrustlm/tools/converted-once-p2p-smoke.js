#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const slmWorkspace = path.resolve(
  process.env.TINYRUSTLM_WORKSPACE || path.join(scriptDir, '..', '..')
);
const minimodelWorkspace = path.resolve(
  process.env.MINIMODEL_WORKSPACE || path.join(slmWorkspace, '..', 'MiniModel.org')
);
const outputRoot = path.resolve(
  process.env.TINYRUSTLM_CONVERTED_ONCE_SMOKE_DIR ||
    path.join(slmWorkspace, 'target', 'converted-once-p2p-smoke')
);

const modelId = 'example-org/tiny-source-model';
const knownPeerBaseUrl = 'http://127.0.0.1:8123/peer-pieces';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run(cwd, command, args) {
  console.log(`[converted-once-p2p-smoke] ${command} ${args.join(' ')}`);
  const result = childProcess.spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status}`);
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertContains(text, needle, label) {
  assert(text.includes(needle), `${label} did not contain ${needle}`);
}

function assertNotContains(text, needle, label) {
  assert(!text.includes(needle), `${label} unexpectedly contained ${needle}`);
}

function findOne(dir, predicate, label) {
  const matches = fs
    .readdirSync(dir)
    .filter(predicate)
    .map((entry) => path.join(dir, entry));
  assert(matches.length === 1, `expected one ${label}, found ${matches.length}`);
  return matches[0];
}

function assertMetadataOnlyJson(filePath, label) {
  const text = readText(filePath);
  assertContains(text, '"project_server_serves_model_bytes": false', label);
  assertContains(text, '"project_server_runs_model_bytes": false', label);
  assertNotContains(text, '"artifact_url"', label);
  assertNotContains(text, '"model_url"', label);
  assertNotContains(text, 'huggingface.co/', label);
  assertNotContains(text, '/resolve/', label);
  assertNotContains(text, 'tinyrustlm.com/models', label);
  assertNotContains(text, 'minimodel.org/models', label);
  return text;
}

function main() {
  assert(
    fs.existsSync(path.join(slmWorkspace, 'Cargo.toml')),
    `missing TinyRustLM workspace: ${slmWorkspace}`
  );
  assert(
    fs.existsSync(path.join(minimodelWorkspace, 'Cargo.toml')),
    `missing MiniModel workspace: ${minimodelWorkspace}`
  );

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  const sourceSafetensors = path.join(outputRoot, 'tiny-hf-source.safetensors');
  const requestJson = path.join(
    outputRoot,
    'example-org__tiny-source-model.minimodel-conversion-request.json'
  );
  const conversionDir = path.join(outputRoot, 'tinyrustlm-conversion');
  const shareDir = path.join(outputRoot, 'minimodel-peer-share');
  const metadataDir = path.join(outputRoot, 'metadata-only-publication');
  fs.mkdirSync(metadataDir, { recursive: true });

  fs.writeFileSync(
    requestJson,
    `${JSON.stringify(
      {
        request_kind: 'minimodel.huggingface_conversion_request.v1',
        source: {
          kind: 'huggingface_model',
          model_id: modelId,
          revision: '0123456789abcdef0123456789abcdef01234567',
          license_id: 'apache-2.0',
        },
        requested_artifact: {
          kind: 'slm',
          default_source_shape: 'tiny-fixture',
          default_quantization: 'q8_0',
        },
        local_conversion: {
          suggested_source_safetensors_file: path.basename(sourceSafetensors),
        },
      },
      null,
      2
    )}\n`
  );

  run(slmWorkspace, 'cargo', [
    'run',
    '--quiet',
    '-p',
    'tinyrustlm-slm-pack',
    '--',
    'write-safetensors-fixture',
    sourceSafetensors,
    'tiny-fixture',
    'huggingface',
  ]);

  run(slmWorkspace, 'cargo', [
    'run',
    '--quiet',
    '-p',
    'tinyrustlm-slm-pack',
    '--',
    'convert-huggingface-request',
    requestJson,
    sourceSafetensors,
    conversionDir,
    'tiny-fixture',
    'q8_0',
  ]);

  const outputSlm = findOne(conversionDir, (entry) => entry.endsWith('.slm'), 'converted .slm');
  const conversionReceipt = path.join(conversionDir, 'tinyrustlm-conversion.receipt');
  const receiptText = readText(conversionReceipt);
  assertContains(receiptText, 'request_kind=minimodel.huggingface_conversion_request.v1', 'conversion receipt');
  assertContains(receiptText, 'project_server_serves_model_bytes=false', 'conversion receipt');
  assertContains(receiptText, 'project_server_runs_model_bytes=false', 'conversion receipt');
  assertContains(receiptText, 'project_server_proxies_huggingface_bytes=false', 'conversion receipt');
  assertContains(receiptText, 'browser_import_rule=user-imports-local-slm', 'conversion receipt');
  assertContains(
    receiptText,
    'converted_once_publication_rule=external-proof-required-before-public-announcement',
    'conversion receipt'
  );
  assertContains(receiptText, 'tinyrustlm_huggingface_conversion_receipt_version=2', 'conversion receipt');
  assertContains(receiptText, 'minimodel_prepare_seed_announcement_command=cargo run -p minimodel -- prepare-seed-announcement', 'conversion receipt');

  run(minimodelWorkspace, 'cargo', [
    'run',
    '--quiet',
    '-p',
    'minimodel',
    '--',
    'prepare-peer-share',
    outputSlm,
    shareDir,
    modelId,
    modelId,
  ]);

  const manifestPath = findOne(
    shareDir,
    (entry) => entry.endsWith('.minimodel.manifest.v0'),
    'MiniModel manifest'
  );
  const peerOfferPath = findOne(
    shareDir,
    (entry) => entry.endsWith('.minimodel-peer-offer'),
    'MiniModel peer offer'
  );
  const catalogEntryPath = findOne(
    shareDir,
    (entry) => entry.endsWith('.catalog-entry.v0.json'),
    'MiniModel catalog entry'
  );
  const peerPieceDir = findOne(shareDir, (entry) => entry.endsWith('.peer-pieces'), 'peer piece directory');
  assert(fs.existsSync(path.join(peerPieceDir, 'minimodel.peer_piece_set.v0')), 'missing peer piece sidecar');
  assert(fs.existsSync(peerOfferPath), 'missing peer offer proof');

  const manifestText = readText(manifestPath);
  assertContains(manifestText, 'artifact.acquisition=user-external-download', 'MiniModel manifest');
  assertContains(manifestText, 'source.huggingface_model_id=example-org/tiny-source-model', 'MiniModel manifest');
  assertContains(manifestText, 'chunks.mode=fixed-size-merkle-v0', 'MiniModel manifest');

  const catalogText = assertMetadataOnlyJson(catalogEntryPath, 'catalog entry');
  assertContains(catalogText, '"peer_source_count": 0', 'catalog entry');
  assertNotContains(catalogText, '"peer_base_url"', 'catalog entry');

  const snapshotPath = path.join(metadataDir, 'models.v0.json');
  const peerCompanionStatePath = path.join(metadataDir, 'tiny-source-model.peer-companion-state.v0.json');
  const peerContactCardPath = path.join(metadataDir, 'tiny-source-model.peer-contact-card.v0.json');

  run(minimodelWorkspace, 'cargo', [
    'run',
    '--quiet',
    '-p',
    'minimodel',
    '--',
    'write-peer-companion-state',
    manifestPath,
    peerPieceDir,
    peerCompanionStatePath,
    knownPeerBaseUrl,
  ]);
  run(minimodelWorkspace, 'cargo', [
    'run',
    '--quiet',
    '-p',
    'minimodel',
    '--',
    'write-peer-contact-card',
    peerContactCardPath,
    knownPeerBaseUrl,
  ]);
  run(minimodelWorkspace, 'cargo', [
    'run',
    '--quiet',
    '-p',
    'minimodel',
    '--',
    'write-catalog-snapshot',
    snapshotPath,
    catalogEntryPath,
  ]);

  const snapshotText = assertMetadataOnlyJson(snapshotPath, 'catalog snapshot');
  assertContains(snapshotText, '"catalog_kind": "minimodel.model_catalog"', 'catalog snapshot');
  assertContains(snapshotText, '"peer_source_count": 0', 'catalog snapshot');
  assertNotContains(snapshotText, '"peer_base_url"', 'catalog snapshot');
  const peerCompanionStateText = assertMetadataOnlyJson(peerCompanionStatePath, 'peer companion state');
  assertContains(peerCompanionStateText, '"state_kind": "minimodel.peer_companion_state"', 'peer companion state');
  assertContains(peerCompanionStateText, '"peer_piece_bytes_in_state": false', 'peer companion state');
  assertContains(peerCompanionStateText, '"project_server_proxies_model_bytes": false', 'peer companion state');
  assertContains(peerCompanionStateText, '"peer_base_url": "http://127.0.0.1:8123/peer-pieces/"', 'peer companion state');
  assertNotContains(peerCompanionStateText, outputSlm, 'peer companion state');
  const peerContactCardText = assertMetadataOnlyJson(peerContactCardPath, 'peer contact card');
  assertContains(peerContactCardText, '"card_kind": "minimodel.peer_contact_card"', 'peer contact card');
  assertContains(peerContactCardText, '"peer_base_url": "http://127.0.0.1:8123/peer-pieces/"', 'peer contact card');
  assertContains(peerContactCardText, '"metadata_only": true', 'peer contact card');
  assertContains(peerContactCardText, '"peer_contact_card_embeds_model_bytes": false', 'peer contact card');
  assertContains(peerContactCardText, '"requires_rust_reverify_before_browser_import": true', 'peer contact card');
  assertNotContains(peerContactCardText, outputSlm, 'peer contact card');

  console.log('[converted-once-p2p-smoke] PASS');
  console.log(`[converted-once-p2p-smoke] output_root=${outputRoot}`);
}

main();
