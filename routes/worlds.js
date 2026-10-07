import express from "express";
import {
  selectWorld,
  exitWorld,
  deleteWorld,
  listWorlds,
  createWorld,
} from "../core/terrariaManager.js";

const router = express.Router();

// Normalize user input and strip CR/LF so it cannot inject extra console lines.
const clean = (value, max = 200) =>
  String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);

const cleanInt = (value, fallback, min, max) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const oneOf = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? String(value) : fallback;

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
    worldId: String(cleanInt(req.body.worldId, 1, 1, 9999)),
    maxPlayers: String(cleanInt(req.body.maxPlayers, 16, 1, 255)),
    port: String(cleanInt(req.body.port, 7777, 1, 65535)),
    upnp: req.body.upnp === "y" ? "y" : "n",
    password: clean(req.body.password, 128),
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
    size: oneOf(req.body.size, ["1", "2", "3"], "1"), // 1: Small, 2: Med, 3: Large
    difficulty: oneOf(req.body.difficulty, ["1", "2", "3", "4"], "1"),
    evil: oneOf(req.body.evil, ["1", "2", "3"], "1"), // 1: Random, 2: Corrupt, 3: Crimson
    name: clean(req.body.name, 60) || "New_World",
    seed: clean(req.body.seed, 60),
    specialSeeds: Array.isArray(req.body.specialSeeds)
      ? req.body.specialSeeds
          .map((s) => parseInt(s, 10))
          .filter((s) => Number.isInteger(s) && s >= 1 && s <= 10)
      : [],
  };

  const result = createWorld(config);

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post("/delete", async (req, res) => {
  const worldName = clean(req.body.worldName, 60);

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
