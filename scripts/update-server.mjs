#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updateServer } from "../core/serverUpdater.js";
import { PLATFORM_EXE } from "../core/versionChecker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER_DIR = path.join(ROOT, "terraria");
const ENV_FILE = path.join(ROOT, ".env");

const log = (msg) => console.log(`[Updater] ${msg}`);
const die = (msg) => {
  console.error(`[Updater] ERROR: ${msg}`);
  process.exit(1);
};

const main = async () => {
  const force = process.argv.includes("--force");
  log(`Updating Terraria server in ${SERVER_DIR}...`);

  const result = await updateServer({
    force,
    onStep: log,
    onProgress: ({ received, total }) => {
      if (total > 0) {
        process.stdout.write(
          `\r[Updater] Downloading... ${Math.round((received / total) * 100)}% (${Math.round(received / 1048576)} MB)`,
        );
      }
    },
  });

  process.stdout.write("\n");
  if (!result.success) die(result.message);

  log(result.message);

  if (result.updated) {
    log(`Updated .env: TERRARIA_DIR=${SERVER_DIR}, TERRARIA_EXE=${PLATFORM_EXE}.`);
    log("Restart the dashboard if it was running.");
  }
};

main().catch((err) => die(err.message));
