/* =========================================================================
   Coyotes Chat Launcher
   - Bottom-right bubble that opens a 3-tab chat (Team, Coach Announcements, Questions)
   - Persists login with localStorage
   - Loads CometChat SDK from your own domain: /vendor/CometChat.js
   - iMessage-like UI, black + red palette
   ======================================================================== */

(() => {
  // -----------------------------
  // 0) CONFIG — CHANGE THESE
  // -----------------------------
  const APP_ID   = "2808186f24275c0e";             // <- your CometChat App ID
  const REGION   = "us";                            // <- your CometChat Region (e.g., "us")
  const AUTH_KEY = "d20ca03513ab3c8c65c84f3429e7fd84a0deeb34"; // <- your public Auth Key (NOT App Secret)

  // CometChat SDK source hosted on your Vercel app:
  const SDK_SRC  = "/vendor/CometChat.js";

  // Group IDs (stable identifiers). Rename if you want.
  const GROUPS = {
    TEAM:          { guid: "team_chat",           name: "Team Chat",           type: "public"  },
    ANNOUNCEMENTS: { guid: "coach_announcements", name: "Coach Announcements", type: "public"  },
    QUESTIONS:     { guid: "questions",           name: "Questions",           type: "public"  },
  };

  // If someone’s UID starts with this, we treat them as a coach (can post in announcements)
  const COACH_UID_PREFIX = "coach_";

  // -----------------------------
  // 1) LOAD SDK (once)
  // -----------------------------
  function loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.CometChat) return resolve();
      const s = document.createElement("script");
      s.src = SDK_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load CometChat SDK from " + SDK_SRC));
      document.head.appendChild(s);
    });
  }

  // -----------------------------
  // 2) CometChat helpers
  // -----------------------------
  async function initCometChat() {
    const appSetting = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(REGION)
      .autoEstablishSocketConnection(true)
      .build();

    await CometChat.init(APP_ID, appSetting);
  }

  function currentUser() {
    try {
      const raw = localStorage.getItem("coy_chat_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveUser(u) {
    localStorage.setItem("coy_chat_user", JSON.stringify({ uid: u.uid, name: u.name }));
  }

  async function createOrLogin(uid, name) {
    // 1) Try to create (if exists, CometChat throws 400, which we can ignore)
    const user = new CometChat.User(uid);
    user.setName(name);
    try { await CometChat.createUser(user, AUTH_KEY); } catch (_) {}

    // 2) Login
    await CometChat.login(uid, AUTH_KEY);
    saveUser({ uid, name });
    return { uid, name };
  }

  async function ensureGroup({guid, name, type}) {
    try {
      await CometChat.getGroup(guid);
    } catch {
      // Create if not exists (public group)
      const g = new CometChat.Group(guid, name, CometChat.GROUP_TYPE.PUBLIC);
      try { await CometChat.createGroup(g); } catch (_) {}
    }
  }

  function isCoach(uid) {
    return String(uid || "").startsWith(COACH_UID_PREFIX);
  }

  // -----------------------------
  // 3) UI — bubble + panel
  // -----------------------------
  const ROOT_ID = "coyotes-chat-root";

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  function injectStyles() {
    if (document.getElementById("coy-chat-styles")) return;
    const css = `
    :root{
      --c-red:#e60023;
      --c-bg:#0b0b0d;
      --c-elev:#141418;
      --c-border:rgba(255,255,255,.08);
      --c-text:#f2f2f5;
      --c-dim:#9aa0aa;
      --c-green:#2ecc71;
    }
    #${ROOT_ID} { position: fixed; right: 18px; bottom: 18px; z-index: 999999; }

    .coy-bubble {
      width: 58px; height: 58px; border-radius: 999px; background: var(--c-red);
      display: grid; place-items: center; color: #fff; cursor: pointer;
      box-shadow: 0 10px 24px rgba(230,0,35,.35);
      position: relative;
      transition: transform .15s ease;
    }
    .coy-bubble:active { transform: scale(.96); }
    .coy-badge {
      position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px;
      padding: 0 6px; border-radius: 999px; background:#fff; color:#000; font-weight:800;
      display:flex; align-items:center; justify-content:center; font-size:12px;
      box-shadow:0 4px 10px rgba(0,0,0,.3);
    }

    .coy-panel {
      position: absolute; right: 0; bottom: 74px; width: min(92vw, 420px); height: min(70vh, 640px);
      background: var(--c-bg); border:1px solid var(--c-border); border-radius: 18px;
      display: none; flex-direction: column; overflow: hidden;
      box-shadow: 0 24px 60px rgba(0,0,0,.5);
    }
    .coy-panel.open { display:flex; }

    .coy-head {
      display:flex; align-items:center; justify-content:space-between;
      padding: 10px 12px; background: linear-gradient(180deg,#16161b,#121217);
      border-bottom:1px solid var(--c-border); color: var(--c-text);
    }
    .coy-tabs { display:flex; gap:8px; }
    .coy-tab {
      padding: 6px 10px; border-radius: 999px; border:1px solid var(--c-border);
      background: #0f0f13; color: var(--c-dim); cursor: pointer; font-weight: 700; font-size: 12px;
      display:flex; align-items:center; gap:6px;
    }
    .coy-tab.active { color:#fff; background: #18181f; border-color: #2a2a35; }
    .coy-tab .badge {
      min-width: 14px; height:14px; border-radius:999px; background: var(--c-red); color:#fff;
      display:inline-flex; align-items:center; justify-content:center; font-size:10px; padding:0 4px;
      transform: translateY(-1px);
    }

    .coy-body { display:flex; flex-direction:column; gap:0; flex:1; }
    .coy-log {
      flex:1; overflow:auto; padding: 14px; background: #0e0e12;
    }
    .msg {
      max-width: 82%; margin-bottom:10px; padding: 8px 10px; border-radius: 14px;
      color:#fff; font-size:14px; line-height:1.3;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
      word-break: break-word;
    }
    .me   { margin-left: auto; background: #1f1f2a; }
    .them { margin-right: auto; background: #171720; }
    .meta { color: var(--c-dim); font-size: 11px; margin-top: 2px; }

    .coy-input {
      display:flex; gap:10px; border-top:1px solid var(--c-border); background: var(--c-elev); padding:10px;
    }
    .coy-input input {
      flex:1; background:#0e0e13; border:1px solid var(--c-border); border-radius:12px;
      padding:10px 12px; color:#fff; outline:none;
    }
    .coy-input button {
      background: var(--c-red); color:#fff; border:none; border-radius:12px; padding: 10px 14px; font-weight:800; cursor:pointer;
    }
    .coy-muted { color: var(--c-dim); font-size:12px; padding: 10px 14px; border-top:1px solid var(--c-border); }

    .coy-login {
      padding:12px; border-bottom:1px solid var(--c-border); background:#101015; display:flex; gap:8px; flex-wrap:wrap;
    }
    .coy-login input{
      background:#0e0e13; border:1px solid var(--c-border); border-radius:10px; padding:8px 10px; color:#fff;
    }
    .coy-login button{ background: var(--c-green); color:#000; border:none; border-radius:10px; padding:8px 12px; font-weight:800; cursor:pointer;}
    `;
    const el = document.createElement("style");
    el.id = "coy-chat-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  function createUI() {
    const root = ensureRoot();
    root.innerHTML = `
      <button class="coy-bubble" id="coyBubble" aria-label="Open chat">
        <!-- chat icon -->
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10Z" fill="white"/></svg>
        <span class="coy-badge" id="coyGlobalBadge" style="display:none">0</span>
      </button>

      <section class="coy-panel" id="coyPanel" role="dialog" aria-label="Coyotes Chat" aria-modal="false">
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

        <div class="coy-login" id="coyLogin" style="display:none">
          <input id="loginUID" placeholder="UID (e.g., p_john or coach_andrew)" />
          <input id="loginName" placeholder="Display name" />
          <button id="loginBtn">Log in</button>
        </div>

        <div class="coy-body">
          <div class="coy-log" id="coyLog"></div>
          <div class="coy-input" id="coyInput">
            <input id="coyText" placeholder="Message…" />
            <button id="coySend">Send</button>
          </div>
          <div class="coy-muted" id="coyMuted" style="display:none">Only coaches can post in Announcements.</div>
        </div>
      </section>
    `;

    // Toggle open/close
    const bubble = document.getElementById("coyBubble");
    const panel  = document.getElementById("coyPanel");
    bubble.onclick = () => panel.classList.toggle("open");

    // Tabs
    root.querySelectorAll(".coy-tab").forEach(b => {
      b.addEventListener("click", () => {
        root.querySelectorAll(".coy-tab").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        setActiveTab(b.dataset.tab);
      });
    });
  }

  // -----------------------------
  // 4) Chat runtime
  // -----------------------------
  let activeTab = "TEAM";
  let activeGroup = GROUPS.TEAM; // default
  let listenerId = "coyotes-listener";
  let unread = { TEAM:0, ANNOUNCEMENTS:0, QUESTIONS:0 };

  let loggedUser = null;

  function setActiveTab(key) {
    activeTab = key;
    activeGroup = GROUPS[key];
    // hide or show posting depending on tab/coach
    const iBox = document.getElementById("coyInput");
    const muted= document.getElementById("coyMuted");
    if (key === "ANNOUNCEMENTS" && !isCoach(loggedUser?.uid)) {
      iBox.style.display = "none"; muted.style.display = "block";
    } else {
      iBox.style.display = "flex"; muted.style.display = "none";
    }
    // mark messages read & load
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
      // join group if needed
      try { await CometChat.joinGroup(guid, CometChat.GROUP_TYPE.PUBLIC, ""); } catch (_) {}
      const req = new CometChat.MessagesRequestBuilder()
        .setGUID(guid)
        .setLimit(30)
        .build();
      const msgs = await req.fetchPrevious();
      msgs.reverse().forEach(m => appendMessage(m, m.sender?.uid === loggedUser?.uid));
    } catch (e) {
      log.innerHTML = `<div class="msg them">Couldn’t load messages.</div>`;
      console.error(e);
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

          // if not on this tab or panel closed -> increment unread
          const panelOpen = document.getElementById("coyPanel")?.classList.contains("open");
          if (!(tabKey === activeTab && panelOpen)) {
            unread[tabKey] = (unread[tabKey] || 0) + 1;
            updateBadges();
          } else {
            // viewing this tab — show immediately
            appendMessage(m, m.sender?.uid === loggedUser?.uid);
          }
        }
      })
    );
  }

  async function sendActive(text) {
    if (!text.trim()) return;
    const msg = new CometChat.TextMessage(
      activeGroup.guid,
      text.trim(),
      CometChat.RECEIVER_TYPE.GROUP
    );
    const m = await CometChat.sendMessage(msg);
    appendMessage(m, true);
  }

  // -----------------------------
  // 5) Login bar
  // -----------------------------
  function showLogin(show) {
    document.getElementById("coyLogin").style.display = show ? "flex" : "none";
    document.getElementById("coyUserLabel").textContent = show ? "" : `Logged in`;
  }

  function bindInputHandlers() {
    document.getElementById("coySend").onclick = () => {
      const inp = document.getElementById("coyText");
      sendActive(inp.value).catch(console.error);
      inp.value = "";
    };
    document.getElementById("coyText").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("coySend").click();
    });

    document.getElementById("loginBtn").onclick = async () => {
      const uid  = document.getElementById("loginUID").value.trim();
      const name = document.getElementById("loginName").value.trim() || uid;
      if (!uid) return alert("Please enter a UID");
      try {
        await createOrLogin(uid, name);
        loggedUser = { uid, name };
        document.getElementById("coyUserLabel").textContent = `${name} (${uid})`;
        showLogin(false);
        await postLoginSetup();
      } catch (e) {
        console.error(e);
        alert("Login failed. Check console.");
      }
    };
  }

  // -----------------------------
  // 6) After login: ensure groups & listeners
  // -----------------------------
  async function postLoginSetup() {
    // Make sure our 3 groups exist (no-op if they already exist)
    await Promise.all([
      ensureGroup(GROUPS.TEAM),
      ensureGroup(GROUPS.ANNOUNCEMENTS),
      ensureGroup(GROUPS.QUESTIONS),
    ]);

    // Join all to receive messages
    for (const g of [GROUPS.TEAM, GROUPS.ANNOUNCEMENTS, GROUPS.QUESTIONS]) {
      try { await CometChat.joinGroup(g.guid, CometChat.GROUP_TYPE.PUBLIC, ""); } catch {}
    }

    // Start listener & load default tab
    addLiveListener();
    setActiveTab(activeTab);
  }

  // -----------------------------
  // 7) Boot
  // -----------------------------
  async function boot() {
    injectStyles();
    createUI();
    bindInputHandlers();

    const u = currentUser();
    if (!u) {
      showLogin(true);
    } else {
      try {
        await CometChat.login(u.uid, AUTH_KEY);
        loggedUser = u;
        document.getElementById("coyUserLabel").textContent = `${u.name} (${u.uid})`;
        showLogin(false);
        await postLoginSetup();
      } catch {
        showLogin(true); // token expired or similar
      }
    }
  }

  // Load SDK → init → start
  loadSDK()
    .then(initCometChat)
    .then(boot)
    .catch((e) => {
      console.error(e);
      // If SDK fails to load, keep the bubble but make it say "offline"
      const root = ensureRoot();
      root.innerHTML = `<div style="position:fixed;right:18px;bottom:18px;background:#222;color:#fff;padding:10px 14px;border-radius:12px;border:1px solid #444;">Chat unavailable</div>`;
    });
})();
