import express from "express";
import {
  selectWorld,
  exitWorld,
  deleteWorld,
  listWorlds,
  createWorld,
} from "../core/terrariaManager.js";

const router = express.Router();

router.get("/", (req, res) => {
  const result = listWorlds();

  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

router.post("/select", (req, res) => {
  const config = {
    worldId: req.body.worldId || "1",
    maxPlayers: req.body.maxPlayers || "16",
    port: req.body.port || "7777",
    upnp: req.body.upnp || "n",
    password: req.body.password || "",
  };

  const result = selectWorld(config);

  if (result.success) {
    res.json({ ...result, configUsed: config });
  } else {
    res.status(400).json(result);
  }
});

router.post("/exit", (req, res) => {
  const result = exitWorld();

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post("/create", (req, res) => {
  const config = {
    size: req.body.size || "1", // 1: Small, 2: Med, 3: Large
    difficulty: req.body.difficulty || "1",
    evil: req.body.evil || "1", // 1: Random, 2: Corrupt, 3: Crimson
    name: req.body.name || "New_World",
    seed: req.body.seed || "",
    specialSeeds: req.body.specialSeeds || [],
  };

  const result = createWorld(config);

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post("/delete", async (req, res) => {
  const worldName = req.body.worldName;

  if (!worldName) {
    return res
      .status(400)
      .json({ success: false, message: "Missing worldName parameter." });
  }

  const result = await deleteWorld(worldName);

  if (result.success) {
    res.json(result);
  } else {
    res.status(403).json(result);
  }
});

export default router;
