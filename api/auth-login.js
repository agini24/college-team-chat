// api/auth-login.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const body = await readJSON(req);
    const { username, password } = body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }

    // 1) Load roster from env
    const roster = JSON.parse(process.env.TEAM_CREDENTIALS || "[]");
    const row = roster.find(r => r.username === username && r.password === password);
    if (!row) {
      return res.status(401).json({ error: "invalid_login" });
    }

    const uid = username;         // use full name as UID
    const name = row.username;    // display name = full name

    // 2) Ensure CometChat user exists
    const base = `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3`;
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "apiKey": process.env.COMETCHAT_API_KEY // REST API Key
    };

    // Create user if missing (ignore "already exists" errors)
    await fetch(`${base}/users`, {
      method: "POST",
      headers,
      body: JSON.stringify([{ uid, name }])
    }).catch(() => {});

    // 3) Mint auth token for this user
    const resp = await fetch(`${base}/users/${encodeURIComponent(uid)}/auth_tokens`, {
      method: "POST",
      headers
    });
    const json = await resp.json();

    if (!resp.ok || !json?.data?.authToken) {
      return res.status(500).json({ error: "cometchat_token_failed", detail: json });
    }

    return res.status(200).json({ uid, name, authToken: json.data.authToken });

  } catch (e) {
    return res.status(500).json({ error: "server_error", detail: String(e) });
  }
}

// Helper to parse JSON body
function readJSON(req) {
  return new Promise(resolve => {
    let data = "";
    req.on("data", d => (data += d));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { resolve(null); }
    });
  });
}
