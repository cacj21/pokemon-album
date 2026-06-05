import type { Env } from "./types";
import { handleScan, handleList, handleGetById } from "./routes/cards";
import { handleHealth } from "./routes/health";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      let response: Response;

      if (pathname === "/health" && method === "GET") {
        response = handleHealth();
      } else if (pathname === "/cards" && method === "POST") {
        response = await handleScan(request, env);
      } else if (pathname === "/cards" && method === "GET") {
        response = await handleList(env);
      } else if (/^\/cards\/[^/]+$/.test(pathname) && method === "GET") {
        const id = pathname.split("/")[2];
        response = await handleGetById(id, env);
      } else {
        response = Response.json({ error: "Not found" }, { status: 404 });
      }

      return withCors(response);
    } catch (err) {
      console.error("Unhandled error:", err);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }
  },
} satisfies ExportedHandler<Env>;
