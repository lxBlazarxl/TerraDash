# TerraDash 

A web-based management interface for Terraria servers, providing remote console access, player management, and world configuration.

## 1. Overview
This project acts as a wrapper around the standalone Terraria server executable. It provides a modern React-based dashboard to:
- Monitor server status and player counts.
- Send commands directly to the server console.
- Manage an allowlist for secure access.
- Start/Stop the server remotely.

## 2. Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- A Terraria Server installation (Vanilla or TShock).

### Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/terraria-server-wrapper.git
   cd terraria-server-wrapper
   ```

2. **Install dependencies**:
   ```bash
   # Install backend dependencies
   npm install

   # Install frontend dependencies
   cd client && npm install && cd ..
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and update the paths:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `TERRARIA_DIR` to your server folder and `TERRARIA_EXE` to your executable name.

   Alternatively, skip this step and let the bundled updater fetch the latest official Terraria dedicated server into the project's `terraria/` folder and configure `.env` for you.

4. **Run the Application**:
   ```bash
   # Start the development server
   npm run dev
   ```

## 3. Fetching / Updating the Terraria Server

The repository ships with an updater script that queries terraria.org for the latest dedicated server version, downloads it, and installs it into `terraria/` inside the project:

```bash
npm run server:update
```

- Re-running the script only downloads when a newer version is available (`--force` re-downloads regardless).
- `terraria/` is gitignored, and `.env` is updated to point at the new install.

The dashboard does the same check automatically: on boot it compares the installed version against the latest release and logs the result, `GET /api/status` exposes it as `serverVersion`, and the **Server Status** page shows an **Update Server** button whenever an update is available. Clicking it runs the identical updater in-process and, if a server is currently running (any state other than `OFFLINE`), gracefully restarts it afterwards so the new binary takes effect.

```bash
# From the dashboard UI, or directly:
curl -X POST http://localhost:5000/api/power/update
```

Concurrent updates are rejected with `409`, and updater failures with `500`.

## 4. Technical Details

### Architecture
- **Backend**: Node.js/Express server that spawns the Terraria server as a child process. It pipes `stdin` and `stdout` to provide real-time console interaction.
- **Frontend**: Vite + React SPA styled with a Terraria-inspired aesthetic.
- **State Management**: 
    - `core/terrariaManager.js`: Handles the lifecycle of the server process.
    - `core/allowlistManager.js`: Persists player permissions in `allowlist.json`.
    - `core/versionChecker.js`: Compares the installed server version against the latest release.
    - `core/serverUpdater.js`: Downloads/extracts/installs releases; shared by the CLI script and the API.

### Key Components
- **Process Wrapper**: Uses Node's `child_process` to spawn the server.
- **Real-time Console**: Routes terminal output to the web dashboard.
- **Modular Routes**: Separate logic for power control, status monitoring, and player management.
- **Version Check + In-App Updater**: Boot-time comparison against terraria.org with a dashboard button that installs and restarts.
