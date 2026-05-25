import express from "express";
import {
  serverState,
  activeWorld,
  getConsoleLogs,
} from "../core/terrariaManager.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    world: activeWorld,
    state: serverState,
  });
});

router.get("/logs", (req, res) => {
  res.json({
    success: true,
    logs: getConsoleLogs(),
  });
});

export default router;
