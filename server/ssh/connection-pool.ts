import { Client } from "ssh2";
import type { ConnectConfig } from "ssh2";
import { readPrivateKey, validateKeyPath } from "./key-manager";
import { destroySftpForConnection } from "./sftp-pool";

interface PoolEntry {
  client: Client;
  config: ConnectionConfig;
  lastUsed: number;
  connected: boolean;
}

export interface ConnectionConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  passphrase?: string;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Use globalThis so the pool is shared between Next.js API routes (Turbopack) and
// the custom server's WebSocket handler, which evaluate this module separately.
const pool: Map<string, PoolEntry> =
  ((globalThis as Record<string, unknown>).__sshConnectionPool as Map<string, PoolEntry>)
  ?? ((globalThis as Record<string, unknown>).__sshConnectionPool = new Map<string, PoolEntry>());

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of pool) {
      if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        console.log(`[SSH Pool] Closing idle connection: ${id}`);
        destroySftpForConnection(id);
        entry.client.end();
        pool.delete(id);
      }
    }
    if (pool.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60_000);
}

export async function connect(config: ConnectionConfig): Promise<Client> {
  const existing = pool.get(config.id);
  if (existing?.connected) {
    existing.lastUsed = Date.now();
    return existing.client;
  }

  // Clean up stale entry
  if (existing) {
    existing.client.end();
    pool.delete(config.id);
  }

  await validateKeyPath(config.privateKeyPath);
  const privateKey = readPrivateKey(config.privateKeyPath);

  const client = new Client();
  const connectConfig: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    privateKey,
    passphrase: config.passphrase,
    readyTimeout: 10_000,
    keepaliveInterval: 30_000,
    keepaliveCountMax: 3,
    algorithms: {
      compress: ["zlib@openssh.com", "zlib", "none"],
    },
  };

  return new Promise((resolve, reject) => {
    const entry: PoolEntry = {
      client,
      config,
      lastUsed: Date.now(),
      connected: false,
    };

    client.on("ready", () => {
      console.log(`[SSH Pool] Connected: ${config.id} (${config.username}@${config.host}:${config.port})`);
      entry.connected = true;
      pool.set(config.id, entry);
      startCleanup();
      resolve(client);
    });

    client.on("error", (err) => {
      console.error(`[SSH Pool] Error on ${config.id}:`, err.message);
      entry.connected = false;
      destroySftpForConnection(config.id);
      pool.delete(config.id);
      reject(err);
    });

    client.on("end", () => {
      console.log(`[SSH Pool] Disconnected: ${config.id}`);
      entry.connected = false;
      destroySftpForConnection(config.id);
      pool.delete(config.id);
    });

    client.on("close", () => {
      entry.connected = false;
      destroySftpForConnection(config.id);
      pool.delete(config.id);
    });

    client.connect(connectConfig);
  });
}

export function disconnect(connectionId: string) {
  const entry = pool.get(connectionId);
  if (entry) {
    destroySftpForConnection(connectionId);
    entry.client.end();
    pool.delete(connectionId);
  }
}

export function isConnected(connectionId: string): boolean {
  const entry = pool.get(connectionId);
  return entry?.connected ?? false;
}

export function getConnectionStatus(connectionId: string): "connected" | "disconnected" {
  return isConnected(connectionId) ? "connected" : "disconnected";
}

export const connectionPool = {
  connect,
  disconnect,
  get: (id: string) => {
    const entry = pool.get(id);
    if (entry) entry.lastUsed = Date.now();
    return entry?.client ?? null;
  },
  isConnected,
  getStatus: getConnectionStatus,
  getAll: () => Array.from(pool.keys()),
};
