import { NextResponse } from "next/server";
import { getClient } from "../../helpers";
import { getSystemVitals } from "../../../../../../server/ssh/vitals";

export async function GET(_request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const { connectionId } = await params;
    const result = getClient(connectionId);
    if ("error" in result) return result.error;

    const vitals = await getSystemVitals(result.client);
    return NextResponse.json(vitals);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
