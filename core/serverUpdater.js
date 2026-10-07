import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  fetchLatestServerName,
  readInstalledVersion,
  prettyVersion,
  PLATFORM_EXE,
} from "./versionChecker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TERRADASH_ROOT
  ? path.resolve(process.env.TERRADASH_ROOT)
  : path.resolve(__dirname, "..");
const SERVER_DIR = path.join(ROOT, "terraria");
const VERSION_FILE = path.join(SERVER_DIR, ".version");
const ENV_FILE = path.join(ROOT, ".env");

const PLATFORM_DIR = { linux: "Linux", darwin: "Mac", win32: "Windows" }[os.platform()];

let updating = false;

const download = async (url, destPath, onProgress = () => {}) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download returned ${res.status} for ${url}.`);

  const total = Number(res.headers.get("content-length")) || 0;
  const out = fs.createWriteStream(destPath);
  const source = Readable.fromWeb(res.body);
  let received = 0;

  await new Promise((resolve, reject) => {
    source.on("data", (chunk) => {
      received += chunk.length;
      onProgress({ received, total, megabytes: Math.round(received / 1048576) });
    });
    source.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });
};

const extract = (zipPath, destDir, versionNum) => {
  const check = spawnSync("unzip", ["-v"]);
  if (check.error) throw new Error("'unzip' is not installed. Install it (e.g. `apt install unzip`) and retry.");

  const patterns = [`${versionNum}/${PLATFORM_DIR}/*`];
  const result = spawnSync("unzip", ["-o", "-q", zipPath, ...patterns, "-d", destDir], {
    stdio: "ignore",
  });
  if (result.status !== 0) throw new Error(`unzip failed with code ${result.status}.`);
};

const install = (tmpExtractDir, versionNum) => {
  const srcDir = path.join(tmpExtractDir, versionNum, PLATFORM_DIR);
  if (!fs.existsSync(srcDir)) throw new Error(`Archive did not contain ${versionNum}/${PLATFORM_DIR}.`);

  fs.mkdirSync(SERVER_DIR, { recursive: true });

  for (const entry of fs.readdirSync(srcDir)) {
    if (entry === "Worlds") continue;
    fs.cpSync(path.join(srcDir, entry), path.join(SERVER_DIR, entry), { recursive: true, force: true });
  }

  for (const bin of ["TerrariaServer", "TerrariaServer.bin.x86_64", "TerrariaServer.exe"]) {
    const binPath = path.join(SERVER_DIR, bin);
    if (fs.existsSync(binPath)) fs.chmodSync(binPath, 0o755);
  }
};

const updateEnv = () => {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split("\n") : [];
  const set = (key, value) => {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    const line = `${key}=${value}`;
    if (index === -1) lines.push(line);
    else lines[index] = line;
  };

  set("TERRARIA_DIR", SERVER_DIR);
  set("TERRARIA_EXE", PLATFORM_EXE);

  fs.writeFileSync(ENV_FILE, lines.join("\n"));
};

export const isUpdating = () => updating;

export const updateServer = async ({ force = false, onProgress, onStep } = {}) => {
  const step = onStep ?? (() => {});
  if (updating) {
    return { success: false, updated: false, message: "An update is already in progress." };
  }

  updating = true;
  try {
    const latest = await fetchLatestServerName();
    const installed = readInstalledVersion(VERSION_FILE);

    if (installed === latest.name && !force) {
      return {
        success: true,
        updated: false,
        version: prettyVersion(latest.num),
        message: `Already up to date (${prettyVersion(latest.num)}).`,
      };
    }

    const tmpDir = path.join(SERVER_DIR, ".tmp");
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, latest.name);
    step(`Downloading ${latest.name} (~45 MB)...`);
    await download(
      `https://terraria.org/api/download/pc-dedicated-server/${latest.name}`,
      zipPath,
      onProgress,
    );

    step(`Extracting ${PLATFORM_DIR} files...`);
    extract(zipPath, tmpDir, latest.num);
    fs.unlinkSync(zipPath);

    step(`Installing into ${SERVER_DIR} (existing Worlds are preserved)...`);
    install(tmpDir, latest.num);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    fs.writeFileSync(VERSION_FILE, latest.name);
    updateEnv();

    return {
      success: true,
      updated: true,
      version: prettyVersion(latest.num),
      message: `Installed Terraria server ${prettyVersion(latest.num)}.`,
    };
  } finally {
    updating = false;
  }
};
