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

4. **Run the Application**:
   ```bash
   # Start the development server
   npm run dev
   ```

## 3. Technical Details

### Architecture
- **Backend**: Node.js/Express server that spawns the Terraria server as a child process. It pipes `stdin` and `stdout` to provide real-time console interaction.
- **Frontend**: Vite + React SPA styled with a Terraria-inspired aesthetic.
- **State Management**: 
    - `core/terrariaManager.js`: Handles the lifecycle of the server process.
    - `core/allowlistManager.js`: Persists player permissions in `allowlist.json`.

### Key Components
- **Process Wrapper**: Uses Node's `child_process` to spawn the server.
- **Real-time Console**: Routes terminal output to the web dashboard.
- **Modular Routes**: Separate logic for power control, status monitoring, and player management.
