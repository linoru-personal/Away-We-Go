import { NextResponse } from "next/server";
import { runAgent } from "@/src/lib/agent/runAgent";
import type { AgentRequest } from "@/src/types/agent";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentRequest;
    const result = await runAgent(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Agent API error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
