import fs from "fs";

let ALLOWLIST_PATH = "./allowlist.json";
let allowlist = {};

const save = () => {
  try {
    fs.writeFileSync(ALLOWLIST_PATH, JSON.stringify(allowlist, null, 2));
  } catch (err) {
    console.error("[Allowlist] Failed to save:", err);
    throw err;
  }
};

export const init = (filePath = "./allowlist.json") => {
  ALLOWLIST_PATH = filePath;
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    allowlist = {};
    save();
  } else {
    allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
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
