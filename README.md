# SSH File Manager

A self-hosted, web-based file manager for remote servers over SSH/SFTP. Think "VS Code's file explorer + terminal" accessible from any browser — browse files, edit code, run commands, and transfer files on your remote VMs without leaving the browser.

## Features

- **File Explorer** — Browse remote directories in grid or list view, with sorting, breadcrumb navigation, and hidden file toggles
- **Code Editor** — Monaco editor (same engine as VS Code) with multi-tab editing, syntax highlighting, and Ctrl+S save to remote
- **Web Terminal** — Full SSH shell via xterm.js, with auto-resize, clickable links, and multiple sessions per connection
- **File Transfer** — Drag-and-drop upload (up to 1GB) with progress tracking, streaming downloads
- **Search** — Filename search (via `find`) and content search (via `grep`) across remote filesystems
- **Bookmarks** — Save favorite paths per connection for quick navigation
- **Multi-Connection Tabs** — Connect to multiple VMs simultaneously, each with independent state
- **File Previews** — Inline preview for images, PDF, markdown, video, audio, and syntax-highlighted text
- **System Vitals** — On-demand RAM, disk, CPU load, and uptime stats in the status bar — click to expand full details with per-partition disk usage
- **SSH Config Import** — One-click import from `~/.ssh/config` with key validation and duplicate detection
- **Reverse Proxy Support** — Deploy behind nginx/Traefik at any subpath via `BASE_PATH` env var
- **Dark/Light Theme** — Toggle between themes with one click
- **Keyboard Shortcuts** — `Cmd+K` for search, `` Cmd+` `` for terminal

## Architecture & Performance

The codebase has been architected for zero memory leaks, minimal resource waste, and smooth performance under load:

- **SFTP Session Pooling** — A single SFTP channel is reused across all file operations per connection (with ref counting and deduplication), instead of creating/destroying one per request
- **Streaming Uploads** — Files up to 1GB are streamed directly from the browser to the remote server via `@fastify/busboy`, piped through SFTP in 64KB chunks with backpressure handling — never buffered in server memory. Failed uploads automatically clean up partial files on the remote
- **SFTP Acquisition Timeout** — 10-second timeout on SFTP channel handshake prevents hanging connections (data operations run uninterrupted)
- **Virtual Scrolling** — File explorer uses `@tanstack/react-virtual` for both grid and list views, rendering only visible rows even in directories with thousands of files
- **Editor Memory Optimization** — File contents are managed by Monaco models and a lightweight module-level cache, kept out of Zustand to avoid serialization overhead
- **Immer-powered State** — Explorer store uses Zustand + Immer with `enableMapSet()` for structural sharing, eliminating full Map clones on every navigation
- **Cross-store Cleanup** — Disconnecting a connection cleans all 5 stores (connections, explorer, editor, terminal, uploads) via a centralized utility
- **Debounced Terminal Resize** — ResizeObserver throttled at 100ms to prevent resize message floods
- **Transfer Leak Prevention** — Active transfer state is TTL-gated (30 min) and cleaned on WebSocket disconnect
- **Upload GC** — File blob references are nulled after upload completion so the browser can garbage-collect them
- **Bounded History** — Navigation history capped at 200 entries to prevent unbounded growth
- **Safe Shell Commands** — Search paths are properly quoted to prevent issues with spaces/special characters
- **Stable Session IDs** — Terminal sessions use `crypto.randomUUID()` for collision-free identifiers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router + Turbopack) |
| **Frontend** | React 19, TypeScript 5, Tailwind CSS 4 |
| **UI Components** | shadcn/ui (Radix primitives), Lucide icons |
| **Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Terminal** | xterm.js v6 with fit, web-links, and search addons |
| **State Management** | Zustand + Immer (client state), TanStack React Query (server state) |
| **Virtual Scrolling** | `@tanstack/react-virtual` |
| **SSH/SFTP** | `ssh2` (pure JS, no native dependencies) |
| **WebSocket** | `ws` for terminal I/O and transfer progress |
| **Database** | SQLite via `better-sqlite3` + Drizzle ORM |
| **Validation** | Zod schemas on all API endpoints |
| **Drag & Drop** | `@dnd-kit` (in-browser), `react-dropzone` (OS uploads) |
| **Upload Streaming** | `@fastify/busboy` (multipart parsing without buffering) |

## How It Works

```
Browser ──HTTP──> Custom Node.js Server ──> Next.js (pages + API routes)
       ──WS───> WebSocket Server ──────> SSH shell channels (terminal)
                                  ──────> SFTP operations (file transfer)
```

The custom server (`server/index.ts`) wraps Next.js to add WebSocket support — something Next.js doesn't natively provide. All file operations go through REST API routes that call SFTP operations on the server. Terminal sessions run over WebSocket, streaming shell I/O in real time.

SSH connections are pooled server-side with a 30-minute idle timeout. SSH keys never leave the server; only the filesystem path is stored in the database.

### Project Structure

```
server/
├── index.ts                 # HTTP + WebSocket server entry point
├── ws/                      # WebSocket handlers (terminal, transfer progress)
└── ssh/
    ├── connection-pool.ts   # SSH connection pool with idle timeout
    ├── sftp-pool.ts         # SFTP session pool with ref counting & dedup
    ├── sftp-operations.ts   # All SFTP file operations (list, read, write, etc.)
    ├── exec.ts              # Generic SSH command executor
    ├── vitals.ts            # System stats parser (RAM, disk, CPU, uptime)
    ├── key-manager.ts       # SSH key validation & loading
    └── config-parser.ts     # ~/.ssh/config parser for bulk import

src/
├── app/                     # Next.js pages + 25 API routes
│   └── api/                 # REST: /connections, /fs/[connId]/*, /bookmarks
├── components/              # UI: explorer, editor, terminal, search, upload
├── stores/                  # Zustand + Immer: connection, explorer, editor, terminal, upload, ui
└── lib/
    ├── disconnect.ts        # Centralized cross-store cleanup on disconnect
    ├── editor-content.ts    # Editor content cache (outside Zustand)
    ├── api-client.ts        # REST + WS client
    ├── db/                  # Drizzle ORM schema & migrations
    └── ...                  # Validators, constants, utils

db/                          # SQLite database file (auto-created)
```

## Prerequisites

- **Node.js** 18+ (tested with v20 and v24)
- **npm** 9+
- **SSH key** configured for the remote server(s) you want to manage

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url> file-manager
cd file-manager
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with secure values:

```env
AUTH_TOKEN=your-secret-token-here
ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

You can generate these with:

```bash
# Generate AUTH_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 3. Initialize the database

```bash
npm run db:push
```

### 4. Start the server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the `AUTH_TOKEN` you set.

### 5. Add connections

**Option A: Import from SSH config** — Click the download icon in the sidebar's Connections header. The dialog reads your `~/.ssh/config`, validates key paths, and lets you select which hosts to import.

**Option B: Add manually** — Click the **+** button in the sidebar and fill in:

| Field | Description |
|-------|-------------|
| **Name** | A label for this connection (e.g., "Production Server") |
| **Host** | IP address or hostname |
| **Port** | SSH port (default: 22) |
| **Username** | SSH user (e.g., `root`) |
| **Private Key Path** | Absolute path to your SSH private key on *this* machine (e.g., `~/.ssh/id_ed25519`) |
| **Passphrase** | Leave blank if your key is not encrypted |
| **Default Path** | Starting directory on connect (default: `/`) |

> **Encrypted key?** If you get "Encrypted private OpenSSH key detected, but no passphrase given", your key is passphrase-protected. Either enter the passphrase in the form, or remove it:
> ```bash
> ssh-keygen -p -f ~/.ssh/your_key
> # Enter old passphrase, then press Enter twice for no new passphrase
> ```

## Production

```bash
npm run build
npm start
```

The server runs on port 3000 by default. Override with environment variables:

```bash
PORT=8080 HOSTNAME=0.0.0.0 npm start
```

### Reverse Proxy (Subpath)

To serve the app at a subpath (e.g., `https://internal.company.com/files`):

```bash
BASE_PATH=/files npm run build
BASE_PATH=/files npm start
```

Nginx example:

```nginx
location /files/ {
    proxy_pass http://localhost:3000/files/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

All routes, API calls, and WebSocket connections automatically respect the base path.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_TOKEN` | Yes | Token for web UI authentication |
| `ENCRYPTION_KEY` | Yes | AES-256 key for passphrase encryption at rest |
| `PORT` | No | Server port (default: `3000`) |
| `HOSTNAME` | No | Bind address (default: `localhost`) |
| `BASE_PATH` | No | Subpath for reverse proxy deployment (e.g., `/files`) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run db:push` | Create/update database tables |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run lint` | Run ESLint |

## Security

- **SSH keys stay on the server** — the browser never sees key material
- **Passphrase encryption** — AES-256-GCM at rest using `ENCRYPTION_KEY`
- **Path traversal protection** — all paths resolved with `path.posix.resolve()` and validated server-side
- **Input validation** — Zod schemas on every API endpoint
- **Auth** — token-based with HTTP-only SameSite=Strict cookie
- **Connection isolation** — each SSH connection is a separate `ssh2.Client` instance

## License

MIT
