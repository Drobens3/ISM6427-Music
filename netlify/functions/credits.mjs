import { json, suno, checkAccess } from "../lib/suno.mjs";

export default async (req) => {
  const denied = checkAccess(req);
  if (denied) return denied;
  const r = await suno("/api/v1/generate/credit");
  if (!r.ok) return json({ ok: false, error: r.error }, 502);
  return json({ ok: true, credits: r.data });
};

export const config = { path: "/api/credits" };
