import { DEMO_CORS_HEADERS, demoErrorResult, type DemoRequest } from "@heft/shared";
import { runDemo } from "@/lib/demo-store";

const headers = DEMO_CORS_HEADERS;

export function OPTIONS() {
  return new Response(null, { headers });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DemoRequest;
    const result = runDemo(body);
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json(demoErrorResult(error), { status: 500, headers });
  }
}
