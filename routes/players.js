import express from "express";
import { getPlayerStats, serverState } from "../core/terrariaManager.js";

const router = express.Router();

router.get("/", (req, res) => {
  if (serverState !== "ONLINE") {
    return res.json({
      success: true,
      count: 0,
      players: [],
      message: "Server is not currently online.",
    });
  }

  const stats = getPlayerStats();
  res.json(stats);
});

export default router;
