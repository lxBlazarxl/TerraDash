import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mock } from "node:test";

const { getVersionInfo, checkVersion, getVersionStatus } = await import(
  "../core/versionChecker.js"
);

const mkVersionFile = (content) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "version-check-"));
  const file = path.join(dir, ".version");
  if (content !== null) fs.writeFileSync(file, content);
  return file;
};

const fetchOk = (body) =>
  mock.fn(async () => ({ ok: true, status: 200, json: async () => body }));

test("getVersionInfo reports up to date when installed matches latest", async () => {
  const versionFile = mkVersionFile("terraria-server-1449.zip\n");
  const fetchImpl = fetchOk(["terraria-server-1449.zip", "terraria-server-1355.zip"]);

  const info = await getVersionInfo({ versionFile, fetchImpl });

  assert.deepEqual(info, {
    installed: "terraria-server-1449.zip",
    installedLabel: "1.4.4.9",
    latest: "terraria-server-1449.zip",
    latestLabel: "1.4.4.9",
    upToDate: true,
  });
  assert.equal(fetchImpl.mock.calls.length, 1);
});

test("getVersionInfo reports outdated with both labels", async () => {
  const versionFile = mkVersionFile("terraria-server-1355.zip");
  const fetchImpl = fetchOk(["terraria-server-1449.zip"]);

  const info = await getVersionInfo({ versionFile, fetchImpl });

  assert.equal(info.upToDate, false);
  assert.equal(info.installedLabel, "1.3.5.5");
  assert.equal(info.latestLabel, "1.4.4.9");
});

test("getVersionInfo handles a missing install", async () => {
  const versionFile = mkVersionFile(null);
  const fetchImpl = fetchOk(["terraria-server-1449.zip"]);

  const info = await getVersionInfo({ versionFile, fetchImpl });

  assert.equal(info.installed, null);
  assert.equal(info.installedLabel, null);
  assert.equal(info.upToDate, false);
});

test("getVersionInfo keeps unparsable version file contents as-is", async () => {
  const versionFile = mkVersionFile("garbage");
  const fetchImpl = fetchOk(["terraria-server-1449.zip"]);

  const info = await getVersionInfo({ versionFile, fetchImpl });

  assert.equal(info.installed, "garbage");
  assert.equal(info.installedLabel, "garbage");
  assert.equal(info.upToDate, false);
});

test("getVersionInfo throws when the endpoint fails", async () => {
  const fetchImpl = mock.fn(async () => ({ ok: false, status: 503 }));

  await assert.rejects(
    getVersionInfo({ versionFile: "/unused", fetchImpl }),
    /Version endpoint returned 503/,
  );
});

test("getVersionInfo throws when no server names parse", async () => {
  const fetchImpl = fetchOk(["readme.txt", "patch-notes.pdf"]);

  await assert.rejects(
    getVersionInfo({ versionFile: "/unused", fetchImpl }),
    /Could not parse any server filename/,
  );
});

test("checkVersion logs up-to-date and caches the result", async () => {
  const realLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(" "));

  try {
    const versionFile = mkVersionFile("terraria-server-1449.zip");
    const fetchImpl = fetchOk(["terraria-server-1449.zip"]);
    const result = await checkVersion({ versionFile, fetchImpl });

    assert.match(lines[0], /\[Version\] Terraria server is up to date \(1\.4\.4\.9\)/);
    assert.deepEqual(getVersionStatus(), result);
    assert.equal(result.upToDate, true);
  } finally {
    console.log = realLog;
  }
});

test("checkVersion logs outdated and missing installs", async () => {
  const realLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(" "));

  try {
    const outdated = await checkVersion({
      versionFile: mkVersionFile("terraria-server-1355.zip"),
      fetchImpl: fetchOk(["terraria-server-1449.zip"]),
    });
    assert.match(lines.at(-1), /outdated: installed 1\.3\.5\.5, latest 1\.4\.4\.9/);
    assert.equal(outdated.upToDate, false);

    const missing = await checkVersion({
      versionFile: mkVersionFile(null),
      fetchImpl: fetchOk(["terraria-server-1449.zip"]),
    });
    assert.match(lines.at(-1), /not installed yet/);
    assert.equal(missing.installed, null);
  } finally {
    console.log = realLog;
  }
});

test("checkVersion survives network errors and reports them", async () => {
  const realLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(" "));

  try {
    const fetchImpl = mock.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const result = await checkVersion({ versionFile: "/unused", fetchImpl });

    assert.match(lines.at(-1), /\[Version\] Update check failed: ECONNREFUSED/);
    assert.deepEqual(getVersionStatus(), { error: "ECONNREFUSED" });
    assert.deepEqual(result, { error: "ECONNREFUSED" });
  } finally {
    console.log = realLog;
  }
});
