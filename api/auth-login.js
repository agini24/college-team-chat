// api/auth-login.js  — Smoke test to prove the route & CORS are fine
module.exports = async (req, res) => {
  // CORS
  const ALLOW = [
    "https://www.gocoyotes.ca",
    "https://gocoyotes.ca",
    "https://college-team-chat.vercel.app"
  ];
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOW.includes(origin) ? origin : ALLOW[0]);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).send("auth-login endpoint is alive");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  // Parse body
  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ error: "bad_json" }); }

  const { username, password } = body;
  if (!username || !password) return res.status(400).json({ error: "missing_credentials" });

  // Always succeed (just for test)
  return res.status(200).json({
    uid: username,
    name: username,
    authToken: "test-token-" + Math.random().toString(36).slice(2)
  });
};
