import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { checkPermission } from "./allowlistManager.js";

let terrariaProcess = null;
let bootConfig = null;
let createConfig = null;

export let serverState = "OFFLINE";
export let activeWorld = null;
export let playerList = [];
export let consoleLogs = [];

const MAX_LOGS = 1000;
const RESTART_TIMEOUT_MS = 15000;

const TERRARIA_DIR = process.env.TERRARIA_DIR || "";
const TERRARIA_EXE = process.env.TERRARIA_EXE || "";
// TerrariaServer always stores worlds in ~/.local/share/Terraria/Worlds on
// Linux, regardless of where the server files live. Override with
// TERRARIA_WORLDS_DIR for other platforms or custom setups.
const WORLDS_DIR =
  process.env.TERRARIA_WORLDS_DIR ||
  path.join(os.homedir(), ".local", "share", "Terraria", "Worlds");

const isConfigured = () => Boolean(TERRARIA_DIR && TERRARIA_EXE);

// Strip CR/LF so a caller cannot inject extra commands into the server stdin.
const sanitizeCommand = (value) =>
  String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();

const pushToConsole = (text) => {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    consoleLogs.push({
      time: new Date().toLocaleTimeString(),
      content: line.trim(),
    });
  }
  if (consoleLogs.length > MAX_LOGS) {
    consoleLogs = consoleLogs.slice(consoleLogs.length - MAX_LOGS);
  }
};

export const getConsoleLogs = () => consoleLogs;

export const getPlayerStats = () => ({
  success: true,
  count: playerList.length,
  players: playerList,
});

export const startServer = () => {
  if (terrariaProcess) {
    return { success: false, message: "Server is already running." };
  }

  if (!isConfigured()) {
    return {
      success: false,
      message:
        "TERRARIA_DIR and TERRARIA_EXE must be set in .env before starting the server.",
    };
  }

  console.log("[Manager] Booting Terraria Server...");

  const logStream = fs.createWriteStream("server.log", { flags: "a" });
  const exePath = path.join(TERRARIA_DIR, TERRARIA_EXE);

  let child;
  try {
    child = spawn(exePath, []);
  } catch (err) {
    console.error("[Manager] Failed to spawn server:", err);
    logStream.end();
    return { success: false, message: `Failed to spawn server: ${err.message}` };
  }

  terrariaProcess = child;
  serverState = "MENU";

  child.stdout.on("data", (data) => {
    const text = data.toString();

    logStream.write(data);
    process.stdout.write(text);
    pushToConsole(text);

    if (
      (serverState === "BOOTING" || serverState === "CREATING") &&
      text.includes("d <number>")
    ) {
      console.log("[Manager] Loop detected. Resetting to MENU state.");
      serverState = "MENU";
      activeWorld = null;
      bootConfig = null;
      createConfig = null;
      playerList = [];
      return;
    }

    if (serverState === "ONLINE") {
      const lines = text.split("\n");

      for (const line of lines) {
        const joinMatch = line.match(/(.+) has joined\./);
        if (joinMatch) {
          const playerName = joinMatch[1].trim();
          if (!playerList.includes(playerName)) {
            playerList.push(playerName);
            console.log(
              `[Manager] Player Joined: ${playerName}. Total: ${playerList.length}`,
            );
          }
        }

        const leaveMatch = line.match(/(.+) has left\./);
        if (leaveMatch) {
          const playerName = leaveMatch[1].trim();
          playerList = playerList.filter((name) => name !== playerName);
          console.log(
            `[Manager] Player Left: ${playerName}. Total: ${playerList.length}`,
          );
        }

        const chatMatch = line.match(/^<(.+)> \/(\w+)$/);
        if (chatMatch) {
          const playerName = chatMatch[1].trim();
          const command = sanitizeCommand(chatMatch[2]);
          if (command && checkPermission(playerName, command)) {
            console.log(`[Manager] ${playerName} ran /${command} via allowlist.`);
            child.stdin.write(`${command}\n`);
            child.stdin.write(`say ${playerName} ran ${command}\n`);
          } else {
            console.log(`[Manager] ${playerName} denied /${command} - not on allowlist.`);
            child.stdin.write(`say You don't have permission to run that.\n`);
          }
        }
      }
    }

    if (bootConfig) {
      if (text.includes("Max players")) {
        child.stdin.write(`${bootConfig.maxPlayers}\n`);
      } else if (text.includes("Server port")) {
        child.stdin.write(`${bootConfig.port}\n`);
      } else if (text.includes("Automatically forward port")) {
        child.stdin.write(`${bootConfig.upnp}\n`);
      } else if (text.includes("Server password")) {
        child.stdin.write(`${bootConfig.password}\n`);
      } else if (text.includes("Listening on port")) {
        console.log(
          `[Manager] Server fully online on port ${bootConfig.port}.`,
        );
        serverState = "ONLINE";
        bootConfig = null;
      }
    }

    if (serverState === "CREATING" && createConfig) {
      const reply = (val) => child.stdin.write(`${val}\n`);

      if (text.includes("Choose size:")) {
        reply(createConfig.size || "1");
      } else if (text.includes("Choose difficulty:")) {
        reply(createConfig.difficulty || "1");
      } else if (text.includes("Choose world evil:")) {
        reply(createConfig.evil || "1");
      } else if (text.includes("Enter world name:")) {
        const safeName = (createConfig.name || "NewWorld").replace(/\s+/g, "_");
        reply(safeName);
      } else if (text.includes("Enter Seed (Leave Blank For Random):")) {
        reply(createConfig.seed || "");
      } else if (text.includes("Enter Seed Number to enable/disable it")) {
        if (createConfig.specialSeeds && createConfig.specialSeeds.length > 0) {
          const seedToToggle = createConfig.specialSeeds.shift();
          reply(seedToToggle);
        } else {
          child.stdin.write("\n");
        }
      }

      if (text.includes("Choose World:") && text.includes("d <number>")) {
        console.log("[Manager] World creation finished.");
        serverState = "MENU";
        createConfig = null;
        activeWorld = null;
      }
    }
  });

  child.stderr.on("data", (data) => {
    const text = data.toString();
    logStream.write(`[STDERR] ${text}`);
    pushToConsole(`[ERR] ${text}`);
  });

  const resetState = () => {
    terrariaProcess = null;
    activeWorld = null;
    bootConfig = null;
    createConfig = null;
    playerList = [];
    serverState = "OFFLINE";
  };

  child.on("error", (err) => {
    console.error("[Manager] Process error:", err);
    logStream.write(`[Manager] Process error: ${err.message}\n`);
    pushToConsole(`[ERR] ${err.message}`);
    resetState();
  });

  child.on("close", (code) => {
    console.log(`\n[Manager] Server shut down with code ${code}`);
    logStream.write(`\n[Manager] Server shut down with code ${code}\n`);
    logStream.end();
    resetState();
  });

  return { success: true, message: "Server booted. Waiting at main menu." };
};

export const stopServer = () => {
  if (serverState === "OFFLINE" || !terrariaProcess) {
    return { success: false, message: "Server is already offline." };
  }

  console.log("[Manager] Sending SIGINT (Ctrl+C) to process...");
  terrariaProcess.kill("SIGINT");
  return {
    success: true,
    activeWorld: null,
    message: "Termination signal sent.",
  };
};

export const selectWorld = (config) => {
  if (serverState !== "MENU") {
    return {
      success: false,
      message: `Cannot select world. State: ${serverState}`,
    };
  }

  if (!terrariaProcess) {
    return { success: false, message: "Server process is not running." };
  }

  const worldList = listWorlds();
  const requestedId = parseInt(config.worldId, 10);

  if (
    isNaN(requestedId) ||
    requestedId < 1 ||
    requestedId > worldList.worlds.length
  ) {
    return {
      success: false,
      message: `Invalid World ID. You chose ${requestedId}, but only ${worldList.worlds.length} worlds exist.`,
    };
  }

  activeWorld = worldList.worlds[requestedId - 1];

  console.log("[Manager] World selection validated. Starting boot sequence...");
  serverState = "BOOTING";
  bootConfig = config;

  terrariaProcess.stdin.write(`${requestedId}\n`);
  return { success: true, message: `Booting ${activeWorld}...` };
};

export const exitWorld = () => {
  if (serverState !== "ONLINE" || !terrariaProcess) {
    return {
      success: false,
      message: "Cannot exit. Server is not currently online.",
    };
  }

  console.log("[Manager] Sending graceful exit command...");
  terrariaProcess.stdin.write("exit\n");

  return {
    success: true,
    activeWorld: null,
    message: "Graceful shutdown initiated. Saving world...",
  };
};

export const deleteWorld = async (worldName) => {
  if (serverState !== "OFFLINE" && serverState !== "MENU") {
    return {
      success: false,
      message: "Cannot delete worlds while a game is running.",
    };
  }

  try {
    const wldPath = path.join(WORLDS_DIR, `${worldName}.wld`);
    const bakPath = path.join(WORLDS_DIR, `${worldName}.wld.bak`);

    if (!fs.existsSync(wldPath)) {
      return {
        success: false,
        message: `World '${worldName}' not found on disk.`,
      };
    }

    fs.unlinkSync(wldPath);
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
    console.log(`[Manager] Successfully deleted ${worldName} from disk.`);

    let message = `Deleted ${worldName}.`;

    if (serverState === "MENU") {
      console.log(
        "[Manager] Server is in MENU state. Triggering restart to refresh list...",
      );
      await restartServer();
      message += " Server restarted to refresh the world list.";
    }

    return { success: true, message };
  } catch (error) {
    console.error("[Manager] Delete error:", error);
    return { success: false, message: "Failed to delete world files." };
  }
};

let worldsDirMissing = false;

export const listWorlds = () => {
  try {
    const files = fs.readdirSync(WORLDS_DIR);
    worldsDirMissing = false;

    const worlds = files
      .filter((file) => file.endsWith(".wld"))
      .map((file) => file.replace(".wld", ""))
      // TerrariaServer lists worlds alphabetically; match that order so the
      // numeric index we send over stdin maps to the world the user clicked.
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return { success: true, worlds };
  } catch (error) {
    // A fresh install has no Worlds directory until the first world is
    // created; report an empty list instead of an error.
    if (error.code === "ENOENT") {
      if (!worldsDirMissing) {
        worldsDirMissing = true;
        console.warn(
          `[Manager] Worlds directory does not exist yet: ${WORLDS_DIR}. Reporting no worlds.`,
        );
      }
      return { success: true, worlds: [] };
    }
    console.error("[Manager] Error reading worlds directory:", error);
    return { success: false, worlds: [], message: "Failed to read worlds directory." };
  }
};

export const restartServer = async () => {
  if (!terrariaProcess) {
    return startServer();
  }

  console.log("[Manager] Restarting server to refresh world list...");

  stopServer();

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const checkInterval = setInterval(() => {
      if (!terrariaProcess) {
        clearInterval(checkInterval);
        console.log("[Manager] Server stopped. Re-booting now...");
        resolve(startServer());
      } else if (Date.now() - startedAt > RESTART_TIMEOUT_MS) {
        clearInterval(checkInterval);
        console.error("[Manager] Restart timed out waiting for shutdown.");
        resolve({
          success: false,
          message: "Restart timed out waiting for the server to stop.",
        });
      }
    }, 100);
  });
};

export const createWorld = (config) => {
  if (serverState !== "MENU" || !terrariaProcess) {
    return {
      success: false,
      message: "Must be at the main menu to create a world.",
    };
  }

  console.log("[Manager] Starting world creation sequence...");

  serverState = "CREATING";
  createConfig = config;

  terrariaProcess.stdin.write("n\n");

  return { success: true, message: "Creation sequence started." };
};

export const sendCommand = (command, sayCommand) => {
  if (serverState !== "ONLINE" || !terrariaProcess) {
    return {
      success: false,
      message: "Commands can only be sent when the server is ONLINE.",
    };
  }

  const cmd = sanitizeCommand(command);
  const say = sanitizeCommand(sayCommand);

  if (!cmd && !say) {
    return { success: false, message: "No valid instruction provided." };
  }

  if (cmd) {
    console.log(`[Manager] Injecting command: ${cmd}`);
    terrariaProcess.stdin.write(`${cmd}\n`);
  }

  if (say) {
    console.log(`[Manager] Broadcasting: ${say}`);
    terrariaProcess.stdin.write(`say ${say}\n`);
  }

  return { success: true, message: "Instruction(s) sent to server." };
};

export const getProcess = () => terrariaProcess;
