// Shared helpers for talking to SunoAPI.org. The API key never leaves the server.
export const SUNO_BASE = "https://api.sunoapi.org";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Optional shared-secret gate so random visitors can't burn your credits.
export function checkAccess(req) {
  const required = process.env.ACCESS_CODE;
  if (!required) return null;
  if (req.headers.get("x-access-code") === required) return null;
  return json({ ok: false, error: "Access code required or incorrect.", code: "ACCESS" }, 401);
}

export function siteOrigin(req) {
  return process.env.URL || new URL(req.url).origin;
}

const FRIENDLY = {
  400: "Invalid parameters.",
  401: "The server's Suno API key is missing or invalid.",
  404: "Invalid request method or path.",
  405: "Rate limit exceeded — try again shortly.",
  413: "Prompt or style is too long.",
  429: "Out of Suno credits.",
  430: "Too many requests — please slow down.",
  455: "Suno API is under maintenance.",
  500: "Suno API server error.",
};

export async function suno(path, { method = "GET", body } = {}) {
  const key = process.env.SUNO_API_KEY;
  if (!key) return { ok: false, status: 500, error: "SUNO_API_KEY is not configured on the server." };
  let res;
  try {
    res = await fetch(SUNO_BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { ok: false, status: 502, error: "Could not reach Suno API." };
  }
  let payload;
  try { payload = await res.json(); } catch { payload = null; }
  const code = payload?.code ?? res.status;
  if (!res.ok || code !== 200) {
    return { ok: false, status: code, error: payload?.msg || FRIENDLY[code] || `Suno API error (${code}).` };
  }
  return { ok: true, data: payload.data };
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
