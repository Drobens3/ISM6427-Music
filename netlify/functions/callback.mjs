// Suno requires a callBackUrl. The app polls for status instead, so this just acknowledges.
export default async () =>
  new Response(JSON.stringify({ code: 200, msg: "received" }), {
    headers: { "content-type": "application/json" },
  });

export const config = { path: "/api/callback" };
