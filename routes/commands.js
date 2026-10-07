import express from "express";
import { sendCommand } from "../core/terrariaManager.js";

const router = express.Router();

router.post("/", (req, res) => {
  const { command, sayCommand } = req.body;

  const hasCommand = typeof command === "string" && command.trim();
  const hasSay = typeof sayCommand === "string" && sayCommand.trim();

  if (!hasCommand && !hasSay) {
    return res.status(400).json({
      success: false,
      message: "No instruction provided. Send 'command' or 'sayCommand'.",
    });
  }

  const result = sendCommand(command, sayCommand);

  if (result.success) {
    res.json(result);
  } else {
    res.status(403).json(result);
  }
});

export default router;
