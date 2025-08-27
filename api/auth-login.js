// api/auth-login.js

// ---- CORS (allow only your site) ----
const ALLOW_ORIGINS = [
  "https://www.gocoyotes.ca",
  "https://gocoyotes.ca",
  "https://college-team-chat.vercel.app" // your API host itself
];

function setCors(res, origin = "") {
  res.setHeader(
    "Access-Control-Allow-Origin",
    ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0]
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

// ---- tiny helper to parse JSON body ----
function readJSON(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (d) => (data += d));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve(null); }
    });
  });
}

// ---- main handler ----
export default async function handler(req, res) {
  setCors(res, req.headers.origin || "");

  // Preflight
  if (req.method === "OPTIONS") return res.status(204).end();

  // Simple browser check
  if (req.method === "GET") {
    return res.status(200).send("auth-login endpoint is alive");
  }

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const body = await readJSON(req);
    const { username, password } = body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }

    // 1) Validate against roster in env
    //    TEAM_CREDENTIALS must be a JSON array of { username, password }
    const roster = JSON.parse(process.env.TEAM_CREDENTIALS || "[]");
    const row = roster.find(
      (r) => r.username === username && r.password === password
    );
    if (!row) {
      return res.status(401).json({ error: "invalid_login" });
    }

    const uid = username;      // use full name as UID
    const name = row.username; // display name

    // 2) CometChat REST base + headers
    const base = `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3`;
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "apiKey": process.env.COMETCHAT_API_KEY // REST API Key (NOT Auth Key/Secret)
    };

    // 3) Ensure user exists (ignore "already exists" errors)
    try {
      await fetch(`${base}/users`, {
        method: "POST",
        headers,
        body: JSON.stringify([{ uid, name }])
      });
    } catch {
      // ignore
    }

    // 4) Mint an auth token for this user
    const resp = await fetch(
      `${base}/users/${encodeURIComponent(uid)}/auth_tokens`,
      { method: "POST", headers }
    );
    const json = await resp.json();

    if (!resp.ok || !json?.data?.authToken) {
      return res
        .status(500)
        .json({ error: "cometchat_token_failed", detail: json });
    }

    // 5) Return token to the launcher
    return res.status(200).json({
      uid,
      name,
      authToken: json.data.authToken
    });
  } catch (e) {
    return res.status(500).json({ error: "server_error", detail: String(e) });
  }
}
