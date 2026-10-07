import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  init,
  getAllowlist,
  checkPermission,
  addPlayer,
  removePlayer,
  grantCommand,
  revokeCommand,
} from "../core/allowlistManager.js";

let tmpFile;

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terradash-"));
  tmpFile = path.join(dir, "allowlist.json");
  init(tmpFile);
});

afterEach(() => {
  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});

const readDisk = () => JSON.parse(fs.readFileSync(tmpFile, "utf8"));

test("init creates an empty allowlist when the file is missing", () => {
  assert.deepEqual(getAllowlist(), {});
  assert.ok(fs.existsSync(tmpFile));
  assert.deepEqual(readDisk(), {});
});

test("init loads an existing allowlist from disk", () => {
  fs.writeFileSync(tmpFile, JSON.stringify({ Admin: ["ban", "kick"] }));
  init(tmpFile);
  assert.deepEqual(getAllowlist(), { Admin: ["ban", "kick"] });
  assert.equal(checkPermission("Admin", "ban"), true);
  assert.equal(checkPermission("Admin", "kick"), true);
});

test("init recovers from malformed JSON instead of throwing", () => {
  fs.writeFileSync(tmpFile, "{ not valid json");
  init(tmpFile);
  assert.deepEqual(getAllowlist(), {});
});

test("getAllowlist returns a deep clone", () => {
  addPlayer("Admin");
  grantCommand("Admin", "ban");

  const snapshot = getAllowlist();
  snapshot.Admin.push("tampered");
  snapshot.Extra = [];

  assert.deepEqual(getAllowlist(), { Admin: ["ban"] });
  assert.equal(checkPermission("Admin", "tampered"), false);
});

test("addPlayer adds a player once and checkPermission defaults to false", () => {
  addPlayer("Alice");
  addPlayer("Alice");
  assert.deepEqual(getAllowlist().Alice, []);
  assert.equal(checkPermission("Alice", "noon"), false);
});

test("addPlayer is idempotent and keeps existing commands", () => {
  addPlayer("Steve");
  grantCommand("Steve", "kick");
  addPlayer("Steve");

  assert.deepEqual(getAllowlist().Steve, ["kick"]);
});

test("checkPermission is false for unknown players or commands", () => {
  addPlayer("Admin");
  assert.equal(checkPermission("Ghost", "ban"), false);
  assert.equal(checkPermission("Admin", "noon"), false);
});

test("grantCommand and revokeCommand control permissions", () => {
  addPlayer("Bob");
  grantCommand("Bob", "noon");
  grantCommand("Bob", "noon");
  assert.equal(checkPermission("Bob", "noon"), true);
  assert.deepEqual(getAllowlist().Bob, ["noon"]);

  revokeCommand("Bob", "noon");
  assert.equal(checkPermission("Bob", "noon"), false);
});

test("grantCommand persists to disk", () => {
  addPlayer("Steve");
  grantCommand("Steve", "kick");
  grantCommand("Steve", "tp");

  assert.deepEqual(readDisk().Steve, ["kick", "tp"]);
});

test("grantCommand throws for unknown player", () => {
  assert.throws(() => grantCommand("Ghost", "noon"), /Player not found/);
});

test("revokeCommand throws for unknown player", () => {
  assert.throws(() => revokeCommand("Ghost", "noon"), /Player not found/);
});

test("removePlayer drops the player", () => {
  addPlayer("Carol");
  removePlayer("Carol");
  assert.deepEqual(getAllowlist(), {});
  assert.equal(checkPermission("Carol", "noon"), false);
});

test("writes are atomic (no leftover .tmp file)", () => {
  addPlayer("Dave");
  assert.equal(fs.existsSync(`${tmpFile}.tmp`), false);
});
