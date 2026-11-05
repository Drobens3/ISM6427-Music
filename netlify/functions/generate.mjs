import { json, suno, checkAccess, siteOrigin, clamp } from "../lib/suno.mjs";

const MODELS = new Set(["V6", "V6_MINI", "V6_WILD"]);

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const denied = checkAccess(req);
  if (denied) return denied;

  let input;
  try { input = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON body." }, 400); }

  const customMode = !!input.customMode;
  const instrumental = !!input.instrumental;
  const model = MODELS.has(input.model) ? input.model : "V6";
  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const body = {
    customMode,
    instrumental,
    model,
    callBackUrl: `${siteOrigin(req)}/api/callback`,
  };

  if (!customMode) {
    // Simple mode: prompt is the core idea; lyrics are auto-written.
    const prompt = str(input.prompt, 3000);
    const style = str(input.style, 1000);
    if (!prompt && !style) return json({ ok: false, error: "Describe the song you want." }, 400);
    if (prompt) body.prompt = prompt;
    if (style) body.style = style;
  } else {
    const title = str(input.title, 80);
    const style = str(input.style, 1000);
    const lyrics = instrumental ? "" : str(input.lyrics, 5000);
    const negativeTags = str(input.negativeTags, 1000);
    if (!style && !lyrics && !negativeTags) {
      return json({ ok: false, error: "Custom mode needs at least a style, lyrics, or tags to avoid." }, 400);
    }
    if (title) body.title = title;
    if (style) body.style = style;
    if (lyrics) body.lyrics = lyrics;
    if (negativeTags) body.negativeTags = negativeTags;
    if (input.vocalGender === "m" || input.vocalGender === "f") body.vocalGender = input.vocalGender;
    if (Number.isFinite(+input.duration) && +input.duration > 0) body.duration = clamp(Math.round(+input.duration), 10, 360);
    for (const k of ["styleWeight", "weirdnessConstraint"]) {
      if (input[k] !== undefined && input[k] !== "" && Number.isFinite(+input[k])) {
        body[k] = Math.round(clamp(+input[k], 0, 1) * 100) / 100;
      }
    }
    if (Number.isFinite(+input.variety) && input.variety !== "") body.variety = clamp(Math.round(+input.variety), 0, 4);
  }

  const r = await suno("/api/v1/generate", { method: "POST", body });
  if (!r.ok) return json({ ok: false, error: r.error }, r.status >= 400 && r.status < 600 ? r.status : 502);
  return json({ ok: true, taskId: r.data?.taskId });
};

export const config = { path: "/api/generate" };
