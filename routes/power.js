import express from "express";
import {
  startServer,
  stopServer,
  restartServer,
} from "../core/terrariaManager.js";

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

export default router;
