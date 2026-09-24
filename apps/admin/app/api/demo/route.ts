import type { DemoRequest } from "@heft/shared";
import { runDemo } from "@/lib/demo-store";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new Response(null, { headers });
}

export async function POST(request: Request) {
  const body = (await request.json()) as DemoRequest;
  const result = runDemo(body);
  return Response.json(result, { headers });
}
