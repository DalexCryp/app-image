import { MAX_FILE_BYTES } from "@/lib/upload-limits";

// Server-side proxy to the n8n webhook so its URL and secret never reach the browser.
export const runtime = "nodejs";
export const maxDuration = 300;

const UPSTREAM_TIMEOUT_MS = 290_000;
const MAX_RESULT_BYTES = 20 * 1024 * 1024;

// Best-effort per-IP rate limit. It is per server instance, so pair it with a
// Vercel Firewall rate-limit rule for real protection.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return false;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// Identify the real format from magic bytes instead of trusting the client-supplied type.
function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("N8N_WEBHOOK_URL is not set");
    return jsonError("The server is not configured.", 500);
  }

  if (!isSameOrigin(request)) {
    return jsonError("Forbidden.", 403);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return jsonError("Too many requests. Please wait a few minutes and try again.", 429);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_BYTES * 2 + 64 * 1024) {
    return jsonError("Images are too large.", 413);
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return jsonError("Invalid upload.", 400);
  }

  const outgoing = new FormData();
  for (const key of ["image1", "image2"] as const) {
    const file = incoming.get(key);
    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Both images are required.", 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return jsonError("Images are too large.", 413);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) {
      return jsonError("Only PNG, JPEG and WebP images are allowed.", 415);
    }
    // Re-create the file with a safe name and the verified type.
    outgoing.append(key, new Blob([bytes], { type }), `${key}.${EXTENSIONS[type]}`);
  }

  const headers: HeadersInit = {};
  if (process.env.N8N_WEBHOOK_SECRET) {
    headers["X-Webhook-Secret"] = process.env.N8N_WEBHOOK_SECRET;
  }

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      body: outgoing,
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    console.error("n8n request failed", err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return jsonError(timedOut ? "Generation timed out. Please try again." : "Could not reach the generator.", 502);
  }

  if (!upstream.ok) {
    console.error("n8n responded with status", upstream.status);
    return jsonError("The generator failed to process these images. Please try again.", 502);
  }

  const result = new Uint8Array(await upstream.arrayBuffer());
  if (result.length === 0 || result.length > MAX_RESULT_BYTES) {
    return jsonError("The generator returned an invalid result.", 502);
  }
  const resultType = sniffImageType(result);
  if (!resultType) {
    console.error("n8n returned a non-image response", upstream.headers.get("content-type"));
    return jsonError("The generator did not return an image.", 502);
  }

  return new Response(result, {
    headers: {
      "Content-Type": resultType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
