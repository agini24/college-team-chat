/* ================== Coyotes Chat Launcher (Production) ==================
   File: /public/launcher.js   (Vercel serves it at /launcher.js)

   Key features:
   - Ultra-light bootstrap: inject a small red button; init the chat only on first click
   - Full iMessage-style panel with 3 tabs: Team / Announcements / Questions
   - Unread badges per tab + a total badge on the launcher
   - Login persistence (localStorage) per device (UID + name + auth token)
   - Announcements read-only for non-coaches (UI); enforce in dashboard if desired
   - Works on Squarespace via a single <script src=...> tag
   - Optional: host CometChat SDK from Vercel to avoid CDN/corporate blockers

   Customize below in CONFIG.
========================================================================= */

/*** ===== CONFIG ===== ***/
const CC_APP_ID   = "2808186f24275c0e";
const CC_REGION   = "us";
const CC_AUTH_KEY = "d20ca03513ab3c8c65c84f3429e7fd84a0deeb34";

const COACH_UIDS = ["coach_andrew", "agini"];      // who can post in Announcements
const GROUPS = {
  team: { id: "team_chat",     name: "Team Chat",           note: "Anyone can post." },
  ann:  { id: "announcements", name: "Coach Announcements", note: "Only coaches can post here." },
  qna:  { id: "questions",     name: "Questions",           note: "Ask and answer out loud." }
};

/* Only render on these pathnames (e.g., "/wbb", "/school"). Leave [] to allow anywhere Squarespace includes the snippet. */
const ALLOWED_PATHS = [];

/* Where to load the CometChat SDK from.
   - CDN (default): "https://unpkg.com/@cometchat-pro/chat/CometChat.js"
   - OR host it yourself (recommended for reliability):
       1) Download CometChat.js and put it at: /public/vendor/CometChat.js
       2) Set SDK_SRC = "/vendor/CometChat.js"
*/
const SDK_SRC = "https://unpkg.com/@cometchat-pro/chat/CometChat.js"; // or "/vendor/CometChat.js"

/*** ===== Bootstrap: add launcher button immediately, load the rest on demand ===== ***/
(function bootstrap(){
  try {
    if (ALLOWED_PATHS.length && !ALLOWED_PATHS.includes(location.pathname)) return;
    if (document.getElementById("coyotes-chat-root")) {
      // If a container exists from Squarespace markup, use it; otherwise create one.
      const already = document.getElementById("cc-launcher-btn");
      if (already) return;
    }

    // Create a minimal root if Squarespace didn’t add one
    let host = document.getElementById("coyotes-chat-root");
    if (!host) {
      host = document.createElement("div");
      host.id = "coyotes-chat-root";
      document.body.appendChild(host);
    }

    // Styles just for the launcher
    const css = `
      :root{--cc-red:#D10F2F;--cc-red2:#C50E2C;}
      #cc-launcher-btn{position:fixed;right:18px;bottom:18px;z-index:999999;width:64px;height:64px;border-radius:999px;border:1px solid #8E0C21;
        background:linear-gradient(180deg,var(--cc-red),var(--cc-red2));color:#fff;display:flex;align-items:center;justify-content:center;
        box-shadow:0 16px 38px rgba(209,15,47,.35);cursor:pointer;user-select:none}
      #cc-launcher-btn svg{pointer-events:none}
      #cc-launcher-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;display:none;align-items:center;justify-content:center;
        background:#E01538;color:#fff;border-radius:999px;font-size:11px;font-weight:800;border:1px solid rgba(255,255,255,.25)}
      #cc-launcher-btn.has-badge #cc-launcher-badge{display:inline-flex}
    `;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

    // Button HTML
    host.insertAdjacentHTML("beforeend", `
      <button id="cc-launcher-btn" aria-label="Open chat">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M21 12c0 4.418-4.03 8-9 8-1.16 0-2.27-.19-3.27-.54L3 20l.99-4.45C3.37 14.27 3 13.16 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" stroke="white" stroke-width="1.6" fill="none"/></svg>
        <span id="cc-launcher-badge">0</span>
      </button>
      <div id="cc-panel-mount"></div>
    `);

    // Load the heavy stuff only on the first click
    const btn = document.getElementById("cc-launcher-btn");
    btn.addEventListener("click", async ()=>{
      btn.disabled = true;
      await initChatOnce();
      togglePanel(true);
      btn.disabled = false;
    }, { once: true });

  } catch(e) { console.error("Launcher bootstrap error", e); }
})();

/*** ===== One-time chat init ===== ***/
let __chatReady = false;
let __state = {
  me: { uid: null, name: null, token: null },
  activeKey: "team",
  unread: { team:0, ann:0, qna:0 }
};
let __els = {}; // refs

async function initChatOnce(){
  if (__chatReady) return;
  await loadSDK();
  await initSDK();

  renderPanel();       // build UI
  wirePanelHandlers(); // events & actions
  await tryRestore();  // auto-login if possible
  await openRoom(__state.activeKey);
  await bootUnread();

  __chatReady = true;
}

/*** ===== Utils & SDK helpers ===== ***/
function loadSDK(){
  return new Promise((res, rej)=>{
    if (window.CometChat) return res();
    const s = document.createElement("script");
    s.src = SDK_SRC; s.defer = true;
    s.onload = res; s.onerror = ()=>rej(new Error("CometChat SDK failed to load from: " + SDK_SRC));
    document.head.appendChild(s);
  });
}

async function initSDK(){
  const settings = new CometChat.AppSettingsBuilder()
    .subscribePresenceForAllUsers()
    .setRegion(CC_REGION)
    .autoEstablishSocketConnection(true)
    .build();
  await CometChat.init(CC_APP_ID, settings);
}

function isCoach(uid){ return COACH_UIDS.includes(uid); }
function fmt(ts){ try{ const d=new Date(ts*1000||ts); return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}catch{return "";} }
function setTabBadge(key,val){
  __state.unread[key] = Math.max(0, val|0);
  const map = { team:__els.bTeam, ann:__els.bAnn, qna:__els.bQna };
  const el = map[key];
  if (!el) return;
  if (__state.unread[key] > 0){ el.textContent = __state.unread[key]; el.style.display="inline-flex"; }
  else { el.style.display="none"; }
  // global badge on launcher
  const total = __state.unread.team + __state.unread.ann + __state.unread.qna;
  const btn = document.getElementById("cc-launcher-btn");
  const b = document.getElementById("cc-launcher-badge");
  if (total > 0){ b.textContent = total; btn.classList.add("has-badge"); }
  else { btn.classList.remove("has-badge"); }
}

async function ensureGroup(gid, title){
  try { await CometChat.getGroup(gid); }
  catch { const g = new CometChat.Group(gid, title, CometChat.GROUP_TYPE.PUBLIC); await CometChat.createGroup(g); }
  try { await CometChat.joinGroup(gid, CometChat.GROUP_TYPE.PUBLIC, ""); } catch{}
}

async function loadHistory(gid){
  __els.msgs.innerHTML = "";
  const req = new CometChat.MessagesRequestBuilder().setGUID(gid).setLimit(50).build();
  const hist = await req.fetchPrevious();
  hist.reverse().forEach(m=>{
    const fromMe = m.getSender()?.uid === __state.me.uid;
    if (m.getCategory()==="message" && m.getType()==="text"){
      addTextRow(m.getText(), fromMe, m.getSender(), m.getSentAt());
    }
  });
  __els.msgs.scrollTop = __els.msgs.scrollHeight;
}

function addTextRow(text, fromMe, sender, ts){
  const r = document.createElement("div");
  r.className = "ccl-row" + (fromMe?" ccl-me":"");
  const b = document.createElement("div");
  b.className = "ccl-bub " + (fromMe?"me":"their");
  b.textContent = text;
  const meta = document.createElement("div");
  meta.className = "ccl-meta";
  meta.textContent = fromMe ? fmt(ts) : `${sender?.name||sender?.uid||"Unknown"} • ${fmt(ts)}`;
  const wrap = document.createElement("div"); wrap.appendChild(b); wrap.appendChild(meta);
  r.appendChild(wrap); __els.msgs.appendChild(r);
}

function listenTo(gid){
  CometChat.removeMessageListener("cc-listener");
  CometChat.addMessageListener("cc-listener",
    new CometChat.MessageListener({
      onTextMessageReceived: (m)=>{
        if (m.getReceiverType()!=="group") return;
        const roomId = m.getReceiver().guid;
        const fromMe = m.getSender().uid === __state.me.uid;
        if (roomId === gid){
          addTextRow(m.getText(), fromMe, m.getSender(), m.getSentAt());
          setTabBadge(__state.activeKey, 0); // viewing -> read
          __els.msgs.scrollTop = __els.msgs.scrollHeight;
        } else if (!fromMe){
          if (roomId===GROUPS.team.id) setTabBadge("team", __state.unread.team+1);
          if (roomId===GROUPS.ann.id)  setTabBadge("ann",  __state.unread.ann+1);
          if (roomId===GROUPS.qna.id)  setTabBadge("qna",  __state.unread.qna+1);
        }
      }
    })
  );
}

async function openRoom(key){
  __state.activeKey = key;
  __els.tbTeam.classList.toggle("active", key==="team");
  __els.tbAnn.classList.toggle("active",  key==="ann");
  __els.tbQna.classList.toggle("active",  key==="qna");
  setTabBadge(key, 0);

  const room = GROUPS[key];
  __els.note.textContent = room.note;

  const readOnly = (key==="ann" && !isCoach(__state.me.uid));
  __els.text.disabled = readOnly; __els.send.disabled = readOnly;
  __els.text.placeholder = readOnly ? "Read-only: coaches only" : "Message… (Enter to send)";

  await ensureGroup(room.id, room.name);
  await loadHistory(room.id);
  listenTo(room.id);
}

async function bootUnread(){
  try { const c = await CometChat.getUnreadMessageCountForGroup(GROUPS.team.id); if (c) setTabBadge("team", c); } catch {}
  try { const c = await CometChat.getUnreadMessageCountForGroup(GROUPS.ann.id);  if (c) setTabBadge("ann",  c); } catch {}
  try { const c = await CometChat.getUnreadMessageCountForGroup(GROUPS.qna.id);  if (c) setTabBadge("qna",  c); } catch {}
}

async function doLogin(uid, name){
  try { await CometChat.login(uid, CC_AUTH_KEY); }
  catch {
    const u = new CometChat.User(uid); u.setName(name);
    await CometChat.createUser(u, CC_AUTH_KEY);
    await CometChat.login(uid, CC_AUTH_KEY);
  }
  const user = await CometChat.getLoggedinUser();
  __state.me = { uid, name, token: user?.authToken || null };
  localStorage.setItem("ct_uid", uid);
  localStorage.setItem("ct_name", name);
  if (__state.me.token) localStorage.setItem("ct_token", __state.me.token);
}

async function tryRestore(){
  const uid = localStorage.getItem("ct_uid");
  const name = localStorage.getItem("ct_name");
  const token = localStorage.getItem("ct_token");
  if (!uid) { showLogin(true); return; }
  try {
    if (token) await CometChat.loginWithAuthToken(token);
    else await CometChat.login(uid, CC_AUTH_KEY);
    __state.me = { uid, name, token: token || null };
    showLogin(false);
  } catch {
    localStorage.removeItem("ct_token");
    showLogin(true);
  }
}

/*** ===== UI (panel) ===== ***/
function renderPanel(){
  // Panel CSS (scoped)
  const css = `
  :root{
    --cc-ink:#EEEFF2;--cc-muted:#9EA3AB;--cc-line:#24262B;--cc-red:#D10F2F;--cc-red2:#C50E2C;
    --cc-bg1:#111214;--cc-bg2:#0F1012;
  }
  #ccl-panel{position:fixed;right:18px;bottom:96px;width:360px;max-height:75vh;display:none;z-index:999999;border:1px solid var(--cc-line);border-radius:16px;overflow:hidden;background:linear-gradient(180deg,var(--cc-bg1),var(--cc-bg2));color:var(--cc-ink);font-family:ui-sans-serif,-apple-system,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial}
  #ccl-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--cc-line)}
  #ccl-tabs{display:flex;gap:6px;background:#0E0F11;border:1px solid var(--cc-line);border-radius:999px;padding:6px}
  #ccl-tabs button{position:relative;appearance:none;border:0;background:transparent;color:#9aa0a6;font-weight:700;padding:8px 12px;border-radius:999px;cursor:pointer}
  #ccl-tabs button.active{background:linear-gradient(180deg,var(--cc-red),var(--cc-red2));color:#fff;box-shadow:0 8px 24px rgba(209,15,47,.35)}
  .tb-badge{position:absolute;transform:translate(10px,-8px);min-width:16px;height:16px;padding:0 4px;background:#E01538;color:#fff;border-radius:999px;font-size:10px;font-weight:800;border:1px solid rgba(255,255,255,.2);display:none;align-items:center;justify-content:center}
  #ccl-close{margin-left:auto;background:#0D0E10;border:1px solid var(--cc-line);color:#bbb;border-radius:10px;padding:6px 8px;cursor:pointer}
  #ccl-body{display:flex;flex-direction:column;gap:10px;padding:10px}
  #ccl-login{display:flex;flex-direction:column;gap:8px}
  #ccl-login input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--cc-line);background:#0B0C0E;color:#EEEFF2}
  #ccl-login .btn{padding:10px 12px;border-radius:10px;border:1px solid #8E0C21;background:linear-gradient(180deg,var(--cc-red),var(--cc-red2));color:#fff;font-weight:800;cursor:pointer}
  #ccl-chat{display:flex;flex-direction:column;gap:10px}
  #ccl-msgs{flex:1;min-height:260px;max-height:48vh;overflow:auto;border:1px solid var(--cc-line);background:#0B0C0E;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}
  .ccl-row{display:flex;align-items:flex-end;gap:8px}.ccl-me{justify-content:flex-end}
  .ccl-bub{max-width:78%;padding:8px 10px;border-radius:16px;border:1px solid rgba(255,255,255,.05);line-height:1.25;font-size:14px}
  .ccl-bub.me{background:#E01538;color:#fff}.ccl-bub.their{background:#1C1E22;color:#e6e7ea}
  .ccl-meta{font-size:11px;color:#9aa0a6;margin-top:2px}
  #ccl-comp{display:flex;gap:8px;align-items:flex-end}
  #ccl-text{flex:1;height:44px;padding:10px 12px;border:1px solid var(--cc-line);border-radius:12px;outline:none;background:#0B0C0E;color:#EEEFF2}
  #ccl-send{padding:10px 12px;border-radius:12px;border:1px solid #8E0C21;background:linear-gradient(180deg,var(--cc-red),var(--cc-red2));color:#fff;font-weight:800;cursor:pointer}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const mount = document.getElementById("cc-panel-mount");
  mount.innerHTML = `
    <div id="ccl-panel" role="dialog" aria-modal="true">
      <div id="ccl-head">
        <div id="ccl-tabs">
          <button id="tb-team" class="active">Team<span id="bdg-team" class="tb-badge">0</span></button>
          <button id="tb-ann">Announcements<span id="bdg-ann" class="tb-badge">0</span></button>
          <button id="tb-qna">Questions<span id="bdg-qna" class="tb-badge">0</span></button>
        </div>
        <button id="ccl-close">Close</button>
      </div>
      <div id="ccl-body">
        <div id="ccl-login" class="hidden">
          <input id="lg-uid" placeholder="UID (e.g., p_john)" />
          <input id="lg-name" placeholder="Display name" />
          <button id="lg-go" class="btn">Log in</button>
        </div>
        <div id="ccl-chat">
          <div id="ccl-msgs"></div>
          <div id="ccl-comp">
            <textarea id="ccl-text" placeholder="Message… (Enter to send)"></textarea>
            <button id="ccl-send">Send</button>
          </div>
          <div class="ccl-meta" id="ccl-note"></div>
        </div>
      </div>
    </div>
  `;

  // Refs
  __els = {
    panel: document.getElementById("ccl-panel"),
    close: document.getElementById("ccl-close"),
    tbTeam: document.getElementById("tb-team"),
    tbAnn:  document.getElementById("tb-ann"),
    tbQna:  document.getElementById("tb-qna"),
    bTeam:  document.getElementById("bdg-team"),
    bAnn:   document.getElementById("bdg-ann"),
    bQna:   document.getElementById("bdg-qna"),
    login:  document.getElementById("ccl-login"),
    uid:    document.getElementById("lg-uid"),
    name:   document.getElementById("lg-name"),
    go:     document.getElementById("lg-go"),
    msgs:   document.getElementById("ccl-msgs"),
    text:   document.getElementById("ccl-text"),
    send:   document.getElementById("ccl-send"),
    note:   document.getElementById("ccl-note"),
  };
}

function wirePanelHandlers(){
  const btn = document.getElementById("cc-launcher-btn");
  __els.close.addEventListener("click", ()=>togglePanel(false));
  btn.addEventListener("click", ()=>togglePanel(true));

  __els.tbTeam.addEventListener("click", ()=>openRoom("team"));
  __els.tbAnn.addEventListener("click",  ()=>openRoom("ann"));
  __els.tbQna.addEventListener("click",  ()=>openRoom("qna"));

  __els.send.addEventListener("click", sendText);
  __els.text.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendText(); }
  });

  __els.go.addEventListener("click", async ()=>{
    const uid = __els.uid.value.trim();
    const name= __els.name.value.trim();
    if(!uid || !name) return alert("Enter UID & Display name");
    __els.go.disabled = true;
    try{
      await doLogin(uid, name);
      showLogin(false);
      await openRoom(__state.activeKey);
      await bootUnread();
    } finally { __els.go.disabled = false; }
  });
}

function togglePanel(open){
  __els.panel.style.display = open ? "block" : "none";
}

function showLogin(show){
  __els.login.classList.toggle("hidden", !show);
  __els.text.disabled = show;
  __els.send.disabled = show;
  __els.text.placeholder = show ? "Log in to chat" : "Message… (Enter to send)";
}

async function sendText(){
  const t = __els.text.value.trim(); if(!t) return;
  const room = GROUPS[__state.activeKey];
  const msg = new CometChat.TextMessage(room.id, t, CometChat.RECEIVER_TYPE.GROUP);
  await CometChat.sendMessage(msg);
  __els.text.value = "";
}
