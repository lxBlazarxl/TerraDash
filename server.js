import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import powerRoutes from "./routes/power.js";
import worldsRoutes from "./routes/worlds.js";
import statusRoutes from "./routes/status.js";
import commandRoutes from "./routes/commands.js";
import playerRoutes from "./routes/players.js";
import allowlistRoutes from "./routes/allowlist.js";
import { init as initAllowlist } from "./core/allowlistManager.js";
import { checkVersion } from "./core/versionChecker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

initAllowlist();
checkVersion();

const app = express();
app.use(express.json());

// Optional auth: set DASHBOARD_TOKEN in .env to require
// `Authorization: Bearer <token>` on every /api request.
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "";
if (DASHBOARD_TOKEN) {
  app.use("/api", (req, res, next) => {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token !== DASHBOARD_TOKEN) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    next();
  });
}

app.use("/api/power", powerRoutes);
app.use("/api/worlds", worldsRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/command", commandRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/allowlist", allowlistRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(__dirname, "dist")));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(join(__dirname, "dist", "index.html"));
  });
}

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Wrapper API listening on ${HOST}:${PORT}...`);
  if (!DASHBOARD_TOKEN) {
    console.warn(
      "[WARN] DASHBOARD_TOKEN is not set - the API is unauthenticated. " +
        "Keep HOST bound to localhost or set a token before exposing it.",
    );
  }
});
