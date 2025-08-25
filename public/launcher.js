/* ================= Coyotes Chat Launcher (CometChat SDK) =================
   File: /public/launcher.js  (served by Vercel at /launcher.js)
   Features:
   - Bottom-right red chat button (floating)
   - Popout panel with 3 tabs: Team / Coach Announcements / Questions
   - Unread badges per-tab + total on launcher
   - Login persistence (localStorage) per-device
   - Announcements read-only for non-coaches (UI-level)
   - Only render on selected paths if desired
========================================================================= */

/*** ===== CONFIG ===== ***/
const APP_ID   = "2808186f24275c0e";
const REGION   = "us";
const AUTH_KEY = "d20ca03513ab3c8c65c84f3429e7fd84a0deeb34";

/* Coaches (allowed to post in Announcements) */
const COACH_UIDS = ["coach_andrew", "agini"];

/* Optional: restrict widget to certain URL paths.
   Example: const ALLOWED_PATHS = ["/schedule","/school"];
   Leave [] to allow anywhere this script is included. */
const ALLOWED_PATHS = [];

/*** ===== DO NOT EDIT BELOW UNLESS CUSTOMIZING ===== ***/
(function CoyotesChat() {
  try {
    if (document.getElementById("coyotes-chat-root")) return; // avoid double-mount
    if (ALLOWED_PATHS.length && !ALLOWED_PATHS.includes(location.pathname)) return;

    // Root
    const root = document.createElement("div");
    root.id = "coyotes-chat-root";
    document.body.appendChild(root);

    // Styles
    const css = `
  :root{
    --cc-red:#D10F2F; --cc-red2:#C50E2C; --cc-ink:#EEEFF2; --cc-muted:#9EA3AB;
    --cc-panel:#101113; --cc-line:#24262B; --cc-dark:#0B0C0E; --cc-gray:#1C1E22;
    --cc-shadow:0 18px 50px rgba(0,0,0,.35);
  }
  #ccl-launcher{position:fixed; right:18px; bottom:18px; z-index:999999;
    width:64px;height:64px;border-radius:999px;border:1px solid #8E0C21;
    background:linear-gradient(180deg,var(--cc-red),var(--cc-red2));
    color:#fff; display:flex; align-items:center; justify-content:center;
    box-shadow:0 16px 38px rgba(209,15,47,.35); cursor:pointer; user-select:none}
  #ccl-launcher svg{pointer-events:none}
  #ccl-launcher .badge{position:absolute; top:-6px; right:-6px; min-width:20px; height:20px; padding:0 6px;
    display:inline-flex; align-items:center; justify-content:center;
    background:#E01538; color:#fff; border-radius:999px; font-size:11px; font-weight:800;
    border:1px solid rgba(255,255,255,.25); box-shadow:0 6px 18px rgba(209,15,47,.35)}
  #ccl-panel{position:fixed; right:18px; bottom:96px; width:360px; max-height:75vh; display:none; z-index:999999;
    border:1px solid var(--cc-line); border-radius:16px; overflow:hidden; background:linear-gradient(180deg,#111214,#0F1012);
    box-shadow:var(--cc-shadow); color:var(--cc-ink); font-family: ui-sans-serif,-apple-system,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial}
  #ccl-head{display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid var(--cc-line)}
  #ccl-tabs{display:flex; gap:6px; background:#0E0F11; border:1px solid var(--cc-line); border-radius:999px; padding:6px}
  #ccl-tabs button{position:relative; appearance:none;border:0;background:transparent;color:#9aa0a6;font-weight:700;padding:8px 12px;border-radius:999px;cursor:pointer}
  #ccl-tabs button.active{background:linear-gradient(180deg,var(--cc-red),var(--cc-red2)); color:#fff; box-shadow:0 8px 24px rgba(209,15,47,.35)}
  #ccl-tabs .tb-badge{position:absolute; transform:translate(10px,-8px); min-width:16px;height:16px;padding:0 4px;
    background:#E01538;color:#fff;border-radius:999px;font-size:10px;font-weight:800;border:1px solid rgba(255,255,255,.2)}
  #ccl-close{margin-left:auto; background:#0D0E10; border:1px solid var(--cc-line); color:#bbb; border-radius:10px; padding:6px 8px; cursor:pointer}
  #ccl-body{display:flex; flex-direction:column; gap:10px; padding:10px}
  #ccl-login{display:flex; flex-direction:column; gap:8px}
  #ccl-login input{width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--cc-line); background:#0B0C0E; color:var(--cc-ink)}
  #ccl-login .btn{padding:10px 12px; border-radius:10px; border:1px solid #8E0C21; background:linear-gradient(180deg,var(--cc-red),var(--cc-red2)); color:#fff; font-weight:800; cursor:pointer}
  #ccl-chat{display:flex; flex-direction:column; gap:10px}
  #ccl-msgs{flex:1; min-height:260px; max-height:48vh; overflow:auto; border:1px solid var(--cc-line);
    background:#0B0C0E; border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:8px}
  .ccl-row{display:flex; align-items:flex-end; gap:8px}
  .ccl-me{justify-content:flex-end}
  .ccl-bub{max-width:78%; padding:8px 10px; border-radius:16px; border:1px solid rgba(255,255,255,.05); line-height:1.25; font-size:14px}
  .ccl-bub.me{background:#E01538; color:#fff}
  .ccl-bub.their{background:#1C1E22; color:#e6e7ea}
  .ccl-meta{font-size:11px; color:#9aa0a6; margin-top:2px}
  #ccl-comp{display:flex; gap:8px; align-items:flex-end}
  #ccl-text{flex:1; height:44px; padding:10px 12px; border:1px solid var(--cc-line); border-radius:12px; outline:none; background:#0B0C0E; color:#EEEFF2}
  #ccl-send{padding:10px 12px; border-radius:12px; border:1px solid #8E0C21; background:linear-gradient(180deg,var(--cc-red),var(--cc-red2)); color:#fff; font-weight:800; cursor:pointer}
  .hidden{display:none!important}
    `;
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);

    // HTML
    root.innerHTML = `
      <button id="ccl-launcher" aria-label="Open chat">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M21 12c0 4.418-4.03 8-9 8-1.16 0-2.27-.19-3.27-.54L3 20l.99-4.45C3.37 14.27 3 13.16 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" stroke="white" stroke-width="1.6" fill="none"/></svg>
        <span id="ccl-badge" class="badge hidden">0</span>
      </button>
      <div id="ccl-panel" role="dialog" aria-modal="true">
        <div id="ccl-head">
          <div id="ccl-tabs">
            <button id="tb-team" class="active">Team<span id="bdg-team" class="tb-badge hidden">0</span></button>
            <button id="tb-ann">Announcements<span id="bdg-ann" class="tb-badge hidden">0</span></button>
            <button id="tb-qna">Questions<span id="bdg-qna" class="tb-badge hidden">0</span></button>
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

    // Shortcuts
    const qs = (s) => document.querySelector(s);
    const $L = qs("#ccl-launcher"), $Badge = qs("#ccl-badge");
    const $P = qs("#ccl-panel"), $Close = qs("#ccl-close");
    const $Msgs = qs("#ccl-msgs"), $Text = qs("#ccl-text"), $Send = qs("#ccl-send"), $Note = qs("#ccl-note");
    const $Login = qs("#ccl-login"), $LGUID = qs("#lg-uid"), $LGNAME = qs("#lg-name"), $LGGO = qs("#lg-go");
    const $TBTeam = qs("#tb-team"), $TBAnn = qs("#tb-ann"), $TBQna = qs("#tb-qna");
    const $BTeam = qs("#bdg-team"), $BAnn = qs("#bdg-ann"), $BQna = qs("#bdg-qna");

    // Data
    const GROUPS = {
      team: {id:"team_chat", name:"Team Chat", note:"Anyone can post."},
      ann:  {id:"announcements", name:"Coach Announcements", note:"Only coaches can post here."},
      qna:  {id:"questions", name:"Questions", note:"Ask and answer out loud."}
    };
    let activeKey = "team";
    let me = {uid:null, name:null, token:null};
    let unread = {team:0, ann:0, qna:0};

    // Utils
    const isCoach = (uid) => COACH_UIDS.includes(uid);
    const fmt = (ts) => { try{ const d=new Date(ts*1000||ts); return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}catch{return "";} };
    const setBadge = (key,val) => {
      unread[key] = Math.max(0,val|0);
      const map = {team:$BTeam, ann:$BAnn, qna:$BQna};
      const el = map[key];
      if (unread[key]>0){ el.textContent = unread[key]; el.classList.remove("hidden"); }
      else { el.classList.add("hidden"); }
      const total = unread.team+unread.ann+unread.qna;
      if (total>0){ $Badge.textContent=total; $Badge.classList.remove("hidden"); }
      else { $Badge.classList.add("hidden"); }
    };
    const setActiveTab = (key) => {
      activeKey = key;
      $TBTeam.classList.toggle("active", key==="team");
      $TBAnn.classList.toggle("active",  key==="ann");
      $TBQna.classList.toggle("active",  key==="qna");
      setBadge(key, 0); // clear when viewing
    };
    const rowText = (text,fromMe,sender,ts) => {
      const r=document.createElement("div"); r.className="ccl-row"+(fromMe?" ccl-me":"");
      const b=document.createElement("div"); b.className="ccl-bub "+(fromMe?"me":"their"); b.textContent=text;
      const m=document.createElement("div"); m.className="ccl-meta"; m.textContent=fromMe?fmt(ts):`${sender?.name||sender?.uid||"Unknown"} • ${fmt(ts)}`;
      const wrap=document.createElement("div"); wrap.appendChild(b); wrap.appendChild(m);
      r.appendChild(wrap); $Msgs.appendChild(r); $Msgs.scrollTop=$Msgs.scrollHeight;
    };

    // Load SDK
    function loadSDK(){
      return new Promise((resolve,reject)=>{
        if (window.CometChat) return resolve();
        const s=document.createElement("script");
        s.src="https://unpkg.com/@cometchat-pro/chat/CometChat.js";
        s.onload=resolve; s.onerror=()=>reject(new Error("CometChat SDK failed to load"));
        document.head.appendChild(s);
      });
    }
    async function initSDK(){
      const settings=new CometChat.AppSettingsBuilder()
        .subscribePresenceForAllUsers()
        .setRegion(REGION)
        .autoEstablishSocketConnection(true)
        .build();
      await CometChat.init(APP_ID,settings);
    }

    // CometChat helpers
    async function ensureGroup(gid,title){
      try{await CometChat.getGroup(gid);}
      catch{const g=new CometChat.Group(gid,title,CometChat.GROUP_TYPE.PUBLIC); await CometChat.createGroup(g);}
      try{await CometChat.joinGroup(gid,CometChat.GROUP_TYPE.PUBLIC,"");}catch{}
    }
    async function loadHistory(gid){
      $Msgs.innerHTML="";
      const req = new CometChat.MessagesRequestBuilder().setGUID(gid).setLimit(40).build();
      const hist = await req.fetchPrevious();
      hist.reverse().forEach(msg=>{
        const fromMe = msg.getSender()?.uid===me.uid;
        if(msg.getCategory()==="message" && msg.getType()==="text"){
          rowText(msg.getText(), fromMe, msg.getSender(), msg.getSentAt());
        }
      });
    }
    function attachListener(gid){
      CometChat.removeMessageListener("cclistener");
      CometChat.addMessageListener("cclistener", new CometChat.MessageListener({
        onTextMessageReceived: (msg)=>{
          if(msg.getReceiverType()!=="group") return;
          const roomId = msg.getReceiver().guid;
          const fromMe = msg.getSender().uid===me.uid;
          if(roomId===gid){
            rowText(msg.getText(), fromMe, msg.getSender(), msg.getSentAt());
            setBadge(activeKey,0);
          }else if(!fromMe){
            if(roomId===GROUPS.team.id) setBadge("team", unread.team+1);
            if(roomId===GROUPS.ann.id)  setBadge("ann",  unread.ann+1);
            if(roomId===GROUPS.qna.id)  setBadge("qna",  unread.qna+1);
          }
        }
      }));
    }
    async function openRoom(key){
      setActiveTab(key);
      const room = GROUPS[key];
      const ro = (key==="ann" && !isCoach(me.uid));
      $Text.disabled = ro; $Send.disabled = ro;
      $Text.placeholder = ro ? "Read-only: coaches only" : "Message… (Enter to send)";
      await ensureGroup(room.id, room.name);
      await loadHistory(room.id);
      attachListener(room.id);
    }
    async function unreadInit(){
      try{const c=await CometChat.getUnreadMessageCountForGroup(GROUPS.team.id); if(c) setBadge("team",c);}catch{}
      try{const c=await CometChat.getUnreadMessageCountForGroup(GROUPS.ann.id);  if(c) setBadge("ann",c);}catch{}
      try{const c=await CometChat.getUnreadMessageCountForGroup(GROUPS.qna.id);  if(c) setBadge("qna",c);}catch{}
    }

    // Login persistence
    async function login(uid,name){
      try{await CometChat.login(uid,AUTH_KEY);}
      catch{const u=new CometChat.User(uid); u.setName(name); await CometChat.createUser(u,AUTH_KEY); await CometChat.login(uid,AUTH_KEY);}
      const user=await CometChat.getLoggedinUser();
      me={uid,name,token:user?.authToken||null};
      localStorage.setItem("ct_uid",uid);
      localStorage.setItem("ct_name",name);
      if(me.token) localStorage.setItem("ct_token",me.token);
    }
    async function restore(){
      const uid=localStorage.getItem("ct_uid");
      const name=localStorage.getItem("ct_name");
      const token=localStorage.getItem("ct_token");
      if(!uid) return false;
      try{
        if(token) await CometChat.loginWithAuthToken(token);
        else await CometChat.login(uid,AUTH_KEY);
        me={uid,name,token:token||null};
        return true;
      }catch{ localStorage.removeItem("ct_token"); return false; }
    }

    // Wire base UI
    const togglePanel = () => { $P.style.display = ($P.style.display==="block" ? "none" : "block"); };
    $L.onclick = togglePanel;
    $Close.onclick = togglePanel;

    $TBTeam.onclick = ()=>openRoom("team");
    $TBAnn.onclick  = ()=>openRoom("ann");
    $TBQna.onclick  = ()=>openRoom("qna");

    $Send.onclick = async ()=>{
      const t = $Text.value.trim(); if(!t) return;
      const room = GROUPS[activeKey];
      const msg = new CometChat.TextMessage(room.id, t, CometChat.RECEIVER_TYPE.GROUP);
      await CometChat.sendMessage(msg);
      $Text.value = "";
    };
    $Text.addEventListener("keydown", e=>{
      if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); $Send.click(); }
    });

    // Boot
    (async ()=>{
      try{
        await loadSDK(); await initSDK();
        const restored = await restore();
        if(restored){
          $Login.classList.add("hidden");
          await openRoom(activeKey);
          await unreadInit();
        }else{
          $Login.classList.remove("hidden");
        }
      }catch(e){
        console.error("Chat init failed", e);
        alert("Chat failed to initialize.");
      }
    })();
  } catch(e) {
    console.error("Coyotes Chat Launcher error:", e);
  }
})();
