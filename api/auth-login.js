// api/auth-login.js  — roster check + CometChat token (static site on Vercel)

module.exports = async (req, res) => {
  // ---- CORS ----
  const ALLOW = new Set([
    "https://www.gocoyotes.ca",
    "https://gocoyotes.ca",
    "https://college-team-chat.vercel.app"
  ]);
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOW.has(origin) ? origin : "https://www.gocoyotes.ca");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).send("auth-login endpoint is alive");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  // ---- Parse JSON body ----
  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ error: "bad_json" }); }
  const { username, password } = body || {};
  if (!username || !password) return res.status(400).json({ error: "missing_credentials" });

  // ---- Roster from env ----
  let roster = [];
  try { roster = JSON.parse(process.env.TEAM_CREDENTIALS || "[]"); }
  catch { return res.status(500).json({ error: "server_config", detail: "TEAM_CREDENTIALS invalid JSON" }); }
  const row = roster.find(r => r.username === username && r.password === password);
  if (!row) return res.status(401).json({ error: "invalid_login" });

  // ---- CometChat REST ----
  const APP_ID = process.env.COMETCHAT_APP_ID;
  const REGION = process.env.COMETCHAT_REGION;
  const API_KEY = process.env.COMETCHAT_API_KEY;
  if (!APP_ID || !REGION || !API_KEY) {
    return res.status(500).json({ error: "server_config", detail: "Missing CometChat env" });
  }

  const uid = username;
  const name = row.username;
  const base = `https://${APP_ID}.api-${REGION}.cometchat.io/v3`;
  const headers = { "Content-Type": "application/json", "Accept": "application/json", "apiKey": API_KEY };

  // Ensure user exists (ignore errors if already exists)
  try {
    await fetch(`${base}/users`, { method: "POST", headers, body: JSON.stringify([{ uid, name }]) });
  } catch {}

  // Mint auth token
  const resp = await fetch(`${base}/users/${encodeURIComponent(uid)}/auth_tokens`, { method: "POST", headers });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.data?.authToken) {
    return res.status(500).json({ error: "cometchat_token_failed", detail: json });
  }

  return res.status(200).json({ uid, name, authToken: json.data.authToken });
};
