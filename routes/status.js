import express from "express";
import {
  serverState,
  activeWorld,
  getConsoleLogs,
} from "../core/terrariaManager.js";
import { getVersionStatus } from "../core/versionChecker.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    world: activeWorld,
    state: serverState,
    serverVersion: getVersionStatus(),
  });
});

router.get("/logs", (req, res) => {
  res.json({
    success: true,
    logs: getConsoleLogs(),
  });
});

export default router;
