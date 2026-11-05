// Waveform Studio — frontend. All Suno API calls go through /api/* Netlify Functions,
// so the API key is never exposed to the browser.

const $ = (id) => document.getElementById(id);
const STORE_KEY = "waveform.jobs.v1";
const CODE_KEY = "waveform.accessCode";
const POLL_MS = 5000;
const MAX_POLL_MS = 15 * 60 * 1000;

const IDEAS = [
  "Lo-fi hip hop beat for late-night studying, rain sounds",
  "Epic orchestral trailer music with soaring choir",
  "Feel-good country song about a small-town Friday night",
  "Dark synthwave track for a midnight highway drive",
  "Acoustic love ballad with gentle guitar and warm vocals",
  "High-energy EDM festival anthem with a huge drop",
];
const STYLES = ["pop", "hip hop", "lo-fi", "rock", "r&b", "jazz", "edm", "country", "synthwave", "orchestral", "afrobeats", "indie folk"];
const VARIETY = ["Off", "Normal", "High", "Extra", "Max"];

let mode = "simple";
let jobs = loadJobs();
const pollers = new Map();
let currentTrackId = null;

/* ---------------- storage ---------------- */
function loadJobs() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function saveJobs() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(jobs.slice(0, 50))); } catch {}
}
function getCode() {
  try { return localStorage.getItem(CODE_KEY) || ""; } catch { return ""; }
}
function setCode(v) {
  try { localStorage.setItem(CODE_KEY, v); } catch {}
}

/* ---------------- api ---------------- */
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  const code = getCode();
  if (code) headers["x-access-code"] = code;
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  let data;
  try { data = await res.json(); } catch { data = { ok: false, error: `Server error (${res.status})` }; }
  if (data.code === "ACCESS") {
    $("accessBtn").hidden = false;
    const entered = prompt("This studio is protected. Enter the access code:");
    if (entered) { setCode(entered.trim()); return api(path, opts); }
  }
  if (!data.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function refreshCredits() {
  try {
    const { credits } = await api("/api/credits");
    $("credits").textContent = `${Number(credits).toLocaleString()} credits`;
  } catch {
    $("credits").textContent = "— credits";
  }
}

/* ---------------- UI helpers ---------------- */
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 3200);
}
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
}
function fmtTime(s) {
  if (!s) return "";
  s = Math.round(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
const STATUS_TEXT = {
  PENDING: "Queued…",
  TEXT_SUCCESS: "Writing music…",
  FIRST_SUCCESS: "First take ready, finishing…",
  SUCCESS: "Done",
};

/* ---------------- mode tabs ---------------- */
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    mode = tab.dataset.mode;
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab);
    });
    document.querySelectorAll(".simple-only").forEach((n) => (n.hidden = mode !== "simple"));
    document.querySelectorAll(".custom-only").forEach((n) => (n.hidden = mode !== "custom"));
  })
);

/* chips */
IDEAS.forEach((idea) =>
  $("ideaChips").append(el("button", { type: "button", class: "chip", onclick: () => ($("prompt").value = idea) }, idea.split(" ").slice(0, 3).join(" ") + "…"))
);
STYLES.forEach((s) =>
  $("styleChips").append(
    el("button", {
      type: "button", class: "chip",
      onclick: () => {
        const cur = $("style").value.trim();
        $("style").value = cur ? `${cur}, ${s}` : s;
      },
    }, `+ ${s}`)
  )
);

/* sliders + counters */
const bindOut = (id, outId, fmt) => {
  const update = () => ($(outId).textContent = fmt($(id).value));
  $(id).addEventListener("input", update);
  update();
};
bindOut("styleWeight", "styleWeightOut", (v) => Number(v).toFixed(2));
bindOut("weirdness", "weirdnessOut", (v) => Number(v).toFixed(2));
bindOut("variety", "varietyOut", (v) => VARIETY[v]);
$("lyrics").addEventListener("input", () => ($("lyricsCount").textContent = $("lyrics").value.length));
$("instrumental").addEventListener("change", () => {
  const inst = $("instrumental").checked;
  $("lyrics").disabled = inst;
  $("aiLyricsBtn").disabled = inst;
  $("vocalGender").disabled = inst;
});
$("accessBtn").addEventListener("click", () => {
  const v = prompt("Access code:", getCode());
  if (v !== null) { setCode(v.trim()); refreshCredits(); }
});

/* ---------------- generate ---------------- */
$("genForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("formError");
  err.hidden = true;

  const instrumental = $("instrumental").checked;
  const payload = { customMode: mode === "custom", instrumental, model: $("model").value };
  let label;

  if (mode === "simple") {
    payload.prompt = $("prompt").value.trim();
    if (!payload.prompt) return showErr("Describe the song you want first.");
    label = payload.prompt;
  } else {
    Object.assign(payload, {
      title: $("title").value.trim(),
      style: $("style").value.trim(),
      lyrics: instrumental ? "" : $("lyrics").value.trim(),
      negativeTags: $("negativeTags").value.trim(),
      vocalGender: instrumental ? "" : $("vocalGender").value,
      duration: $("duration").value,
      styleWeight: $("styleWeight").value,
      weirdnessConstraint: $("weirdness").value,
      variety: $("variety").value,
    });
    if (!payload.style && !payload.lyrics && !payload.negativeTags) return showErr("Add a style or some lyrics.");
    if (!instrumental && !payload.lyrics) return showErr("Add lyrics, or switch on Instrumental.");
    label = [payload.title, payload.style].filter(Boolean).join(" — ") || "Custom song";
  }

  const btn = $("genBtn");
  btn.disabled = true;
  btn.querySelector(".btn-label").textContent = "Starting…";
  try {
    const { taskId } = await api("/api/generate", { method: "POST", body: JSON.stringify(payload) });
    const job = { taskId, label, createdAt: Date.now(), status: "PENDING", tracks: [], instrumental };
    jobs.unshift(job);
    saveJobs();
    render();
    poll(job);
    toast("Song is cooking — usually ready in 1–3 minutes.");
  } catch (ex) {
    showErr(ex.message);
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-label").textContent = "Create";
  }

  function showErr(m) { err.textContent = m; err.hidden = false; }
});

function poll(job) {
  if (pollers.has(job.taskId)) return;
  const tick = async () => {
    try {
      const r = await api(`/api/status?taskId=${encodeURIComponent(job.taskId)}`);
      job.status = r.status;
      if (r.tracks?.length) job.tracks = r.tracks;
      if (r.failed) { job.failed = true; job.error = r.error || r.status.replace(/_/g, " ").toLowerCase(); }
      if (r.done || r.failed) { stop(); refreshCredits(); }
    } catch (e) {
      // transient errors: keep polling until timeout
      console.warn(e);
    }
    if (Date.now() - job.createdAt > MAX_POLL_MS && !job.failed && job.status !== "SUCCESS") {
      job.failed = true; job.error = "Timed out"; stop();
    }
    saveJobs();
    render();
  };
  const id = setInterval(tick, POLL_MS);
  pollers.set(job.taskId, id);
  tick();
  function stop() { clearInterval(id); pollers.delete(job.taskId); }
}

/* ---------------- render ---------------- */
function render() {
  const wrap = $("jobs");
  wrap.replaceChildren();
  $("empty").hidden = jobs.length > 0;

  for (const job of jobs) {
    const done = job.status === "SUCCESS";
    const statusEl = el("span", { class: `job-status ${job.failed ? "fail" : done ? "done" : ""}` },
      !done && !job.failed ? el("span", { class: "spinner" }) : null,
      job.failed ? `Failed: ${job.error}` : STATUS_TEXT[job.status] || job.status
    );

    const tracks = job.tracks?.length ? job.tracks : job.failed ? [] : [null, null];
    const grid = el("div", { class: "tracks" }, tracks.map((t) => trackCard(t, job)));

    wrap.append(
      el("article", { class: "job" },
        el("div", { class: "job-head" },
          el("div", { class: "job-prompt", title: job.label }, job.label),
          statusEl
        ),
        grid
      )
    );
  }
}

function trackCard(t, job) {
  if (!t) {
    return el("div", { class: "track-card" },
      el("div", { class: "art skeleton" }),
      el("div", { class: "tmeta" },
        el("div", { class: "ttitle" }, "Generating…"),
        el("div", { class: "ttags" }, job.instrumental ? "instrumental" : "writing & singing")
      )
    );
  }
  const src = t.audioUrl || t.streamUrl;
  const playing = currentTrackId === t.id;
  const art = el("button", {
    class: "art", type: "button", disabled: !src, "aria-label": `Play ${t.title || "track"}`,
    onclick: () => play(t),
  },
    t.imageUrl ? el("img", { src: t.imageUrl, alt: "", loading: "lazy" }) : null,
    el("span", { class: "play" }, playing && !$("audio").paused ? "❚❚" : "▶")
  );

  const actions = el("div", { class: "tactions" });
  if (t.audioUrl) actions.append(el("a", { href: t.audioUrl, download: `${t.title || "song"}.mp3`, target: "_blank", rel: "noopener" }, "Download"));
  else if (t.streamUrl) actions.append(el("span", { style: "color:var(--muted)" }, "Streaming preview"));
  if (t.lyrics && !job.instrumental) actions.append(el("button", { type: "button", onclick: () => showLyrics(t) }, "Lyrics"));
  if (t.duration) actions.append(el("span", { style: "color:var(--muted)" }, fmtTime(t.duration)));

  return el("div", { class: `track-card ${playing ? "playing" : ""}` },
    art,
    el("div", { class: "tmeta" },
      el("div", { class: "ttitle", title: t.title }, t.title || "Untitled"),
      el("div", { class: "ttags", title: t.tags }, t.tags || ""),
      actions
    )
  );
}

/* ---------------- player ---------------- */
const audio = $("audio");
function play(t) {
  const src = t.audioUrl || t.streamUrl;
  if (!src) return;
  if (currentTrackId === t.id) {
    audio.paused ? audio.play() : audio.pause();
    return;
  }
  currentTrackId = t.id;
  audio.src = src;
  $("player").hidden = false;
  $("playerTitle").textContent = t.title || "Untitled";
  $("playerTags").textContent = t.tags || "";
  if (t.imageUrl) $("playerArt").src = t.imageUrl; else $("playerArt").removeAttribute("src");
  audio.play().catch(() => toast("Couldn't play this track yet — try again in a moment."));
  render();
}
audio.addEventListener("play", render);
audio.addEventListener("pause", render);

function showLyrics(t) {
  $("lyricsViewTitle").textContent = t.title || "Lyrics";
  $("lyricsViewText").textContent = t.lyrics;
  $("lyricsView").showModal();
}

/* ---------------- AI lyrics ---------------- */
$("aiLyricsBtn").addEventListener("click", () => {
  $("lyricsResults").replaceChildren();
  $("lyricsError").hidden = true;
  $("lyricsDialog").showModal();
  $("lyricsPrompt").focus();
});
$("lyricsPrompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("lyricsGo").click(); }
});
$("lyricsGo").addEventListener("click", async () => {
  const p = $("lyricsPrompt").value.trim();
  const errEl = $("lyricsError");
  errEl.hidden = true;
  if (!p) { errEl.textContent = "Tell us what the song is about."; errEl.hidden = false; return; }
  const btn = $("lyricsGo");
  btn.disabled = true;
  btn.textContent = "Writing…";
  const results = $("lyricsResults");
  results.replaceChildren(el("div", { class: "hint" }, el("span", { class: "spinner", style: "display:inline-block;vertical-align:middle;margin-right:8px" }), "Writing lyrics, ~30 seconds…"));
  try {
    const { taskId } = await api("/api/lyrics", { method: "POST", body: JSON.stringify({ prompt: p }) });
    const started = Date.now();
    let r;
    while (Date.now() - started < 3 * 60 * 1000) {
      await new Promise((res) => setTimeout(res, 3000));
      r = await api(`/api/lyrics?taskId=${encodeURIComponent(taskId)}`);
      if (r.done || r.failed) break;
    }
    if (!r?.done) throw new Error(r?.error || "Lyrics generation failed or timed out.");
    results.replaceChildren(...r.items.map((item) =>
      el("div", { class: "lyric-option" },
        el("strong", {}, item.title || "Option"),
        el("pre", {}, item.text),
        el("button", {
          type: "button", class: "primary small",
          onclick: () => {
            $("lyrics").value = item.text;
            $("lyricsCount").textContent = item.text.length;
            if (!$("title").value && item.title) $("title").value = item.title;
            $("lyricsDialog").close();
          },
        }, "Use these lyrics")
      )
    ));
    refreshCredits();
  } catch (ex) {
    results.replaceChildren();
    errEl.textContent = ex.message;
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
});

/* ---------------- library ---------------- */
$("clearBtn").addEventListener("click", () => {
  if (!jobs.length || !confirm("Remove all songs from this browser? (Suno keeps files for 14 days.)")) return;
  pollers.forEach((id) => clearInterval(id));
  pollers.clear();
  jobs = [];
  saveJobs();
  render();
});

/* ---------------- boot ---------------- */
render();
refreshCredits();
jobs.filter((j) => j.status !== "SUCCESS" && !j.failed).forEach(poll);
