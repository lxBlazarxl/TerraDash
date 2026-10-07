import express from "express";
import {
  startServer,
  stopServer,
  restartServer,
  serverState,
} from "../core/terrariaManager.js";
import { updateServer, isUpdating } from "../core/serverUpdater.js";
import { checkVersion } from "../core/versionChecker.js";

const router = express.Router();

router.post("/on", (req, res) => {
  const result = startServer();
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post("/off", (req, res) => {
  const result = stopServer();
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post("/restart", async (req, res) => {
  const result = await restartServer();
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

router.post("/update", async (req, res) => {
  if (isUpdating()) {
    return res
      .status(409)
      .json({ success: false, message: "An update is already in progress." });
  }

  const wasRunning = serverState !== "OFFLINE";

  try {
    const result = await updateServer();

    if (!result.success) {
      return res.status(500).json(result);
    }

    if (result.updated) {
      await checkVersion();

      if (wasRunning) {
        const restart = await restartServer();
        return res.json({
          ...result,
          restarted: restart.success,
          message: `${result.message} Server restarted.`,
        });
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
