import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mock } from "node:test";

process.env.TERRARIA_DIR = "/tmp/terraria-test";
process.env.TERRARIA_EXE = "TerrariaServer";

const allowDefaults = {
  getAllowlist: () => ({ Admin: ["ban"] }),
  addPlayer: () => {},
  removePlayer: () => {},
  grantCommand: () => {},
  revokeCommand: () => {},
};

const managerDefaults = {
  getPlayerStats: () => ({ success: true, count: 2, players: ["A", "B"] }),
  getConsoleLogs: () => [{ time: "10:00", content: "hi" }],
  startServer: () => ({ success: true, message: "booting" }),
  stopServer: () => ({ success: true, message: "stopping" }),
  restartServer: async () => ({ success: true, message: "restarting" }),
  sendCommand: () => ({ success: true, message: "sent" }),
  selectWorld: () => ({ success: true, message: "selected" }),
  exitWorld: () => ({ success: true, message: "exiting" }),
  deleteWorld: async () => ({ success: true, message: "deleted" }),
  listWorlds: () => ({ success: true, worlds: ["World1"] }),
  createWorld: () => ({ success: true, message: "creating" }),
};

const allowlistMocks = {};
for (const [name, impl] of Object.entries(allowDefaults)) {
  allowlistMocks[name] = mock.fn(impl);
}

const managerMocks = {};
for (const [name, impl] of Object.entries(managerDefaults)) {
  managerMocks[name] = mock.fn(impl);
}

const updaterDefaults = {
  updateServer: async () => ({ success: true, updated: false, version: "1.4.5.8", message: "Already up to date (1.4.5.8)." }),
  isUpdating: () => false,
};

const versionDefaults = {
  checkVersion: async () => ({ upToDate: true }),
  getVersionStatus: () => null,
};

const updaterMocks = {};
for (const [name, impl] of Object.entries(updaterDefaults)) {
  updaterMocks[name] = mock.fn(impl);
}

const versionMocks = {};
for (const [name, impl] of Object.entries(versionDefaults)) {
  versionMocks[name] = mock.fn(impl);
}

mock.module("../core/allowlistManager.js", { namedExports: allowlistMocks });
mock.module("../core/terrariaManager.js", {
  namedExports: {
    ...managerMocks,
    serverState: "OFFLINE",
    activeWorld: null,
  },
});
mock.module("../core/serverUpdater.js", { namedExports: updaterMocks });
mock.module("../core/versionChecker.js", { namedExports: versionMocks });

const express = (await import("express")).default;
const app = express();
app.use(express.json());
app.use("/api/power", (await import("../routes/power.js")).default);
app.use("/api/worlds", (await import("../routes/worlds.js")).default);
app.use("/api/status", (await import("../routes/status.js")).default);
app.use("/api/command", (await import("../routes/commands.js")).default);
app.use("/api/players", (await import("../routes/players.js")).default);
app.use("/api/allowlist", (await import("../routes/allowlist.js")).default);

const resetCore = () => {
  for (const [name, impl] of Object.entries(allowDefaults)) {
    allowlistMocks[name].mock.resetCalls();
    allowlistMocks[name].mock.mockImplementation(impl);
  }
  for (const [name, impl] of Object.entries(managerDefaults)) {
    managerMocks[name].mock.resetCalls();
    managerMocks[name].mock.mockImplementation(impl);
  }
  for (const [name, impl] of Object.entries(updaterDefaults)) {
    updaterMocks[name].mock.resetCalls();
    updaterMocks[name].mock.mockImplementation(impl);
  }
  for (const [name, impl] of Object.entries(versionDefaults)) {
    versionMocks[name].mock.resetCalls();
    versionMocks[name].mock.mockImplementation(impl);
  }
};

let server;
let baseURL;
test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());
test.afterEach(resetCore);

const call = async (method, url, body) => {
  const res = await fetch(baseURL + url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

test("GET /api/allowlist returns the allowlist", async () => {
  const res = await call("GET", "/api/allowlist");

  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { success: true, allowlist: { Admin: ["ban"] } });
});

test("POST /api/allowlist/:player adds a player", async () => {
  const res = await call("POST", "/api/allowlist/Steve");

  assert.equal(res.status, 200);
  assert.match(res.json.message, /added to allowlist/);
  assert.deepEqual(allowlistMocks.addPlayer.mock.calls[0].arguments, ["Steve"]);
});

test("DELETE /api/allowlist/:player removes a player", async () => {
  const res = await call("DELETE", "/api/allowlist/Steve");

  assert.equal(res.status, 200);
  assert.deepEqual(allowlistMocks.removePlayer.mock.calls[0].arguments, ["Steve"]);
});

test("granting a command resolves 200", async () => {
  const res = await call("POST", "/api/allowlist/Steve/commands/ban");

  assert.equal(res.status, 200);
  assert.deepEqual(allowlistMocks.grantCommand.mock.calls[0].arguments, ["Steve", "ban"]);
});

test("granting a command for unknown player resolves 404", async () => {
  allowlistMocks.grantCommand.mock.mockImplementation(() => {
    throw new Error("Player not found");
  });
  const res = await call("POST", "/api/allowlist/Ghost/commands/ban");

  assert.equal(res.status, 404);
  assert.equal(res.json.success, false);
});

test("revoking a command resolves 200", async () => {
  const res = await call("DELETE", "/api/allowlist/Steve/commands/ban");

  assert.equal(res.status, 200);
  assert.deepEqual(allowlistMocks.revokeCommand.mock.calls[0].arguments, ["Steve", "ban"]);
});

test("revoking a command for unknown player resolves 404", async () => {
  allowlistMocks.revokeCommand.mock.mockImplementation(() => {
    throw new Error("Player not found");
  });
  const res = await call("DELETE", "/api/allowlist/Ghost/commands/ban");

  assert.equal(res.status, 404);
  assert.equal(res.json.success, false);
});

test("POST /api/command with no payload resolves 400", async () => {
  const res = await call("POST", "/api/command", {});

  assert.equal(res.status, 400);
  assert.equal(managerMocks.sendCommand.mock.calls.length, 0);
});

test("POST /api/command forwards command and sayCommand", async () => {
  const res = await call("POST", "/api/command", { command: "noon", sayCommand: "hi" });

  assert.equal(res.status, 200);
  assert.deepEqual(managerMocks.sendCommand.mock.calls[0].arguments, ["noon", "hi"]);
});

test("POST /api/command resolves 403 when refused", async () => {
  managerMocks.sendCommand.mock.mockImplementation(() => ({ success: false, message: "offline" }));
  const res = await call("POST", "/api/command", { command: "noon" });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test("GET /api/players answers empty while server is not ONLINE", async () => {
  const res = await call("GET", "/api/players");

  assert.equal(res.status, 200);
  assert.deepEqual(res.json, {
    success: true,
    count: 0,
    players: [],
    message: "Server is not currently online.",
  });
  assert.equal(managerMocks.getPlayerStats.mock.calls.length, 0);
});

test("POST /api/power/on resolves 200 on success and 400 on failure", async () => {
  const good = await call("POST", "/api/power/on");
  assert.equal(good.status, 200);

  managerMocks.startServer.mock.mockImplementation(() => ({ success: false, message: "nope" }));
  const bad = await call("POST", "/api/power/on");
  assert.equal(bad.status, 400);
});

test("POST /api/power/off resolves 200 on success and 400 on failure", async () => {
  const good = await call("POST", "/api/power/off");
  assert.equal(good.status, 200);

  managerMocks.stopServer.mock.mockImplementation(() => ({ success: false, message: "nope" }));
  const bad = await call("POST", "/api/power/off");
  assert.equal(bad.status, 400);
});

test("POST /api/power/restart awaits the restart", async () => {
  const res = await call("POST", "/api/power/restart");

  assert.equal(res.status, 200);
  assert.equal(managerMocks.restartServer.mock.calls.length, 1);
});

test("GET /api/status reports the snapshot state and world", async () => {
  const res = await call("GET", "/api/status");

  assert.equal(res.status, 200);
  assert.deepEqual(res.json, {
    success: true,
    world: null,
    state: "OFFLINE",
    serverVersion: null,
  });
});

test("GET /api/status includes the cached version check", async () => {
  versionMocks.getVersionStatus.mock.mockImplementation(() => ({
    installed: "terraria-server-1449.zip",
    installedLabel: "1.4.4.9",
    latest: "terraria-server-1458.zip",
    latestLabel: "1.4.5.8",
    upToDate: false,
  }));

  const res = await call("GET", "/api/status");

  assert.equal(res.json.serverVersion.upToDate, false);
  assert.equal(res.json.serverVersion.latestLabel, "1.4.5.8");
});

test("POST /api/power/update reports up to date without restarting", async () => {
  const res = await call("POST", "/api/power/update");

  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  assert.equal(res.json.updated, false);
  assert.equal(managerMocks.restartServer.mock.calls.length, 0);
  assert.equal(versionMocks.checkVersion.mock.calls.length, 0);
});

test("POST /api/power/update refreshes the version cache after installing", async () => {
  updaterMocks.updateServer.mock.mockImplementation(async () => ({
    success: true,
    updated: true,
    version: "1.4.5.8",
    message: "Installed Terraria server 1.4.5.8.",
  }));

  const res = await call("POST", "/api/power/update");

  assert.equal(res.status, 200);
  assert.equal(res.json.updated, true);
  assert.equal(versionMocks.checkVersion.mock.calls.length, 1);
});

test("POST /api/power/update resolves 409 while another update runs", async () => {
  updaterMocks.isUpdating.mock.mockImplementation(() => true);

  const res = await call("POST", "/api/power/update");

  assert.equal(res.status, 409);
  assert.equal(res.json.success, false);
  assert.equal(updaterMocks.updateServer.mock.calls.length, 0);
});

test("POST /api/power/update resolves 500 when the updater reports failure", async () => {
  updaterMocks.updateServer.mock.mockImplementation(async () => ({
    success: false,
    message: "Download returned 503.",
  }));

  const res = await call("POST", "/api/power/update");

  assert.equal(res.status, 500);
  assert.equal(res.json.success, false);
});

test("POST /api/power/update resolves 500 when the updater throws", async () => {
  updaterMocks.updateServer.mock.mockImplementation(async () => {
    throw new Error("'unzip' is not installed.");
  });

  const res = await call("POST", "/api/power/update");

  assert.equal(res.status, 500);
  assert.match(res.json.message, /unzip/);
});

test("GET /api/status/logs returns console logs", async () => {
  const res = await call("GET", "/api/status/logs");

  assert.equal(res.status, 200);
  assert.deepEqual(res.json.logs, [{ time: "10:00", content: "hi" }]);
});

test("GET /api/worlds lists worlds, 500 on failure", async () => {
  const good = await call("GET", "/api/worlds");
  assert.equal(good.status, 200);
  assert.deepEqual(good.json, { success: true, worlds: ["World1"] });

  managerMocks.listWorlds.mock.mockImplementation(() => ({ success: false, message: "bad" }));
  const bad = await call("GET", "/api/worlds");
  assert.equal(bad.status, 500);
});

test("POST /api/worlds/select merges defaults into configUsed", async () => {
  const res = await call("POST", "/api/worlds/select", { worldId: "2", maxPlayers: "4" });

  assert.equal(res.status, 200);
  assert.deepEqual(res.json.configUsed, {
    worldId: "2",
    maxPlayers: "4",
    port: "7777",
    upnp: "n",
    password: "",
  });
  assert.deepEqual(managerMocks.selectWorld.mock.calls[0].arguments[0], res.json.configUsed);
});

test("POST /api/worlds/select resolves 400 when refused", async () => {
  managerMocks.selectWorld.mock.mockImplementation(() => ({ success: false, message: "nope" }));
  const res = await call("POST", "/api/worlds/select", { worldId: "2" });

  assert.equal(res.status, 400);
});

test("POST /api/worlds/create forwards the creation config with defaults", async () => {
  const res = await call("POST", "/api/worlds/create", { name: "My World" });

  assert.equal(res.status, 200);
  assert.deepEqual(managerMocks.createWorld.mock.calls[0].arguments[0], {
    size: "1",
    difficulty: "1",
    evil: "1",
    name: "My World",
    seed: "",
    specialSeeds: [],
  });
});

test("POST /api/worlds/create resolves 400 when refused", async () => {
  managerMocks.createWorld.mock.mockImplementation(() => ({ success: false, message: "nope" }));
  const res = await call("POST", "/api/worlds/create", {});

  assert.equal(res.status, 400);
});

test("POST /api/worlds/exit resolves 200 on success and 400 on failure", async () => {
  const good = await call("POST", "/api/worlds/exit");
  assert.equal(good.status, 200);

  managerMocks.exitWorld.mock.mockImplementation(() => ({ success: false, message: "nope" }));
  const bad = await call("POST", "/api/worlds/exit");
  assert.equal(bad.status, 400);
});

test("POST /api/worlds/delete requires worldName", async () => {
  const res = await call("POST", "/api/worlds/delete", {});

  assert.equal(res.status, 400);
  assert.equal(managerMocks.deleteWorld.mock.calls.length, 0);
});

test("POST /api/worlds/delete resolves 200 on success and 403 on failure", async () => {
  const good = await call("POST", "/api/worlds/delete", { worldName: "World1" });
  assert.equal(good.status, 200);
  assert.deepEqual(managerMocks.deleteWorld.mock.calls[0].arguments, ["World1"]);

  managerMocks.deleteWorld.mock.mockImplementation(async () => ({
    success: false,
    message: "nope",
  }));
  const bad = await call("POST", "/api/worlds/delete", { worldName: "World1" });
  assert.equal(bad.status, 403);
});
