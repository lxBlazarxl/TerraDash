import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createInterface } from "readline";
import { checkPermission } from "./allowlistManager.js";

let terrariaProcess = null;
let bootConfig = null;

export let serverState = "OFFLINE";
export let activeWorld = null;
export let playerList = [];
export let consoleLogs = [];

const MAX_LOGS = 1000;

const TERRARIA_DIR = process.env.TERRARIA_DIR; 
const TERRARIA_EXE = process.env.TERRARIA_EXE; 
const WORLDS_DIR = path.join(TERRARIA_DIR, "Worlds");

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

export const getPlayerStats = () => {
  return {
    success: true,
    count: playerList.length,
    players: playerList,
  };
};

export const startServer = () => {
  if (terrariaProcess) {
    return { success: false, message: "Server is already running." };
  }

  console.log("[Manager] Booting Terraria Server...");
  serverState = "MENU";

  const logStream = fs.createWriteStream("server.log", { flags: "a" });

  const exePath = path.join(TERRARIA_DIR, TERRARIA_EXE);
  terrariaProcess = spawn(exePath, []);

  terrariaProcess.stdout.on("data", (data) => {
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
          const command = chatMatch[2];
          if (checkPermission(playerName, command)) {
            console.log(`[Manager] ${playerName} ran /${command} via allowlist.`);
            terrariaProcess.stdin.write(`${command}\n`);
            terrariaProcess.stdin.write(`say ${playerName} ran ${command}\n`);
          } else {
            console.log(`[Manager] ${playerName} denied /${command} — not on allowlist.`);
            terrariaProcess.stdin.write(`say You don't have permission to run that.\n`);
          }
        }
      }
    }

    if (bootConfig) {
      if (text.includes("Max players")) {
        terrariaProcess.stdin.write(`${bootConfig.maxPlayers}\n`);
      } else if (text.includes("Server port")) {
        terrariaProcess.stdin.write(`${bootConfig.port}\n`);
      } else if (text.includes("Automatically forward port")) {
        terrariaProcess.stdin.write(`${bootConfig.upnp}\n`);
      } else if (text.includes("Server password")) {
        terrariaProcess.stdin.write(`${bootConfig.password}\n`);
      } else if (text.includes("Listening on port")) {
        console.log(
          `[Manager] Server fully online on port ${bootConfig.port}.`,
        );
        serverState = "ONLINE";
        bootConfig = null;
      }
    }

    if (serverState === "CREATING" && createConfig) {
      const reply = (val) => terrariaProcess.stdin.write(`${val}\n`);

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
          terrariaProcess.stdin.write("\n");
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

  terrariaProcess.stderr.on("data", (data) => {
    const text = data.toString();
    logStream.write(`[STDERR] ${text}`);
    pushToConsole(`[ERR] ${text}`);
  });

  terrariaProcess.on("close", (code) => {
    console.log(`\n[Manager] Server shut down with code ${code}`);
    logStream.write(`\n[Manager] Server shut down with code ${code}\n`);
    logStream.end();

    terrariaProcess = null;
    activeWorld = null;
    bootConfig = null;
    createConfig = null;
    playerList = [];
    serverState = "OFFLINE";
  });

  return { success: true, message: "Server booted. Waiting at main menu." };
};

export const stopServer = () => {
  if (serverState === "OFFLINE") {
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

  const worldList = listWorlds();
  const requestedId = parseInt(config.worldId);

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

  terrariaProcess.stdin.write(`${config.worldId}\n`);
  return { success: true, message: `Booting ${activeWorld}...` };
};

export const exitWorld = () => {
  if (serverState !== "ONLINE") {
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

    return { success: true, message: message };
  } catch (error) {
    console.error("[Manager] Delete error:", error);
    return { success: false, message: "Failed to delete world files." };
  }
};

export const listWorlds = () => {
  try {
    const files = fs.readdirSync(WORLDS_DIR);

    const worlds = files
      .filter((file) => file.endsWith(".wld"))
      .map((file) => file.replace(".wld", ""));

    return { success: true, worlds: worlds };
  } catch (error) {
    console.error("[Manager] Error reading worlds directory:", error);
    return { success: false, message: "Failed to read worlds directory." };
  }
};

export const restartServer = async () => {
  if (!terrariaProcess) {
    return startServer();
  }

  console.log("[Manager] Restarting server to refresh world list...");

  stopServer();

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (!terrariaProcess) {
        clearInterval(checkInterval);
        console.log("[Manager] Server stopped. Re-booting now...");
        const result = startServer();
        resolve(result);
      }
    }, 100);
  });
};

let createConfig = null;

export const createWorld = (config) => {
  if (serverState !== "MENU") {
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

  if (command) {
    console.log(`[Manager] Injecting command: ${command}`);
    terrariaProcess.stdin.write(`${command}\n`);
  }

  if (sayCommand) {
    console.log(`[Manager] Broadcasting: ${sayCommand}`);
    terrariaProcess.stdin.write(`say ${sayCommand}\n`);
  }

  return {
    success: true,
    message: "Instruction(s) sent to server.",
  };
};

export const getProcess = () => terrariaProcess;
