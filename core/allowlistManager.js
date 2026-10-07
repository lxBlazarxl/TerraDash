import fs from "fs";
import path from "path";

let ALLOWLIST_PATH = "./allowlist.json";
let allowlist = {};

const save = () => {
  try {
    const tmpPath = `${ALLOWLIST_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(allowlist, null, 2));
    fs.renameSync(tmpPath, ALLOWLIST_PATH);
  } catch (err) {
    console.error("[Allowlist] Failed to save:", err);
    throw err;
  }
};

const normalize = (parsed) => {
  // Accept only a plain object mapping player -> array of command strings.
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const result = {};
  for (const [player, commands] of Object.entries(parsed)) {
    if (Array.isArray(commands)) {
      result[player] = commands.filter((c) => typeof c === "string");
    }
  }
  return result;
};

export const init = (filePath = "./allowlist.json") => {
  ALLOWLIST_PATH = filePath;
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    allowlist = {};
    save();
    return;
  }

  try {
    const raw = fs.readFileSync(ALLOWLIST_PATH, "utf8");
    allowlist = normalize(JSON.parse(raw));
  } catch (err) {
    console.error(
      `[Allowlist] Could not parse ${path.basename(ALLOWLIST_PATH)}; starting empty:`,
      err.message,
    );
    allowlist = {};
    save();
  }
};

export const getAllowlist = () => structuredClone(allowlist);

export const checkPermission = (player, command) =>
  allowlist[player]?.includes(command) ?? false;

export const addPlayer = (player) => {
  if (allowlist[player]) return;
  allowlist[player] = [];
  save();
};

export const removePlayer = (player) => {
  delete allowlist[player];
  save();
};

export const grantCommand = (player, command) => {
  if (!allowlist[player]) throw new Error("Player not found");
  if (!allowlist[player].includes(command)) {
    allowlist[player].push(command);
    save();
  }
};

export const revokeCommand = (player, command) => {
  if (!allowlist[player]) throw new Error("Player not found");
  allowlist[player] = allowlist[player].filter((c) => c !== command);
  save();
};
