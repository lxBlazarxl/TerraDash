import express from "express";
import {
  getAllowlist,
  addPlayer,
  removePlayer,
  grantCommand,
  revokeCommand,
} from "../core/allowlistManager.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ success: true, allowlist: getAllowlist() });
});

router.post("/:player", (req, res) => {
  const { player } = req.params;
  addPlayer(player);
  res.json({
    success: true,
    message: `Player '${player}' added to allowlist.`,
  });
});

router.delete("/:player", (req, res) => {
  const { player } = req.params;
  removePlayer(player);
  res.json({
    success: true,
    message: `Player '${player}' removed from allowlist.`,
  });
});

router.post("/:player/commands/:command", (req, res) => {
  const { player, command } = req.params;
  try {
    grantCommand(player, command);
    res.json({
      success: true,
      message: `Granted '${command}' to '${player}'.`,
    });
  } catch {
    res
      .status(404)
      .json({ success: false, message: `Player '${player}' not found.` });
  }
});

router.delete("/:player/commands/:command", (req, res) => {
  const { player, command } = req.params;
  try {
    revokeCommand(player, command);
    res.json({
      success: true,
      message: `Revoked '${command}' from '${player}'.`,
    });
  } catch {
    res
      .status(404)
      .json({ success: false, message: `Player '${player}' not found.` });
  }
});

export default router;
