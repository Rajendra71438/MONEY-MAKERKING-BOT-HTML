// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = "https://udijhlluttujhhvfdzlv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkaWpobGx1dHR1amhodmZkemx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTM4NTQsImV4cCI6MjA5NjEyOTg1NH0.GGz_bXqWZWhfImHHkned9jkLBs7wGaKAj1P5OvlY29I";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ===============================================================

// ==================== TELEGRAM ====================
const tg = window.Telegram?.WebApp;
const initUser = tg?.initDataUnsafe?.user || {first_name:"Demo",last_name:"User",username:"demo_user",photo_url:null};
const user = {
  id: initUser.id?.toString() || "demo",
  first_name: initUser.first_name || "Demo",
  last_name: initUser.last_name || "",
  username: initUser.username || "demo_user",
  photo_url: initUser.photo_url || null
};
if(tg){tg.ready();tg.expand();tg.setHeaderColor("#0a0600");tg.setBackgroundColor("#0a0600")}

// ==================== BACKEND (Supabase) ====================
const MASTER_UID = "164890";
let deviceId = localStorage.getItem("device_id") || ("dev_"+Math.random().toString(36).slice(2)+Date.now());
localStorage.setItem("device_id", deviceId);

const ADMIN_PASSWORD = "raj@123";

async function mockVerify(uid) {
  await new Promise(r => setTimeout(r, 1900));
  if (uid === MASTER_UID) return { ok: true };

  const { data, error } = await sb
    .from("uids")
    .select("*")
    .eq("uid", uid)
    .limit(1);

  if (error) {
    console.error("Supabase verify error:", error);
    return { ok: false, reason: "error" };
  }

  const entry = data && data.length > 0 ? data[0] : null;
  if (!entry || !entry.active) {
    return { ok: false, reason: "not_verified" };
  }

  if (entry.device_id && entry.device_id !== deviceId) {
    return { ok: false, reason: "device_mismatch" };
  }

  if (!entry.device_id) {
    const { error: updateErr } = await sb
      .from("uids")
      .update({ device_id: deviceId })
      .eq("uid", uid);
    if (updateErr) {
      console.error("Failed to bind device:", updateErr);
      return { ok: false, reason: "error" };
    }
  }

  return { ok: true };
}

async function mockPredict(period, type) {
  await new Promise(r => setTimeout(r, 950));
  const seed = (parseInt(period) || 1) * 3 + 7;
  if (type === "number") return { value: String(seed % 10) };
  return { value: seed % 2 === 0 ? "BIG" : "SMALL" };
}

// ==================== ADMIN FUNCTIONS ====================
async function fetchAdminUIDs() {
  const { data, error } = await sb.from("uids").select("*");
  if (error) { console.error("Fetch UIDs error:", error); return []; }
  return data || [];
}
async function addAdminUID(uid) {
  const { error } = await sb.from("uids").insert({ uid, active: true });
  if (error) throw new Error(error.message);
}
async function toggleAdminUID(uid) {
  const { data, error } = await sb.from("uids").select("active").eq("uid", uid).limit(1);
  if (error || !data.length) throw new Error(error?.message || "UID not found");
  const newActive = !data[0].active;
  const { error: updateError } = await sb.from("uids").update({ active: newActive }).eq("uid", uid);
  if (updateError) throw new Error(updateError.message);
}
async function deleteAdminUID(uid) {
  const { error } = await sb.from("uids").delete().eq("uid", uid);
  if (error) throw new Error(error.message);
}

// ==================== STATE ====================
let S = {
  screen:"splash", option:null, uid:"",
  verifiedUid:null, failReason:"", period:"",
  prediction:null, loading:false, procStep:0,
  adminOpen:false, adminSearch:"",
  adminUIDs:[]
};

function haptic(t){if(tg?.HapticFeedback)tg.HapticFeedback.impactOccurred(t)}
function go(s){S.screen=s;render()}
function chooseOption(o){S.option=o;S.prediction=null;S.period="";go(S.verifiedUid?"prediction":"uid")}
function typeUid(d){S.uid=(S.uid+d).slice(0,20);render()}
function delUid(){S.uid=S.uid.slice(0,-1);render()}
async function submitUid(){
  if(!S.uid){shake("uid-disp");haptic("error");return}
  S.procStep=0;go("processing");
  setTimeout(()=>{S.procStep=1;render()},750);
  setTimeout(()=>{S.procStep=2;render()},1450);
  const res=await mockVerify(S.uid);
  if(res.ok){S.verifiedUid=S.uid;go("prediction")}
  else{S.failReason=res.reason;go("result")}
}
function typePeriod(d){if(S.period.length<3){S.period+=d;render()}}
function delPeriod(){S.period=S.period.slice(0,-1);render()}
async function submitPeriod(){
  if(S.period.length<3){shake("period-disp");haptic("error");return}
  S.loading=true;render();
  const p=await mockPredict(S.period,S.option);
  if(p)S.prediction=p;
  S.loading=false;render();
}
function switchOpt(o){S.option=o;S.prediction=null;S.period="";render()}
function resetHome(){S={...S,screen:"home",option:null,uid:"",period:"",prediction:null,failReason:"",loading:false,procStep:0,adminOpen:false,adminSearch:"",adminUIDs:[]};render()}
function retryUid(){S.failReason="";go("uid")}
function shake(id){const el=document.getElementById(id);if(el){el.style.animation="shake 0.4s ease";setTimeout(()=>el.style.animation="",400)}}

// ==================== ADMIN PANEL ====================
async function openAdmin(){
  const p = prompt("🔐 Admin password:");
  if (!p) return;
  if (p !== ADMIN_PASSWORD) { alert("Wrong password"); return; }
  S.adminUIDs = await fetchAdminUIDs();
  S.adminOpen = true;
  render();
}
function closeAdmin(){S.adminOpen=false;render()}
async function addUID(){
  const inp=document.getElementById("new-uid-inp");
  const uid=inp.value.trim();
  if(!uid||!/^\d+$/.test(uid)){alert("Digits only");return}
  try {
    await addAdminUID(uid);
    inp.value="";
    S.adminUIDs = await fetchAdminUIDs();
    render();
  } catch(e){ alert("Error: "+e.message); }
}
async function toggleUID(uid){
  try {
    await toggleAdminUID(uid);
    S.adminUIDs = await fetchAdminUIDs();
    render();
  } catch(e){ alert("Error: "+e.message); }
}
async function deleteUID(uid){
  if(confirm("Delete?")){
    try {
      await deleteAdminUID(uid);
      S.adminUIDs = await fetchAdminUIDs();
      render();
    } catch(e){ alert("Error: "+e.message); }
  }
}

// ==================== VOICE ====================
function playVoiceNotice() {
  try {
    const audio = new Audio('voice.ogg');
    audio.play().catch(e => console.warn("Audio play blocked:", e));
  } catch(e){}
}

function playVoice1() {
  try {
    const audio = new Audio('voice1.ogg');
    audio.play().catch(e => console.warn("Audio voice1 play blocked:", e));
  } catch(e){}
}

let voice1Played = false;

// ==================== PARTICLE BACKGROUND ====================
function initParticles() {
  const existing = document.getElementById("particles-canvas");
  if (existing) existing.remove();

  const canvas = document.createElement("canvas");
  canvas.id = "particles-canvas";
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext("2d");
  let W = canvas.width = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  const particles = Array.from({length: 55}, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.8 + 0.4,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35 - 0.15,
    life: Math.random(),
    speed: Math.random() * 0.004 + 0.002,
    color: Math.random() > 0.5 ? "245,200,66" : Math.random() > 0.5 ? "255,140,0" : "230,57,70"
  }));

  function frame() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.life += p.speed;
      if(p.life > 1) { p.life = 0; p.x = Math.random() * W; p.y = H + 10; }
      p.x += p.vx;
      p.y += p.vy;
      const alpha = Math.sin(p.life * Math.PI) * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(frame);
  }
  frame();
}

// ==================== ICONS ====================
const ICONS = {
  shield:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  check:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  arrow:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  back:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  del:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 5H8L2 12l6 7h13a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>`,
  external:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  card:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 14h4"/></svg>`,
  star:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  chart:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  msg:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  lock:`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  warn:`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

// ==================== RENDER ====================
function renderSplash(){
  const fl = user.first_name[0]?.toUpperCase()||"D";
  const av = user.photo_url
    ? `<img src="${user.photo_url}" class="avatar-img" referrerpolicy="no-referrer">`
    : `<div class="avatar-fb">${fl}</div>`;

  return `<div id="splash">
    <!-- Hex background decoration -->
    <svg class="splash-hex-bg" viewBox="0 0 340 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="170,10 320,95 320,245 170,330 20,245 20,95" stroke="rgba(245,200,66,1)" stroke-width="1" fill="none"/>
      <polygon points="170,35 295,107 295,233 170,305 45,233 45,107" stroke="rgba(255,140,0,1)" stroke-width="0.7" fill="none"/>
      <polygon points="170,60 270,119 270,221 170,280 70,221 70,119" stroke="rgba(230,57,70,1)" stroke-width="0.5" fill="none"/>
    </svg>

    <div class="splash-top" style="animation:fadeDown .6s ease-out both">
      <div class="splash-badge"><span class="splash-badge-dot"></span>PREMIUM BOT</div>
      <div class="splash-title">𝕀ℕ999<br>Sureshot</div>
      <div class="splash-sub">India's Elite Colour Prediction</div>
    </div>

    <div class="crown-scene" style="animation:fadeIn .7s ease-out .15s both">
      <div class="crown-icon">👑</div>
      <div class="avatar-ring-wrap">
        <svg class="avatar-ring-svg" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="65" cy="65" r="58" stroke="url(#ringGrad)" stroke-width="1.5" stroke-dasharray="6 4"/>
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="130" y2="130" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#f5c842"/>
              <stop offset="50%" stop-color="#ff8c00"/>
              <stop offset="100%" stop-color="#e63946"/>
            </linearGradient>
          </defs>
        </svg>
        ${av}
        <div class="avatar-verified">✓</div>
      </div>
    </div>

    <div style="text-align:center;animation:fadeUp .5s ease-out .25s both">
      <div class="splash-user-name">${user.first_name} ${user.last_name}</div>
      <div class="splash-user-handle">@${user.username}</div>
    </div>

    <div class="splash-progress" style="animation:fadeUp .5s ease-out .35s both">
      <div class="prog-label"><span>INITIALIZING SYSTEM</span><span id="pct">0%</span></div>
      <div class="prog-track"><div class="prog-fill" id="pfill"></div></div>
    </div>
  </div>`;
}

function startSplash(){
  initParticles();
  let p=0;
  const iv=setInterval(()=>{
    p+=Math.random()*16+6;
    if(p>=100){
      clearInterval(iv);
      setTimeout(()=>{
        go("home");
        // Play voice1.ogg once when home screen loads
        if(!voice1Played){
          voice1Played=true;
          setTimeout(playVoice1, 300);
        }
      },380);
    }
    const f=document.getElementById("pfill");
    const c=document.getElementById("pct");
    if(f)f.style.width=Math.min(p,100)+"%";
    if(c)c.innerText=Math.min(Math.round(p),100)+"%";
  },160);
}

function renderHome(){
  const tick = `⚡ 94% WIN RATE &nbsp;<span class="ticker-sep">·</span>&nbsp; 12.4K+ MEMBERS &nbsp;<span class="ticker-sep">·</span>&nbsp; 38 CORRECT TODAY &nbsp;<span class="ticker-sep">·</span>&nbsp; LIVE PREDICTIONS &nbsp;<span class="ticker-sep">·</span>&nbsp; `;
  return `<div class="screen">
    <div class="topbar">
      <div class="logo-wrap" id="logo-trigger">
        <div class="logo-icon">👑</div>
        <div>
          <div class="logo-name">IN999</div>
          <div class="logo-tag">SURESHOT · PREMIUM</div>
        </div>
      </div>
      <div class="live-pill"><span class="live-dot"></span>LIVE</div>
    </div>

    <div class="hero" style="animation:fadeUp .45s ease-out both">
      <div class="hero-eyebrow">WELCOME BACK</div>
      <div class="hero-name">Hey <em>${user.first_name}</em> 👋</div>
    </div>

    <div class="info-card" style="animation:fadeUp .45s ease-out .08s both">
      <div class="scan-line"></div>
      <div class="info-title">💎𝐈𝐍𝟗𝟗𝟗 𝐏𝐫𝐞𝐝𝐢𝐜𝐭𝐢𝐨𝐧 𝐁𝐨𝐭</div>
      <div class="info-body">Elite AI-powered predictions with <strong style="color:var(--gold)">94% accuracy</strong>. Official UID verification required for access.</div>
      <div class="info-warn">⚠ Only UIDs from official registration link are accepted</div>
    </div>

    <div class="stats-row" style="animation:fadeUp .45s ease-out .15s both">
      <div class="stat-box"><div class="stat-val">94%</div><div class="stat-lbl">Accuracy</div></div>
      <div class="stat-box"><div class="stat-val">12.4K</div><div class="stat-lbl">Members</div></div>
      <div class="stat-box"><div class="stat-val">38✓</div><div class="stat-lbl">Today</div></div>
    </div>

    <div class="options" style="animation:fadeUp .45s ease-out .22s both">
      ${optCard("gold","number","🎯",ICONS.star,"𝙂𝙀𝙏 𝙉𝙐𝙈𝘽𝙀𝙍 𝙎𝙐𝙍𝙀𝙎𝙃𝙊𝙏","𝙋𝙞𝙣𝙥𝙤𝙞𝙣𝙩 𝙨𝙞𝙣𝙜𝙡𝙚-𝙙𝙞𝙜𝙞𝙩 𝙥𝙧𝙚𝙙𝙞𝙘𝙩𝙞𝙤𝙣𝙨")}
      ${optCard("crimson","bigsmall","📊",ICONS.chart,"𝙂𝙀𝙏 𝘽𝙄𝙂 / 𝙎𝙈𝘼𝙇𝙇 𝙎𝙐𝙍𝙀𝙎𝙃𝙊𝙏","𝘽𝙚𝙨𝙩 𝙗𝙞𝙜-𝙨𝙢𝙖𝙡𝙡 𝙤𝙪𝙩𝙘𝙤𝙢𝙚 𝙛𝙤𝙧𝙚𝙘𝙖𝙨𝙩")}
      ${optCard("emerald","support","💬",ICONS.msg,"𝘾𝙊𝙉𝙏𝘼𝘾𝙏 𝙎𝙐𝙋𝙋𝙊𝙍𝙏","𝙏𝙖𝙡𝙠 𝙙𝙞𝙧𝙚𝙘𝙩𝙡𝙮 𝙩𝙤 𝙖𝙙𝙢𝙞𝙣")}
    </div>

    <div class="ticker-wrap" style="animation:fadeUp .45s ease-out .3s both">
      <div class="ticker-inner">${tick+tick+tick+tick}</div>
    </div>
    <div class="footer-note">⚡ ONLY OFFICIAL LINK REGISTERED UIDs ARE ACCEPTED</div>
  </div>`;
}

function optCard(color,id,emoji,icon,title,sub){
  const onclick = id==="support"
    ? `Telegram.WebApp.openTelegramLink('https://t.me/m/L-V8wcyXNGNl')`
    : `chooseOption('${id}')`;
  return `<button class="opt-card ${color}" onclick="${onclick}">
    <div class="opt-inner">
      <div class="opt-icon">${emoji}</div>
      <div style="flex:1">
        <div class="opt-title">${title}</div>
        <div class="opt-sub">${sub}</div>
      </div>
      <div class="opt-arr">${ICONS.arrow}</div>
    </div>
  </button>`;
}

function renderUid(){
  const name = S.option==="number"?"Number Sureshot":"Big / Small Sureshot";
  return `<div class="screen">
    <div class="sc-header">
      ${backBtn("resetHome()")}
      <div class="sc-chip amber"><span class="dot"></span>${name}</div>
      <div style="width:42px"></div>
    </div>

    <div class="uid-card" style="animation:fadeUp .4s ease-out both">
      <div class="uid-card-head">
        <div class="uid-head-icon">${ICONS.card}</div>
        <div>
          <div class="uid-greet">Hey <em>${user.first_name}</em> 🧑‍💻</div>
          <div class="uid-steps">
            <div class="uid-step"><span class="uid-step-n">1</span>Register via official link below</div>
            <div class="uid-step"><span class="uid-step-n">2</span>Complete registration process</div>
            <div class="uid-step"><span class="uid-step-n">3</span>Enter your UID using keypad</div>
          </div>
        </div>
      </div>
      <button class="reg-btn" onclick="window.open('https://www.in999ss.com/#/register?invitationCode=728756967425','_blank')">
        ${ICONS.external} Register on Official Site
      </button>
      <div class="warn-row">⚠ Unofficial link registration → verification will fail</div>
    </div>

    <div class="input-section" style="animation:fadeUp .4s ease-out .1s both">
      <div class="input-label">Your UID</div>
      <div class="input-display ${S.uid?'active':''}" id="uid-disp">
        <div class="disp-val ${S.uid?'':'empty'}">${S.uid||'· · · · · · · ·'}</div>
        <div class="disp-count">${S.uid.length}</div>
      </div>
    </div>

    <div style="animation:fadeUp .4s ease-out .18s both">
      ${keypad("typeUid","delUid","submitUid")}
      <div class="keypad-hint">🔒 SECURE KEYPAD — NO CLIPBOARD ACCESS</div>
    </div>
  </div>`;
}

function keypad(typeF,delF,submitF){
  const nums = "123456789".split("").map(d=>`<button class="key" onclick="${typeF}('${d}')">${d}</button>`).join("");
  return `<div class="keypad">${nums}
    <button class="key key-del" onclick="${delF}()">${ICONS.del}</button>
    <button class="key" onclick="${typeF}('0')">0</button>
    <button class="key key-go" onclick="${submitF}()">${ICONS.check}</button>
  </div>`;
}

function renderProcessing(){
  const steps=["Connecting to server...","Validating UID & device","Checking authorization..."];
  return `<div id="processing">
    <div class="proc-visual">
      <div class="proc-outer"></div>
      <div class="proc-mid"></div>
      <div class="proc-inner"></div>
      <div class="proc-core"></div>
    </div>
    <div class="proc-title">Verifying UID</div>
    <div class="proc-sub">Please wait · Secure connection</div>
    <div class="proc-steps">
      ${steps.map((t,i)=>`<div class="proc-step ${i<S.procStep?'done':i===S.procStep?'active':''}">
        <div class="step-ic">${i<S.procStep?'✓':i+1}</div>
        <div class="step-txt">${t}</div>
      </div>`).join("")}
    </div>
  </div>`;
}

function renderResult(){
  const lock = S.failReason==="device_mismatch";
  const contactAdmin = `Telegram.WebApp.openTelegramLink('https://t.me/m/L-V8wcyXNGNl')`;
  const registerOfficial = `window.open('https://www.in999ss.com/#/register?invitationCode=728756967425','_blank')`;

  if (!lock) {
    setTimeout(playVoiceNotice, 100);
  }

  return `<div class="screen">
    <div class="sc-header">
      ${backBtn("resetHome()")}
      <div class="sc-chip rose"><span class="dot"></span>${lock?"Device Locked":"Verification Failed"}</div>
      <div style="width:42px"></div>
    </div>
    <div class="result-head-card" style="animation:fadeUp .4s ease-out both">
      <div class="result-icon-wrap">${lock?ICONS.lock:ICONS.warn}</div>
      <div class="result-chip">${lock?"DEVICE LOCKED":"ACCESS DENIED"}</div>
      <div class="result-title">${lock?"UID Locked to Another Device":"Verification Failed"}</div>
      <div class="result-uid">UID: <span style="color:var(--text)">${S.uid}</span></div>
    </div>
    <div class="reason-list" style="animation:fadeUp .4s ease-out .1s both">
      ${lock?`
        <div class="reason-item"><div class="reason-emoji">🔒</div><div class="reason-txt">This UID is already bound to another device. <strong>One UID = one device only.</strong></div></div>
        <div class="reason-item"><div class="reason-emoji">💬</div><div class="reason-txt">Contact admin to unbind: <strong>@Shetty_Bhaiii</strong></div></div>
      `:`
        <div class="reason-item"><div class="reason-emoji">🚨</div><div class="reason-txt"><strong>Bot activation required</strong> — recharge ₹200 and retry.</div></div>
        <div class="reason-item"><div class="reason-emoji">⚠️</div><div class="reason-txt">Only UIDs from the <strong>official registration link</strong> are accepted by this bot.</div></div>
      `}
    </div>
    <div class="action-row" style="animation:fadeUp .4s ease-out .18s both">
      <button class="btn btn-primary" onclick="${lock?contactAdmin:registerOfficial}">${lock?"Contact Admin":"Register Official"}</button>
    </div>
    <div class="action-row" style="animation:fadeUp .4s ease-out .24s both">
      <button class="btn btn-outline" onclick="retryUid()">Re-enter UID</button>
      <button class="btn btn-outline" onclick="resetHome()">Home</button>
    </div>
  </div>`;
}

function renderPrediction(){
  const isNum = S.option==="number";
  const isMaster = S.verifiedUid === MASTER_UID;
  let predHtml="";
  if(S.loading){
    predHtml=`<div class="pred-loading-box"><div style="color:var(--muted);font-family:var(--mono);font-size:12px;letter-spacing:.06em">GENERATING PREDICTION</div><div class="loading-ring"></div></div>`;
  } else if(S.prediction){
    predHtml=`<div class="pred-output">
      <div class="pred-tag">SURESHOT · PERIOD ${S.period}</div>
      ${isNum
        ? isMaster
          ? `<div class="pred-number" contenteditable="true" oninput="S.prediction.value=this.innerText.trim()" style="outline:none;cursor:text;caret-color:var(--gold)">${S.prediction.value}</div>`
          : `<div class="pred-number">${S.prediction.value}</div>`
        : isMaster
          ? `<div class="pred-bigsmall ${S.prediction.value==="BIG"?"big":"small"}" contenteditable="true" oninput="S.prediction.value=this.innerText.trim().toUpperCase();this.className='pred-bigsmall '+(this.innerText.trim().toUpperCase()==='BIG'?'big':'small')" style="outline:none;cursor:text;caret-color:var(--gold)">${S.prediction.value}</div>`
          : `<div class="pred-bigsmall ${S.prediction.value==="BIG"?"big":"small"}">${S.prediction.value}</div>`
      }
      <div class="pred-confirm-row"><div class="conf-dot"></div>Locked prediction · play with confidence</div>
    </div>`;
  }
  return `<div class="screen">
    <div class="sc-header">
      ${backBtn("resetHome()")}
      <div class="sc-chip gold"><span class="dot"></span>Verified</div>
      <div style="width:42px"></div>
    </div>

    <div class="pred-card" style="animation:fadeUp .4s ease-out both">
      <div class="pred-card-head">
        <div class="pred-verify-icon">${ICONS.check}</div>
        <div>
          <div class="pred-greet">Welcome <em>${user.first_name}</em> ✓</div>
          <div class="pred-uid">UID ${S.verifiedUid} · Verified</div>
        </div>
      </div>
      <div class="pred-divider"></div>
      <div class="pred-mode-t">${isNum?"Number Sureshot":"Big / Small Sureshot"}</div>
      <div class="pred-mode-s">Enter 3-digit period number below</div>
    </div>

    <div class="toggle-wrap" style="animation:fadeUp .4s ease-out .08s both">
      <button class="tog-btn ${isNum?'on gold':''}" onclick="switchOpt('number')">🎯 Number</button>
      <button class="tog-btn ${!isNum?'on crimson':''}" onclick="switchOpt('bigsmall')">📊 Big / Small</button>
    </div>

    <div class="input-section" style="animation:fadeUp .4s ease-out .14s both">
      <div class="input-label">Period Number</div>
      <div id="period-disp" class="input-display ${S.period?'active':''}">
        <div class="disp-val ${S.period?'':'empty'}">${S.period||'e.g. 247'}</div>
        <div class="disp-count">${S.period.length}/3</div>
      </div>
    </div>

    <div style="margin:14px 0">${predHtml}</div>

    <div style="animation:fadeUp .4s ease-out .2s both">
      ${keypad("typePeriod","delPeriod","submitPeriod")}
      <div class="keypad-hint">TAP AGAIN TO RE-ROLL</div>
    </div>
  </div>`;
}

function backBtn(onclick){
  return `<button class="back-btn" onclick="${onclick}">${ICONS.back}</button>`;
}

async function renderAdminPanel(){
  if(!S.adminOpen) return "";
  const uids = S.adminUIDs || [];
  const filtered = uids.filter(e=>e.uid.includes(S.adminSearch));
  return `<div class="admin-overlay" onclick="if(event.target===this)closeAdmin()">
    <div class="admin-sheet">
      <div class="admin-hdr">
        <h3>⚙ Admin Panel</h3>
        <button class="admin-x" onclick="closeAdmin()">✕</button>
      </div>
      <div class="admin-search-wrap">
        <input type="text" placeholder="🔍 Search UID..." id="admin-search" value="${S.adminSearch}" oninput="S.adminSearch=this.value;render()">
      </div>
      <div class="admin-list">
        ${filtered.map(e=>`
          <div class="admin-row">
            <div>
              <div class="admin-uid">${e.uid}</div>
              <div class="admin-uid"><small>${e.device_id?'🔗 bound':'📱 free'} · ${e.active?'✅ Active':'❌ Inactive'}</small></div>
            </div>
            <div style="display:flex;align-items:center">
              <button style="color:var(--gold)" onclick="toggleUID('${e.uid}')">${e.active?'Deact':'Activ'}</button>
              <button style="color:#ff6b7a" onclick="deleteUID('${e.uid}')">Del</button>
            </div>
          </div>`).join("")}
        <div class="admin-row" style="background:rgba(245,200,66,0.04);border-color:rgba(245,200,66,0.12)">
          <div><div class="admin-uid">${MASTER_UID}</div><div class="admin-uid"><small>🔓 Always authorized</small></div></div>
          <span class="admin-badge">MASTER</span>
        </div>
      </div>
      <div class="admin-footer">
        <input id="new-uid-inp" placeholder="Enter UID (digits only)">
        <button onclick="addUID()">Add</button>
      </div>
    </div>
  </div>`;
}

async function render(){
  const app=document.getElementById("app");
  if(!app) return;
  if(S.screen==="splash"){app.innerHTML=renderSplash();startSplash();return}
  let html="";
  switch(S.screen){
    case"home":html=renderHome();break;
    case"uid":html=renderUid();break;
    case"processing":html=renderProcessing();break;
    case"result":html=renderResult();break;
    case"prediction":html=renderPrediction();break;
    default:html=renderHome();
  }
  const adm=await renderAdminPanel();
  app.innerHTML=html+adm;
  if(S.screen==="home"){
    const logo=document.getElementById("logo-trigger");
    if(logo&&!logo._h){
      let tap=0,t=null;
      logo.addEventListener("click",()=>{
        tap++;if(t)clearTimeout(t);
        t=setTimeout(()=>tap=0,800);
        if(tap>=5){tap=0;openAdmin()}
      });logo._h=1;
    }
  }
}

// Global exposure
window.chooseOption=chooseOption;
window.typeUid=typeUid;
window.delUid=delUid;
window.submitUid=submitUid;
window.resetHome=resetHome;
window.retryUid=retryUid;
window.typePeriod=typePeriod;
window.delPeriod=delPeriod;
window.submitPeriod=submitPeriod;
window.switchOpt=switchOpt;
window.openAdmin=openAdmin;
window.closeAdmin=closeAdmin;
window.addUID=addUID;
window.toggleUID=toggleUID;
window.deleteUID=deleteUID;

render();