"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  openOwnedProfileRoot,
  profileMarkerName,
  removeOwnedProfileRoot,
  rootMarkerName
} = require("../tools/owned-browser-profile.js");

function temporaryParent(context) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-profile-parent-"));
  context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return parent;
}

test("creates a fresh owned profile and proves recursive deletion", (context) => {
  const parent = temporaryParent(context);
  const root = createOwnedProfileRoot({
    parentDirectory: parent,
    campaignId: "profile-test-20260715"
  });
  const reopened = openOwnedProfileRoot(root.rootPath, root.campaignId, root.ownerNonce);
  assert.equal(reopened.rootMarkerHash, root.rootMarkerHash);

  const profile = createOwnedBrowserProfile(reopened, { round: 1, role: "primary" });
  assert.equal(assertOwnedProfileFresh(reopened, profile), true);
  fs.mkdirSync(path.join(profile.profilePath, "Default", "IndexedDB"), { recursive: true });
  fs.writeFileSync(path.join(profile.profilePath, "Default", "IndexedDB", "state.bin"), "state");

  const deletion = deleteOwnedBrowserProfile(reopened, profile);
  assert.equal(deletion.deleted, true);
  assert.equal(deletion.round, 1);
  assert.equal(deletion.role, "primary");
  assert.match(deletion.profileMarkerHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(deletion, "profilePath"), false);
  assert.equal(fs.existsSync(profile.profilePath), false);
  assert.equal(removeOwnedProfileRoot(reopened), true);
});

test("refuses to delete a directory outside the owned root", (context) => {
  const parent = temporaryParent(context);
  const root = createOwnedProfileRoot({
    parentDirectory: parent,
    campaignId: "profile-path-test-20260715"
  });
  const profile = createOwnedBrowserProfile(root, { round: 2, role: "primary" });
  const outside = fs.mkdtempSync(path.join(parent, "outside-profile-"));
  fs.writeFileSync(path.join(outside, profileMarkerName), "{}\n");

  assert.throws(() => deleteOwnedBrowserProfile(root, {
    ...profile,
    profilePath: outside
  }), /escaped its owned root/i);
  assert.equal(fs.existsSync(outside), true);
  deleteOwnedBrowserProfile(root, profile);
  removeOwnedProfileRoot(root);
});

test("refuses marker tampering and leaves the profile intact", (context) => {
  const parent = temporaryParent(context);
  const root = createOwnedProfileRoot({
    parentDirectory: parent,
    campaignId: "profile-marker-test-20260715"
  });
  const profile = createOwnedBrowserProfile(root, { round: 3, role: "restore" });
  const markerPath = path.join(profile.profilePath, profileMarkerName);
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  marker.round = 99;
  fs.writeFileSync(markerPath, `${JSON.stringify(marker)}\n`);

  assert.throws(() => deleteOwnedBrowserProfile(root, profile), /ownership changed/i);
  assert.equal(fs.existsSync(profile.profilePath), true);
});

test("refuses to remove a root that contains unknown state", (context) => {
  const parent = temporaryParent(context);
  const root = createOwnedProfileRoot({
    parentDirectory: parent,
    campaignId: "profile-root-test-20260715"
  });
  fs.writeFileSync(path.join(root.rootPath, "unknown.txt"), "do not delete");
  assert.throws(() => removeOwnedProfileRoot(root), /unknown files/i);
  assert.equal(fs.existsSync(path.join(root.rootPath, rootMarkerName)), true);
  assert.equal(fs.existsSync(path.join(root.rootPath, "unknown.txt")), true);
});
