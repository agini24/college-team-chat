// api/auth-login.js  (CommonJS)

const ALLOW_ORIGINS = ["https://www.gocoyotes.ca","https://gocoyotes.ca"];

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0]);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

module.exports = async (req, res) => {
  setCors(res, req.headers.origin || "");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = await readJSON(req);
    const { username, password } = body || {};
    if (!username || !password) return res.status(400).json({ error: "missing_credentials" });

    const roster = JSON.parse(process.env.TEAM_CREDENTIALS || "[]");
    const row = roster.find(r => r.username === username && r.password === password);
    if (!row) return res.status(401).json({ error: "invalid_login" });

    const uid = username;
    const name = row.username;

    const base = `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3`;
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "apiKey": process.env.COMETCHAT_API_KEY
    };

    // create user if needed (ignore error if exists)
    await fetch(`${base}/users`, { method: "POST", headers, body: JSON.stringify([{ uid, name }]) }).catch(() => {});

    // mint auth token
    const resp = await fetch(`${base}/users/${encodeURIComponent(uid)}/auth_tokens`, { method: "POST", headers });
    const json = await resp.json();
    if (!resp.ok || !json?.data?.authToken) return res.status(500).json({ error: "cometchat_token_failed", detail: json });

    res.status(200).json({ uid, name, authToken: json.data.authToken });
  } catch (e) {
    res.status(500).json({ error: "server_error", detail: String(e) });
  }
};

function readJSON(req) {
  return new Promise(resolve => {
    let data = "";
    req.on("data", d => (data += d));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve(null); } });
  });
}
