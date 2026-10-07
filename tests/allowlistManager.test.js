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

test("init creates an empty allowlist when the file is missing", () => {
  assert.deepEqual(getAllowlist(), {});
  assert.ok(fs.existsSync(tmpFile));
});

test("init recovers from malformed JSON instead of throwing", () => {
  fs.writeFileSync(tmpFile, "{ not valid json");
  init(tmpFile);
  assert.deepEqual(getAllowlist(), {});
});

test("addPlayer adds a player once and checkPermission defaults to false", () => {
  addPlayer("Alice");
  addPlayer("Alice");
  assert.deepEqual(getAllowlist().Alice, []);
  assert.equal(checkPermission("Alice", "noon"), false);
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

test("grantCommand throws for unknown player", () => {
  assert.throws(() => grantCommand("Ghost", "noon"), /Player not found/);
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
