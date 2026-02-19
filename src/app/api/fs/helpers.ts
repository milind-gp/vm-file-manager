import { NextResponse } from "next/server";
import { connectionPool } from "../../../../server/ssh/connection-pool";
import type { Client } from "ssh2";

export function getClient(connectionId: string): { client: Client; connectionId: string } | { error: NextResponse } {
  const client = connectionPool.get(connectionId);
  if (!client) {
    return { error: NextResponse.json({ error: "Connection not active. Please connect first." }, { status: 400 }) };
  }
  return { client, connectionId };
}
