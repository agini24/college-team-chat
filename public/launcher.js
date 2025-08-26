/* =========================================================================
   Coyotes Chat Launcher (username+password, server-minted tokens)
   ======================================================================== */
(() => {
  // --- CometChat SDK (CDN is simplest & reliable) ---
  const SDK_SRC = "https://unpkg.com/@cometchat-pro/chat/CometChat.js";

  // --- App config ---
  const APP_ID = "2808186f24275c0e";
  const REGION = "us";

  // Groups
  const GROUPS = {
    TEAM:          { guid: "team_chat",           name: "Team Chat" },
    ANNOUNCEMENTS: { guid: "coach_announcements", name: "Coach Announcements" },
    QUESTIONS:     { guid: "questions",           name: "Questions" },
  };
  const COACH_UID_PREFIX = "coach_";

  // --- Load SDK ---
  function loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.CometChat) return resolve();
      const s = document.createElement("script");
      s.src = SDK_SRC; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error("CometChat SDK load failed"));
      document.head.appendChild(s);
    });
  }

  // --- Init ---
  async function initCometChat() {
    const appSetting = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(REGION)
      .autoEstablishSocketConnection(true)
      .build();
    await CometChat.init(APP_ID, appSetting);
  }

  // --- Storage ---
  const LS_KEY = "coy_chat_user";
  const getUser = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; } };
  const setUser = (u) => localStorage.setItem(LS_KEY, JSON.stringify(u));
  const clearUser = () => localStorage.removeItem(LS_KEY);

  // --- DOM + Styles ---
  const ROOT_ID = "coyotes-chat-root";

  function injectStyles() {
    if (document.getElementById("coy-chat-styles")) return;
    const css = `
      :root{
        --c-red:#e60023; --c-bg:#0b0b0d; --c-elev:#141418;
        --c-border:rgba(255,255,255,.08); --c-text:#f2f2f5; --c-dim:#9aa0aa; --c-green:#2ecc71;
      }
      #${ROOT_ID}{position:fixed; right:18px; bottom:80px; z-index:999999;} /* lifted above site nav */
      .coy-bubble{width:58px;height:58px;border-radius:999px;background:var(--c-red);display:grid;place-items:center;color:#fff;cursor:pointer;box-shadow:0 10px 24px rgba(230,0,35,.35);position:relative;transition:transform .15s}
      .coy-bubble:active{transform:scale(.96)}
      .coy-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#fff;color:#000;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 4px 10px rgba(0,0,0,.3)}
      .coy-panel{position:absolute;right:0;bottom:74px;width:min(92vw,420px);height:min(70vh,640px);background:var(--c-bg);border:1px solid var(--c-border);border-radius:18px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)}
      .coy-panel.open{display:flex}
      .coy-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(180deg,#16161b,#121217);border-bottom:1px solid var(--c-border);color:var(--c-text)}
      .coy-tabs{display:flex;gap:8px}
      .coy-tab{padding:6px 10px;border-radius:999px;border:1px solid var(--c-border);background:#0f0f13;color:var(--c-dim);cursor:pointer;font-weight:700;font-size:12px;display:flex;align-items:center;gap:6px}
      .coy-tab.active{color:#fff;background:#18181f;border-color:#2a2a35}
      .coy-tab .badge{min-width:14px;height:14px;border-radius:999px;background:var(--c-red);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;padding:0 4px;transform:translateY(-1px)}
      .coy-login{padding:12px;border-bottom:1px solid var(--c-border);background:#101015;display:flex;gap:8px;flex-wrap:wrap}
      .coy-login input{background:#0e0e13;border:1px solid var(--c-border);border-radius:10px;padding:8px 10px;color:#fff}
      .coy-login button{background:var(--c-green);color:#000;border:none;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}
      .coy-body{display:flex;flex-direction:column;flex:1}
      .coy-log{flex:1;overflow:auto;padding:14px;background:#0e0e12}
      .msg{max-width:82%;margin-bottom:10px;padding:8px 10px;border-radius:14px;color:#fff;font-size:14px;line-height:1.3;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);word-break:break-word}
      .me{margin-left:auto;background:#1f1f2a}.them{margin-right:auto;background:#171720}
      .meta{color:var(--c-dim);font-size:11px;margin-top:2px}
      .coy-input{display:flex;gap:10px;border-top:1px solid var(--c-border);background:var(--c-elev);padding:10px}
      .coy-input input{flex:1;background:#0e0e13;border:1px solid var(--c-border);border-radius:12px;padding:10px 12px;color:#fff;outline:none}
      .coy-input button{background:var(--c-red);color:#fff;border:none;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer}
      .coy-muted{color:var(--c-dim);font-size:12px;padding:10px 14px;border-top:1px solid var(--c-border)}
    `;
    const el = document.createElement("style");
    el.id = "coy-chat-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  function createUI() {
    const root = document.getElementById(ROOT_ID) || (() => {
      const d = document.createElement("div"); d.id = ROOT_ID; document.body.appendChild(d); return d;
    })();

    root.innerHTML = `
      <button class="coy-bubble" id="coyBubble" aria-label="Open chat">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10Z" fill="white"/></svg>
        <span class="coy-badge" id="coyGlobalBadge" style="display:none">0</span>
      </button>

      <section class="coy-panel" id="coyPanel" role="dialog" aria-label="Coyotes Chat">
        <header class="coy-head">
          <div class="coy-tabs">
            <button class="coy-tab active" data-tab="TEAM" id="tabTEAM">
              Team <span class="badge" id="badgeTEAM" style="display:none">0</span>
            </button>
            <button class="coy-tab" data-tab="ANNOUNCEMENTS" id="tabANNOUNCEMENTS">
              Announcements <span class="badge" id="badgeANNOUNCEMENTS" style="display:none">0</span>
            </button>
            <button class="coy-tab" data-tab="QUESTIONS" id="tabQUESTIONS">
              Questions <span class="badge" id="badgeQUESTIONS" style="display:none">0</span>
            </button>
          </div>
          <small id="coyUserLabel" style="color:#aab; font-size:12px;"></small>
        </header>

        <div class="coy-login" id="coyLogin">
          <input id="loginUser" placeholder="Username (e.g., player1)" />
          <input id="loginPass" type="password" placeholder="Password" />
          <button id="loginBtn">Log in</button>
        </div>

        <div class="coy-body">
          <div class="coy-log" id="coyLog"></div>
          <div class="coy-input" id="coyInput" style="display:none">
            <input id="coyText" placeholder="Message…" />
            <button id="coySend">Send</button>
          </div>
          <div class="coy-muted" id="coyMuted" style="display:none">Only coaches can post in Announcements.</div>
        </div>
      </section>
    `;

    // Toggle panel
    document.getElementById("coyBubble").onclick = () => {
      document.getElementById("coyPanel").classList.toggle("open");
    };

    // Tabs
    root.querySelectorAll(".coy-tab").forEach(b => {
      b.addEventListener("click", () => {
        root.querySelectorAll(".coy-tab").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        setActiveTab(b.dataset.tab);
      });
    });

    // Inputs
    document.getElementById("coySend").onclick = () => {
      const inp = document.getElementById("coyText");
      sendActive(inp.value).catch(console.error);
      inp.value = "";
    };
    document.getElementById("coyText").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("coySend").click();
    });

    document.getElementById("loginBtn").onclick = doLogin;
  }

  // --- Login (server-verified username+password → CometChat authToken) ---
  let loggedUser = null;

  async function doLogin() {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    if (!user || !pass) return alert("Enter username and password");

    const r = await fetch("/api/auth-login", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ username: user, password: pass })
    });
    const j = await r.json();
    if (!r.ok || !j?.authToken) { alert("Login failed"); return; }

    await CometChat.login(j.authToken);               // secure login via token
    loggedUser = { uid: j.uid, name: j.name };
    setUser(loggedUser);

    document.getElementById("coyLogin").style.display = "none";
    document.getElementById("coyInput").style.display = "flex";
    document.getElementById("coyUserLabel").textContent = `${j.name} (${j.uid})`;

    await postLoginSetup();
  }

  function isCoach(uid) { return String(uid || "").startsWith(COACH_UID_PREFIX); }

  // --- Groups / messages ---
  let activeTab = "TEAM";
  let activeGroup = GROUPS.TEAM;
  let unread = { TEAM:0, ANNOUNCEMENTS:0, QUESTIONS:0 };
  const listenerId = "coyotes-listener";

  async function ensureGroup({guid, name}) {
    try { await CometChat.getGroup(guid); }
    catch {
      const g = new CometChat.Group(guid, name, CometChat.GROUP_TYPE.PUBLIC);
      try { await CometChat.createGroup(g); } catch {}
    }
  }

  function setActiveTab(key) {
    activeTab = key;
    activeGroup = GROUPS[key];

    const iBox = document.getElementById("coyInput");
    const muted= document.getElementById("coyMuted");

    if (key === "ANNOUNCEMENTS" && !isCoach(loggedUser?.uid)) {
      iBox.style.display = "none"; muted.style.display = "block";
    } else {
      if (loggedUser) iBox.style.display = "flex";
      muted.style.display = "none";
    }

    unread[key] = 0; updateBadges();
    loadHistory(activeGroup.guid);
  }

  function updateBadges() {
    const total = unread.TEAM + unread.ANNOUNCEMENTS + unread.QUESTIONS;
    const g = document.getElementById("coyGlobalBadge");
    g.style.display = total ? "inline-flex" : "none";
    g.textContent = total;

    ["TEAM","ANNOUNCEMENTS","QUESTIONS"].forEach(k => {
      const b = document.getElementById("badge"+k);
      if (!b) return;
      b.style.display = unread[k] ? "inline-flex" : "none";
      b.textContent = unread[k] || "";
    });
  }

  function appendMessage(msg, mine) {
    const log = document.getElementById("coyLog");
    const div = document.createElement("div");
    div.className = "msg " + (mine ? "me" : "them");
    const text = (msg.text || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const who  = mine ? "You" : (msg.sender?.name || msg.sender?.uid || "User");
    const when = new Date(msg.sentAt*1000 || Date.now()).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    div.innerHTML = `${text}<div class="meta">${who} • ${when}</div>`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  async function loadHistory(guid) {
    const log = document.getElementById("coyLog");
    log.innerHTML = "";
    try {
      try { await CometChat.joinGroup(guid, CometChat.GROUP_TYPE.PUBLIC, ""); } catch {}
      const req = new CometChat.MessagesRequestBuilder().setGUID(guid).setLimit(30).build();
      const msgs = await req.fetchPrevious();
      msgs.reverse().forEach(m => appendMessage(m, m.sender?.uid === loggedUser?.uid));
    } catch {
      log.innerHTML = `<div class="msg them">Couldn’t load messages.</div>`;
    }
  }

  function addLiveListener() {
    try { CometChat.removeMessageListener(listenerId); } catch {}
    CometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({
        onTextMessageReceived: (m) => {
          const gid = m.receiverType === "group" ? m.receiverId : null;
          const tabKey =
            gid === GROUPS.TEAM.guid ? "TEAM" :
            gid === GROUPS.ANNOUNCEMENTS.guid ? "ANNOUNCEMENTS" :
            gid === GROUPS.QUESTIONS.guid ? "QUESTIONS" : null;
          if (!tabKey) return;

          const open = document.getElementById("coyPanel")?.classList.contains("open");
          if (!(tabKey === activeTab && open)) {
            unread[tabKey] = (unread[tabKey] || 0) + 1; updateBadges();
          } else {
            appendMessage(m, m.sender?.uid === loggedUser?.uid);
          }
        }
      })
    );
  }

  async function sendActive(text) {
    if (!text.trim()) return;
    const msg = new CometChat.TextMessage(
      activeGroup.guid, text.trim(), CometChat.RECEIVER_TYPE.GROUP
    );
    const m = await CometChat.sendMessage(msg);
    appendMessage(m, true);
  }

  async function postLoginSetup() {
    await Promise.all([
      ensureGroup(GROUPS.TEAM),
      ensureGroup(GROUPS.ANNOUNCEMENTS),
      ensureGroup(GROUPS.QUESTIONS),
    ]);
    for (const g of [GROUPS.TEAM, GROUPS.ANNOUNCEMENTS, GROUPS.QUESTIONS]) {
      try { await CometChat.joinGroup(g.guid, CometChat.GROUP_TYPE.PUBLIC, ""); } catch {}
    }
    addLiveListener();
    setActiveTab(activeTab);
  }

  // --- Boot ---
  async function boot() {
    injectStyles();
    createUI();

    const u = getUser();
    if (u) {
      try {
        // Try to resume with an auth token? (CometChat tokens are short-lived; so we re-login on each page view by re-entering credentials when needed)
        document.getElementById("coyLogin").style.display = "none";
        document.getElementById("coyInput").style.display = "flex";
        loggedUser = u;
        document.getElementById("coyUserLabel").textContent = `${u.name} (${u.uid})`;
        await postLoginSetup();
      } catch {
        clearUser();
        document.getElementById("coyLogin").style.display = "flex";
      }
    }
  }

  loadSDK().then(initCometChat).then(boot).catch(() => {
    const r = document.getElementById(ROOT_ID) || document.body;
    const warn = document.createElement("div");
    warn.style = "position:fixed;right:18px;bottom:80px;background:#222;color:#fff;padding:10px 14px;border-radius:12px;border:1px solid #444;z-index:999999";
    warn.textContent = "Chat unavailable";
    r.appendChild(warn);
  });
})();
