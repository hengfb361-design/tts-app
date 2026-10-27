// Render / Node entry point.
// Reuses the Cloudflare Worker handler from worker.js so the API behaves the
// same everywhere; only static assets and process.env bindings differ.
//
//   npm start   ->  node server.js   (listens on $PORT, Render injects it)

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./worker.js";

const PORT = Number(process.env.PORT) || 8787;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
};

// Optional server-side CAMB.AI key. The browser may also send its own key per
// request, exactly like on Cloudflare.
const ENV_KEYS = ["CAMB_API_KEY", "CAMB_AI_API_KEY"];

const env = { ASSETS: { fetch: serveAssets } };
for (const key of ENV_KEYS) {
  if (process.env[key]) env[key] = process.env[key];
}

async function serveAssets(request) {
  const url = new URL(request.url);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/favicon.ico") pathname = "/index.svg";

  const target = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(target);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-cache",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
  "upgrade",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-authenticate",
]);

const server = http.createServer(async (req, res) => {
  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase()) && typeof value === "string") headers[key] = value;
    }

    const method = (req.method || "GET").toUpperCase();
    const url = `http://${req.headers.host || `localhost:${PORT}`}${req.url || "/"}`;

    let body;
    if (method !== "GET" && method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
      if (body.length === 0) body = undefined;
    }

    const request = new Request(url, { method, headers, body });

    const response = await worker.fetch(request, env);
    const outHeaders = Object.fromEntries(response.headers.entries());

    if (!outHeaders["x-content-type-options"]) {
      outHeaders["x-content-type-options"] = "nosniff";
    }

    res.writeHead(response.status, outHeaders);
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("request failed", error?.stack || error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ error: "server", message: "Server error. Try again." }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`khmer-voice-studio listening on http://0.0.0.0:${PORT}`);
});
