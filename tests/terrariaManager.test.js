import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { mock } from "node:test";

process.env.TERRARIA_DIR = "/tmp/terraria-test";
process.env.TERRARIA_EXE = "TerrariaServer";

const logLines = [];
const realLog = console.log;
console.log = (...args) => logLines.push(args.join(" "));

function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdinWrites = [];
  child.stdin = { write: (s) => child.stdinWrites.push(s) };
  child.kill = mock.fn(() => child.emit("close", 0));
  return child;
}

let currentChild = null;
const spawnMock = mock.fn(() => {
  currentChild = makeFakeChild();
  return currentChild;
});
mock.module("child_process", { namedExports: { spawn: spawnMock } });

const fakeLogStream = { write: () => {}, end: () => {} };
const readdirSync = mock.fn(() => ["World1.wld", "World2.wld"]);
const existsSync = mock.fn(() => false);
const unlinkSync = mock.fn();
const fsMock = {
  createWriteStream: () => fakeLogStream,
  readdirSync,
  existsSync,
  unlinkSync,
};
mock.module("fs", { exports: { default: fsMock, ...fsMock } });

const checkPermission = mock.fn(() => true);
mock.module("../core/allowlistManager.js", { namedExports: { checkPermission } });

const tm = await import("../core/terrariaManager.js");
const TERRARIA_DIR = process.env.TERRARIA_DIR;
const EXE = path.join(TERRARIA_DIR, "TerrariaServer");
const WORLDS_DIR = path.join(
  os.homedir(),
  ".local",
  "share",
  "Terraria",
  "Worlds",
);

const stdout = (text) => currentChild.stdout.emit("data", Buffer.from(text));
const stdin = () => currentChild.stdinWrites;
const bootToOnline = () => {
  stdout("Max players: \n");
  stdout("Server port number: \n");
  stdout("Automatically forward port? \n");
  stdout("Server password: \n");
  stdout("Listening on port 7777\n");
};

test("startServer spawns the configured exe and reaches MENU", () => {
  const result = tm.startServer();

  assert.deepEqual(result, { success: true, message: "Server booted. Waiting at main menu." });
  assert.equal(tm.serverState, "MENU");
  assert.equal(tm.getProcess(), currentChild);
  assert.equal(spawnMock.mock.calls[0].arguments[0], EXE);
  assert.ok(logLines.some((l) => l.includes("[Manager] Booting Terraria Server...")));
});

test("startServer refuses when already running", () => {
  const result = tm.startServer();

  assert.equal(result.success, false);
  assert.match(result.message, /already running/);
});

test("listWorlds keeps only .wld files, stripped of extension", () => {
  readdirSync.mock.mockImplementation(() => ["World1.wld", "notes.txt", "World2.wld"]);
  const result = tm.listWorlds();

  assert.deepEqual(result, { success: true, worlds: ["World1", "World2"] });
});

test("listWorlds treats a missing worlds dir as an empty list", () => {
  const missing = new Error("no such file or directory, scandir");
  missing.code = "ENOENT";
  readdirSync.mock.mockImplementation(() => {
    throw missing;
  });

  assert.deepEqual(tm.listWorlds(), { success: true, worlds: [] });
});

test("listWorlds reports failure when the worlds dir is unreadable", () => {
  const denied = new Error("permission denied, scandir");
  denied.code = "EACCES";
  readdirSync.mock.mockImplementation(() => {
    throw denied;
  });

  assert.equal(tm.listWorlds().success, false);
});

test("selectWorld rejects ids outside the world list", () => {
  readdirSync.mock.mockImplementation(() => ["World1.wld", "World2.wld"]);
  const bad = tm.selectWorld({ worldId: "3" });
  const zero = tm.selectWorld({ worldId: "0" });
  const nan = tm.selectWorld({ worldId: "abc" });

  for (const r of [bad, zero, nan]) {
    assert.equal(r.success, false);
    assert.match(r.message, /Invalid World ID/);
  }
  assert.equal(tm.serverState, "MENU");
});

test("selectWorld writes the chosen id and enters BOOTING", () => {
  const result = tm.selectWorld({
    worldId: "2",
    maxPlayers: "16",
    port: "7777",
    upnp: "n",
    password: "secret",
  });

  assert.equal(result.success, true);
  assert.equal(tm.serverState, "BOOTING");
  assert.equal(tm.activeWorld, "World2");
  assert.deepEqual(stdin(), ["2\n"]);
});

test("boot prompts are answered from bootConfig until ONLINE", () => {
  stdout("Max players: \n");
  stdout("Server port number: \n");
  stdout("Automatically forward port? \n");
  stdout("Server password: \n");

  assert.deepEqual(stdin(), ["2\n", "16\n", "7777\n", "n\n", "secret\n"]);

  stdout("Listening on port 7777\n");
  assert.equal(tm.serverState, "ONLINE");
  assert.match(logLines.at(-1), /Server fully online on port 7777/);
});

test("selectWorld is refused while the server is ONLINE", () => {
  const result = tm.selectWorld({ worldId: "1" });

  assert.equal(result.success, false);
  assert.match(result.message, /Cannot select world/);
});

test("joins are tracked without duplicates", () => {
  stdout("Foo has joined.\n");
  stdout("Foo has joined.\n");

  assert.deepEqual(tm.getPlayerStats().players, ["Foo"]);
});

test("leaves remove the player from the list", () => {
  stdout("Foo has left.\n");

  assert.deepEqual(tm.getPlayerStats().players, []);
  assert.equal(tm.getPlayerStats().count, 0);
});

test("chat commands with permission are relayed to the server", () => {
  stdout("<Bar> /noon\n");

  assert.deepEqual(checkPermission.mock.calls.at(-1).arguments, ["Bar", "noon"]);
  assert.ok(stdin().includes("noon\n"));
  assert.ok(stdin().includes("say Bar ran noon\n"));
});

test("chat commands without permission get a denial broadcast", () => {
  checkPermission.mock.mockImplementation(() => false);
  stdout("<Bar> /ban\n");

  assert.ok(!stdin().includes("ban\n"));
  assert.ok(stdin().includes("say You don't have permission to run that.\n"));
  checkPermission.mock.mockImplementation(() => true);
});

test("sendCommand writes command and say payloads while ONLINE", () => {
  const before = stdin().length;
  const result = tm.sendCommand("noon", "hello all");

  assert.equal(result.success, true);
  assert.deepEqual(stdin().slice(before), ["noon\n", "say hello all\n"]);
});

test("exitWorld sends the graceful exit while ONLINE", () => {
  const result = tm.exitWorld();

  assert.equal(result.success, true);
  assert.deepEqual(stdin().at(-1), "exit\n");
});

test("server close resets all state to OFFLINE", () => {
  stdout("Bar has joined.\n");
  currentChild.emit("close", 0);

  assert.equal(tm.serverState, "OFFLINE");
  assert.equal(tm.getProcess(), null);
  assert.equal(tm.activeWorld, null);
  assert.deepEqual(tm.getPlayerStats().players, []);
});

test("stopServer while OFFLINE is rejected", () => {
  const result = tm.stopServer();

  assert.equal(result.success, false);
  assert.match(result.message, /already offline/);
});

test("sendCommand while OFFLINE is rejected", () => {
  const result = tm.sendCommand("noon");

  assert.equal(result.success, false);
  assert.match(result.message, /ONLINE/);
});

test("exitWorld while OFFLINE is rejected", () => {
  const result = tm.exitWorld();

  assert.equal(result.success, false);
  assert.match(result.message, /not currently online/);
});

test("createWorld starts the creation sequence with 'n'", () => {
  tm.startServer();
  const before = stdin().length;
  const result = tm.createWorld({
    size: "3",
    difficulty: "2",
    evil: "1",
    name: "My World",
    seed: "",
    specialSeeds: [],
  });

  assert.equal(result.success, true);
  assert.equal(tm.serverState, "CREATING");
  assert.deepEqual(stdin().slice(before), ["n\n"]);
});

test("creation prompts are answered from createConfig (name sanitized)", () => {
  stdout("Choose size: 1 Small 2 Medium 3 Large\n");
  stdout("Choose difficulty:\n");
  stdout("Choose world evil:\n");
  stdout("Enter world name:\n");
  stdout("Enter Seed (Leave Blank For Random):\n");
  stdout("Enter Seed Number to enable/disable it\n");

  assert.deepEqual(stdin().slice(-7), [
    "n\n",
    "3\n",
    "2\n",
    "1\n",
    "My_World\n",
    "\n",
    "\n",
  ]);
});

test("final world-list prompt ends creation and returns to MENU", () => {
  stdout("Choose World: d <number>\n");

  assert.equal(tm.serverState, "MENU");
  assert.equal(tm.activeWorld, null);
});

test("boot loop detection during CREATING resets to MENU", () => {
  tm.createWorld({ name: "Looped", seed: "", specialSeeds: [] });
  stdout("d <number>\n");

  assert.equal(tm.serverState, "MENU");
  assert.deepEqual(tm.getPlayerStats().players, []);
});

test("deleteWorld is refused while a game is running", async () => {
  tm.createWorld({ name: "X", seed: "", specialSeeds: [] });
  const result = await tm.deleteWorld("World1");

  assert.equal(result.success, false);
  assert.match(result.message, /Cannot delete worlds while a game is running/);
  stdout("d <number>\n");
  assert.equal(tm.serverState, "MENU");
});

test("deleteWorld reports missing files", async () => {
  existsSync.mock.mockImplementation(() => false);
  const result = await tm.deleteWorld("Missing");

  assert.equal(result.success, false);
  assert.match(result.message, /not found on disk/);
});

test("deleteWorld at MENU deletes files and restarts the server", async () => {
  existsSync.mock.mockImplementation(() => true);
  const spawnsBefore = spawnMock.mock.calls.length;
  const result = await tm.deleteWorld("World1");
  const wldPath = path.join(WORLDS_DIR, "World1.wld");
  const bakPath = path.join(WORLDS_DIR, "World1.wld.bak");

  assert.equal(result.success, true);
  assert.match(result.message, /Server restarted/);
  assert.deepEqual(unlinkSync.mock.calls[0].arguments, [wldPath]);
  assert.deepEqual(unlinkSync.mock.calls[1].arguments, [bakPath]);
  assert.equal(spawnMock.mock.calls.length, spawnsBefore + 1);
  assert.equal(tm.serverState, "MENU");
  assert.equal(tm.getProcess(), currentChild);
});

test("deleteWorld while OFFLINE deletes without restarting", async () => {
  currentChild.emit("close", 0);
  const spawnsBefore = spawnMock.mock.calls.length;
  const result = await tm.deleteWorld("World2");

  assert.equal(result.success, true);
  assert.equal(result.message, "Deleted World2.");
  assert.equal(spawnMock.mock.calls.length, spawnsBefore);
  assert.equal(tm.serverState, "OFFLINE");
});

test("restartServer boots when nothing is running", async () => {
  const result = await tm.restartServer();

  assert.equal(result.success, true);
  assert.equal(tm.serverState, "MENU");
});

test("restartServer kills and reboots when running", async () => {
  const oldChild = currentChild;
  const result = await tm.restartServer();

  assert.equal(result.success, true);
  assert.deepEqual(oldChild.kill.mock.calls[0].arguments, ["SIGINT"]);
  assert.notEqual(tm.getProcess(), oldChild);
  assert.equal(tm.serverState, "MENU");
  assert.equal(tm.getProcess(), currentChild);
});

test("console logs are capped at MAX_LOGS", () => {
  const chunk = Array.from({ length: 1200 }, (_, i) => `log ${i}`).join("\n");
  stdout(chunk);

  assert.equal(tm.getConsoleLogs().length, 1000);
  assert.equal(tm.getConsoleLogs().at(-1).content, "log 1199");
});

test("stderr output is tagged [ERR] in the console log", () => {
  currentChild.stderr.emit("data", Buffer.from("boom\n"));
  const last = tm.getConsoleLogs().at(-1);

  assert.equal(last.content, "[ERR] boom");
});

test.after(() => {
  console.log = realLog;
});
