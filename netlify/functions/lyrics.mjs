import { json, suno, checkAccess, siteOrigin } from "../lib/suno.mjs";

// POST /api/lyrics {prompt}  -> start lyric generation
// GET  /api/lyrics?taskId=.. -> poll result
export default async (req) => {
  const denied = checkAccess(req);
  if (denied) return denied;

  if (req.method === "POST") {
    let input;
    try { input = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON body." }, 400); }
    const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 200) : "";
    if (!prompt) return json({ ok: false, error: "Tell us what the lyrics should be about." }, 400);
    const r = await suno("/api/v1/lyrics", {
      method: "POST",
      body: { prompt, callBackUrl: `${siteOrigin(req)}/api/callback` },
    });
    if (!r.ok) return json({ ok: false, error: r.error }, 502);
    return json({ ok: true, taskId: r.data?.taskId });
  }

  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId || !/^[\w-]{1,128}$/.test(taskId)) return json({ ok: false, error: "Missing or invalid taskId." }, 400);
  const r = await suno(`/api/v1/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (!r.ok) return json({ ok: false, error: r.error }, 502);
  const d = r.data || {};
  const items = (d.response?.data || []).filter((x) => x.text).map((x) => ({ title: x.title, text: x.text }));
  return json({
    ok: true,
    status: d.status || "PENDING",
    done: d.status === "SUCCESS",
    failed: !!d.status && d.status !== "SUCCESS" && d.status !== "PENDING",
    error: d.errorMessage || null,
    items,
  });
};

export const config = { path: "/api/lyrics" };
