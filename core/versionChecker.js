import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const API_BASE = "https://terraria.org/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VERSION_FILE = path.join(ROOT, "terraria", ".version");

export const PLATFORM_EXE = {
  linux: "TerrariaServer.bin.x86_64",
  darwin: "TerrariaServer",
  win32: "TerrariaServer.exe",
}[os.platform()];

export const prettyVersion = (num) =>
  num.length === 4 ? `1.${[...num.slice(1)].join(".")}` : num;

export const fetchLatestServerName = async (fetchImpl = fetch) => {
  const res = await fetchImpl(`${API_BASE}/get/dedicated-servers-names`);
  if (!res.ok) throw new Error(`Version endpoint returned ${res.status}.`);

  const names = await res.json();

  const unique = [...new Set(names)];
  const parsed = unique
    .map((name) => {
      const match = name.match(/^terraria-server-(\d+)\.zip$/);
      return match ? { name, num: match[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.num) - Number(a.num));

  if (parsed.length === 0)
    throw new Error("Could not parse any server filename from the version endpoint.");
  return parsed[0];
};

export const readInstalledVersion = (versionFile = VERSION_FILE) =>
  fs.existsSync(versionFile) ? fs.readFileSync(versionFile, "utf8").trim() : null;

export const getVersionInfo = async ({ versionFile, fetchImpl } = {}) => {
  const latest = await fetchLatestServerName(fetchImpl);
  const installed = readInstalledVersion(versionFile);
  const installedNum = installed?.match(/^terraria-server-(\d+)\.zip$/)?.[1] ?? null;

  return {
    installed,
    installedLabel: installed ? (installedNum ? prettyVersion(installedNum) : installed) : null,
    latest: latest.name,
    latestLabel: prettyVersion(latest.num),
    upToDate: installed === latest.name,
  };
};

let lastCheck = null;

export const getVersionStatus = () => lastCheck;

export const checkVersion = async ({ versionFile, fetchImpl } = {}) => {
  try {
    const info = await getVersionInfo({ versionFile, fetchImpl });

    if (info.upToDate) {
      console.log(`[Version] Terraria server is up to date (${info.latestLabel}).`);
    } else if (!info.installed) {
      console.log('[Version] Terraria server is not installed yet. Run "npm run server:update".');
    } else {
      console.log(
        `[Version] Terraria server is outdated: installed ${info.installedLabel}, ` +
          `latest ${info.latestLabel}. Run "npm run server:update".`,
      );
    }
    lastCheck = info;
  } catch (err) {
    console.log(`[Version] Update check failed: ${err.message}`);
    lastCheck = { error: err.message };
  }
  return lastCheck;
};
