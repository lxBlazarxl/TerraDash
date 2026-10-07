import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mock } from "node:test";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "updater-root-"));
process.env.TERRADASH_ROOT = root;

const spawnSync = mock.fn((cmd, args) => {
  if (cmd === "unzip" && args[0] === "-v") return { status: 0 };
  if (cmd === "unzip" && args[0] === "-o") {
    const dest = args[args.length - 1];
    const prefix = args.find((a) => a.endsWith("/*")).slice(0, -2);
    const dir = path.join(dest, prefix);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "TerrariaServer"), "new-binary");
    fs.writeFileSync(path.join(dir, "TerrariaServer.bin.x86_64"), "new-bin");
    return { status: 0 };
  }
  return { status: 1 };
});
mock.module("child_process", { namedExports: { spawnSync } });

let latestName = "terraria-server-1458.zip";
const fetchLatestServerName = mock.fn(async () => ({
  name: latestName,
  num: "1458",
}));
const readInstalledVersion = mock.fn(() => "terraria-server-1449.zip");
mock.module("../core/versionChecker.js", {
  namedExports: {
    fetchLatestServerName,
    readInstalledVersion,
    prettyVersion: (num) => (num.length === 4 ? `1.${[...num.slice(1)].join(".")}` : num),
    PLATFORM_EXE: "TerrariaServer.bin.x86_64",
  },
});

const { updateServer, isUpdating } = await import("../core/serverUpdater.js");

const SERVER_DIR = path.join(root, "terraria");

const realFetch = globalThis.fetch;
const useFetch = (impl) => (globalThis.fetch = impl);
const fetchOk = (content) =>
  mock.fn(async () => new Response(content, { headers: { "content-length": String(content.length) } }));
const fetchFail = () => mock.fn(async () => ({ ok: false, status: 503 }));

test.afterEach(() => {
  globalThis.fetch = realFetch;
  readInstalledVersion.mock.mockImplementation(() => "terraria-server-1449.zip");
  fetchLatestServerName.mock.resetCalls();
  fetchLatestServerName.mock.mockImplementation(async () => ({ name: latestName, num: "1458" }));
  latestName = "terraria-server-1458.zip";
});

test("updateServer reports up to date without installing", async () => {
  readInstalledVersion.mock.mockImplementation(() => "terraria-server-1458.zip");
  const before = fs.existsSync(SERVER_DIR);

  const result = await updateServer();

  assert.equal(result.success, true);
  assert.equal(result.updated, false);
  assert.equal(result.version, "1.4.5.8");
  assert.match(result.message, /Already up to date/);
  assert.equal(fs.existsSync(SERVER_DIR), before);
});

test("updateServer downloads, extracts, installs and updates .env", async () => {
  useFetch(fetchOk("45MB"));
  const result = await updateServer();

  assert.equal(result.success, true);
  assert.equal(result.updated, true);
  assert.equal(result.version, "1.4.5.8");

  assert.equal(fs.readFileSync(path.join(SERVER_DIR, ".version"), "utf8"), "terraria-server-1458.zip");
  assert.equal(fs.readFileSync(path.join(SERVER_DIR, "TerrariaServer"), "utf8"), "new-binary");
  assert.equal(
    fs.statSync(path.join(SERVER_DIR, "TerrariaServer.bin.x86_64")).mode & 0o755,
    0o755,
  );

  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  assert.match(env, /TERRARIA_DIR=.*terraria/);
  assert.match(env, /TERRARIA_EXE=TerrariaServer\.bin\.x86_64/);

  assert.equal(fs.existsSync(path.join(SERVER_DIR, ".tmp")), false);
  assert.equal(fetchLatestServerName.mock.calls.length, 1);
});

test("updateServer preserves the Worlds directory", async () => {
  useFetch(fetchOk("45MB"));
  fs.mkdirSync(path.join(SERVER_DIR, "Worlds"), { recursive: true });
  fs.writeFileSync(path.join(SERVER_DIR, "Worlds", "mine.wld"), "my world");

  await updateServer();

  assert.equal(
    fs.readFileSync(path.join(SERVER_DIR, "Worlds", "mine.wld"), "utf8"),
    "my world",
  );
});

test("updateServer with force reinstalls the same version", async () => {
  useFetch(fetchOk("45MB"));
  readInstalledVersion.mock.mockImplementation(() => "terraria-server-1458.zip");

  const result = await updateServer({ force: true });

  assert.equal(result.updated, true);
});

test("updateServer refuses a second concurrent run", async () => {
  useFetch(fetchOk("45MB"));
  let release;
  fetchLatestServerName.mock.mockImplementation(
    () => new Promise((resolve) => (release = () => resolve({ name: latestName, num: "1458" }))),
  );

  const first = updateServer();
  assert.equal(isUpdating(), true);

  const second = await updateServer();
  assert.equal(second.success, false);
  assert.match(second.message, /already in progress/);
  assert.equal(second.updated, false);

  release();
  await first;
  assert.equal(isUpdating(), false);
});

test("updateServer propagates download failures", async () => {
  useFetch(fetchFail());
  await assert.rejects(updateServer(), /Download returned 503/);
  assert.equal(isUpdating(), false);
});
