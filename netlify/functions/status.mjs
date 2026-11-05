import { json, suno, checkAccess } from "../lib/suno.mjs";

const FAILED = new Set(["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"]);

export default async (req) => {
  const denied = checkAccess(req);
  if (denied) return denied;
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId || !/^[\w-]{1,128}$/.test(taskId)) return json({ ok: false, error: "Missing or invalid taskId." }, 400);

  const r = await suno(`/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (!r.ok) return json({ ok: false, error: r.error }, 502);

  const d = r.data || {};
  const tracks = (d.response?.sunoData || []).map((t) => ({
    id: t.id,
    title: t.title,
    tags: t.tags,
    lyrics: t.prompt,
    duration: t.duration,
    imageUrl: t.image_url || t.imageUrl || t.source_image_url,
    audioUrl: t.audio_url || t.audioUrl || t.source_audio_url,
    streamUrl: t.stream_audio_url || t.streamAudioUrl || t.source_stream_audio_url,
    createTime: t.createTime,
  }));

  return json({
    ok: true,
    status: d.status || "PENDING",
    done: d.status === "SUCCESS",
    failed: FAILED.has(d.status),
    error: d.errorMessage || null,
    tracks,
  });
};

export const config = { path: "/api/status" };
