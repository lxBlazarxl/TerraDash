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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

initAllowlist();

const app = express();
app.use(express.json());

app.use("/api/power", powerRoutes);
app.use("/api/worlds", worldsRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/command", commandRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/allowlist", allowlistRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(join(__dirname, "dist", "index.html"));
  });
}

const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wrapper API listening on port ${PORT}...`);
});
