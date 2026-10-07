#!/usr/bin/env node
// One-command production startup:
//   1. Install/update the Terraria dedicated server (no-op when current)
//   2. Build the dashboard client when sources changed
//   3. Serve the dashboard + API on PORT
//
// Flags:
//   --force    re-download the Terraria server even when up to date
//   --rebuild  rebuild the client even when nothing changed

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { updateServer } from "../core/serverUpdater.js";
import { readInstalledVersion } from "../core/versionChecker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CLIENT_DIR = path.join(ROOT, "client");
const DIST_INDEX = path.join(ROOT, "dist", "index.html");

const FORCE = process.argv.includes("--force");
const REBUILD = process.argv.includes("--rebuild");

const log = (msg) => console.log(`[Start] ${msg}`);
const die = (msg) => {
  console.error(`[Start] ERROR: ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(path.join(ROOT, "node_modules", "express"))) {
  die("Dependencies are not installed. Run `npm install` first.");
}
if (!fs.existsSync(path.join(ROOT, "node_modules", "vite"))) {
  die("vite is missing. Dev dependencies are required to build the client; run `npm install` (not --production).");
}

// --- 1. Terraria server update ---------------------------------------------

const step = (msg) => log(`[Updater] ${msg}`);

try {
  const result = await updateServer({ force: FORCE, onStep: step });
  log(result.message);
} catch (err) {
  if (readInstalledVersion()) {
    log(
      `Update check failed (${err.message}); ` +
        "starting with the existing Terraria install.",
    );
  } else {
    die(
      `Terraria server is not installed and the update check failed: ${err.message}. ` +
        "Fix connectivity or run `npm run server:update` manually.",
    );
  }
}

// --- 2. Build the client when sources are newer than dist/ -----------------

const newestMtime = (dir, base = dir, max = 0) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      max = newestMtime(full, base, max);
    } else {
      max = Math.max(max, fs.statSync(full).mtimeMs);
    }
  }
  return max;
};

const buildClient = () => {
  log("Building dashboard client...");
  const result = spawnSync("npx", ["vite", "build", "client/"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) die("Client build failed.");
  log("Client build complete.");
};

const stale =
  REBUILD ||
  !fs.existsSync(DIST_INDEX) ||
  newestMtime(CLIENT_DIR) > fs.statSync(DIST_INDEX).mtimeMs;

if (stale) {
  buildClient();
} else {
  log("Dashboard client is up to date; skipping build.");
}

// --- 3. Start the dashboard -------------------------------------------------

log("Starting dashboard (production)...");
const child = spawn(process.execPath, ["server.js"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

const forward = (signal) => child.kill(signal);
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
