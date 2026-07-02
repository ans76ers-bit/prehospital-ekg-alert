const STORAGE_KEY = "prehospital-critical-alert-test-v1";
const SESSION_KEY = "prehospital-critical-alert-session-v2";
const REMEMBER_KEY = "prehospital-critical-alert-remember-v1";
const API_STATE_URL = "./api/state";

const dateKey = (date = new Date()) => {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
};
const today = () => dateKey();
const nowText = () => new Date().toLocaleString("zh-TW", { hour12: false });
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

const seed = {
  stations: [
    { id: "s-tucheng", city: "新北市", name: "土城分隊", active: true },
    { id: "s-dingpu", city: "新北市", name: "頂埔分隊", active: true },
    { id: "s-qingshui", city: "新北市", name: "清水分隊", active: true },
    { id: "s-shulin", city: "新北市", name: "樹林分隊", active: true },
    { id: "s-shutan", city: "新北市", name: "樹潭分隊", active: true },
    { id: "s-ganyuan", city: "新北市", name: "柑園分隊", active: true },
    { id: "s-sanxia", city: "新北市", name: "三峽分隊", active: true },
    { id: "s-longen", city: "新北市", name: "隆恩分隊", active: true },
    { id: "s-yingge", city: "新北市", name: "鶯歌分隊", active: true },
    { id: "s-fengming", city: "新北市", name: "鳳鳴分隊", active: true },
  ],
  hospitals: [
    { id: "h-tu", city: "新北市", name: "土城醫院", active: true },
    { id: "h-fy", city: "新北市", name: "亞東醫院", active: true },
  ],
  departments: [
    { id: "dep-er", name: "急診醫學科", active: true },
    { id: "dep-trauma", name: "外傷科", active: true },
    { id: "dep-cardio", name: "心臟內科", active: true },
    { id: "dep-cvs", name: "心臟外科", active: true },
    { id: "dep-neuro", name: "神經內科", active: true },
    { id: "dep-other", name: "其他科", active: true },
  ],
  users: [
    {
      id: "u-admin-chen",
      role: "admin",
      name: "陳承彬",
      phone: "0986994929",
      password: "P123070487",
      stationId: "s-tucheng",
      hospitalId: "h-tu",
      departmentId: "dep-er",
      approved: true,
    },
  ],
  onDuty: [],
  alertTypes: [
    {
      id: "stemi",
      name: "STEMI",
      routeDepartments: ["dep-er", "dep-cardio"],
      active: true,
      prompt: "拍攝 12 導程 EKG 後，送至後送醫院當班急診醫學科醫師與心臟內科醫師。",
    },
    {
      id: "ecmo",
      name: "ECMO",
      routeDepartments: ["dep-er", "dep-cvs"],
      active: true,
      prompt: "亞東醫院院前啟動 ECMO 準則：疑似可逆性休克或心跳停止，現場處置後仍高度懷疑需 ECMO 團隊評估時可通報。本段文字可由管理者修改。",
    },
    {
      id: "trauma",
      name: "重大創傷",
      routeDepartments: ["dep-er", "dep-trauma"],
      active: true,
      prompt: "大量輸血 ABC score：穿刺性傷口、收縮壓小於 90、心跳大於 120、FAST 陽性。符合條件請考慮通報。",
    },
    {
      id: "stroke",
      name: "急性腦梗塞",
      routeDepartments: ["dep-er", "dep-neuro"],
      active: true,
      prompt: "請確認臉歪、手無力、語言異常、視野缺損、意識改變等中風症狀；只有最後正常時間小於 12 小時才需要通報。",
    },
  ],
  alerts: [],
};

let state = loadState();
let session = loadSession();
let view = session ? "dashboard" : "home";
let adminPage = "overview";
let uploadImage = "";
let selectedAlertId = "";
let audio = { context: null, oscillator: null, timer: null };
let pendingDeletedUserIds = [];

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seed);
  try {
    return migrateState({ ...structuredClone(seed), ...JSON.parse(raw) });
  } catch {
    return structuredClone(seed);
  }
}

function migrateState(current) {
  const next = { ...current };
  next.stations = mergeByName(seed.stations, current.stations || []);
  next.departments = mergeByName(seed.departments, current.departments || []).map((department) =>
    department.id === "dep-er" ? { ...department, name: "急診醫學科" } : department,
  );
  next.users = mergeByPhone(seed.users, current.users || [])
    .filter((user) => !["u-admin", "u-pre-1", "u-doc-er", "u-doc-cardio", "u-doc-trauma", "u-doc-neuro", "u-doc-cvs"].includes(user.id))
    .map((user) => ({
      ...user,
      password: user.password || user.phone,
      stationId: user.stationId === "s-banqiao" ? "s-tucheng" : user.role === "admin" && !user.stationId ? "s-tucheng" : user.stationId,
    }));
  next.onDuty = current.onDuty || [];
  next.alerts = (current.alerts || []).map((alert) => ({
    acceptedAt: "",
    respondedBy: "",
    respondedAt: "",
    response: "",
    ...alert,
  }));
  next.alertTypes = (current.alertTypes || seed.alertTypes).map((type) => {
    if (type.id === "stemi") {
      return {
        ...type,
        routeDepartments: ["dep-er", "dep-cardio"],
        prompt: "拍攝 12 導程 EKG 後，送至後送醫院當班急診醫學科醫師與心臟內科醫師。",
      };
    }
    if (type.id === "ecmo") {
      return {
        ...type,
        routeDepartments: ["dep-er", "dep-cvs"],
      };
    }
    return type;
  });
  return next;
}

function mergeByName(requiredItems, existingItems) {
  const merged = [...existingItems];
  requiredItems.forEach((required) => {
    if (!merged.some((item) => item.name === required.name)) merged.push(required);
  });
  return merged;
}

function mergeByPhone(requiredItems, existingItems) {
  const merged = [...existingItems];
  requiredItems.forEach((required) => {
    const existing = merged.find((item) => item.phone === required.phone);
    if (existing) Object.assign(existing, { ...required, ...existing, password: existing.password || required.password || existing.phone });
    else merged.push(required);
  });
  return merged;
}

function mergeById(requiredItems, existingItems) {
  const merged = [...existingItems];
  requiredItems.forEach((required) => {
    if (!merged.some((item) => item.id === required.id)) merged.push(required);
  });
  return merged;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncStateToServer();
}

async function loadStateFromServer() {
  try {
    const response = await fetch(API_STATE_URL, { cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json();
    if (!payload.state) {
      await syncStateToServer();
      return false;
    }
    state = migrateState({ ...structuredClone(seed), ...payload.state });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    refreshSessionFromState();
    return true;
  } catch {
    return false;
  }
}

async function syncStateToServer() {
  try {
    const deletedUserIds = [...pendingDeletedUserIds];
    const response = await fetch(API_STATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, deletedUserIds }),
    });
    if (response.ok && deletedUserIds.length) {
      pendingDeletedUserIds = pendingDeletedUserIds.filter((id) => !deletedUserIds.includes(id));
    }
  } catch {}
}

function refreshSessionFromState() {
  if (!session?.id) return;
  const fresh = userById(session.id);
  if (fresh) {
    session = structuredClone(fresh);
    saveSession();
  }
}

function loadSession() {
  try {
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) {
      const parsed = JSON.parse(remembered);
      const user = state.users.find((item) => item.id === parsed.userId && item.approved);
      if (user) return structuredClone(user);
    }
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession() {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ userId: session.id, savedAt: nowText(), savedMs: Date.now() }));
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

function stationName(id) {
  return state.stations.find((item) => item.id === id)?.name || "未設定分隊";
}

function hospitalName(id) {
  return state.hospitals.find((item) => item.id === id)?.name || "未設定醫院";
}

function departmentName(id) {
  return state.departments.find((item) => item.id === id)?.name || "未設定科別";
}

function alertType(id) {
  return state.alertTypes.find((item) => item.id === id);
}

function userById(id) {
  return state.users.find((item) => item.id === id);
}

function activeHospitals() {
  return state.hospitals.filter((item) => item.active);
}

function activeStations() {
  return state.stations.filter((item) => item.active);
}

function activeDepartments() {
  return state.departments.filter((item) => item.active);
}

function hospitalDoctors() {
  return state.users
    .filter((user) => user.role === "hospital" && user.approved)
    .sort((a, b) => `${hospitalName(a.hospitalId)}${departmentName(a.departmentId)}${a.name}`.localeCompare(`${hospitalName(b.hospitalId)}${departmentName(b.departmentId)}${b.name}`, "zh-Hant"));
}

function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dutyTimeText(duty) {
  if (!duty.dutyStart && !duty.dutyEnd) return `${duty.dutyDate} 全天`;
  return `${duty.dutyDate} ${duty.dutyStart || "00:00"}-${duty.dutyEnd || "23:59"}`;
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function isDutyActiveNow(duty) {
  if (!duty.active) return false;
  const start = timeToMinutes(duty.dutyStart);
  const end = timeToMinutes(duty.dutyEnd);
  const currentDate = today();
  if (start === null && end === null) return duty.dutyDate === currentDate;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  if (start !== null && end !== null && start > end) {
    return (duty.dutyDate === currentDate && current >= start) || (addDays(duty.dutyDate, 1) === currentDate && current <= end);
  }
  if (duty.dutyDate !== currentDate) return false;
  if (start !== null && current < start) return false;
  if (end !== null && current > end) return false;
  return true;
}

function sampleEkgImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 1100;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffefe";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#ffd3d3";
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2.4;
  ctx.font = "24px Microsoft JhengHei, sans-serif";
  ctx.fillStyle = "#222";
  ctx.fillText("Demo ECG - de-identified sample", 36, 44);
  ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"].forEach((lead, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const ox = 44 + col * 520;
    const oy = 96 + row * 96;
    ctx.fillText(lead, ox, oy);
    ctx.beginPath();
    ctx.moveTo(ox + 60, oy);
    for (let i = 0; i < 420; i += 8) {
      const cycle = (i + index * 11) % 90;
      let dy = Math.sin(i / 16) * 3;
      if (cycle > 14 && cycle < 20) dy -= 12;
      if (cycle >= 20 && cycle < 27) dy += 36;
      if (cycle >= 27 && cycle < 35) dy -= 15;
      if (cycle >= 48 && cycle < 70) dy -= index % 3 === 0 ? 20 : 8;
      ctx.lineTo(ox + 60 + i, oy + dy);
    }
    ctx.stroke();
  });
  return canvas.toDataURL("image/png");
}

function recipientsFor(hospitalId, departments) {
  const validDuty = state.onDuty.filter(
    (duty) => isDutyActiveNow(duty) && duty.hospitalId === hospitalId && departments.includes(duty.departmentId),
  );
  return validDuty
    .map((duty) => userById(duty.userId))
    .filter(Boolean)
    .filter((user) => user.approved)
    .map((user) => ({
      userId: user.id,
      name: user.name,
      phone: user.phone,
      hospitalId: user.hospitalId,
      departmentId: user.departmentId,
      acceptedAt: "",
    }));
}

function createAlert({ typeId, hospitalId, extra, image }) {
  const type = alertType(typeId);
  const recipients = recipientsFor(hospitalId, type.routeDepartments);
  state.alerts.push({
    id: uid("alert"),
    typeId,
    hospitalId,
    extra,
    image: image || "",
    sender: {
      userId: session.id,
      name: session.name,
      phone: session.phone,
      stationId: session.stationId,
    },
    recipients,
    status: recipients.length ? "notified" : "no-duty",
    acceptedBy: "",
    acceptedAt: "",
    response: "",
    responseNote: "",
    respondedBy: "",
    respondedAt: "",
    createdAt: nowText(),
    createdMs: Date.now(),
    audit: [`${nowText()} ${session.name} 發起 ${type.name} 通報，後送 ${hospitalName(hospitalId)}`],
  });
  saveState();
}

function statusText(status) {
  return {
    notified: "已通知",
    accepted: "已接收",
    activated: "已啟動",
    declined: "不啟動",
    callback: "回撥電話",
    "no-duty": "無當班人員",
  }[status] || status;
}

function statusClass(status) {
  return {
    notified: "pending",
    accepted: "opened",
    activated: "done",
    declined: "done",
    callback: "done",
    "no-duty": "alert",
  }[status] || "pending";
}

function render() {
  stopAlarmIfNotNeeded();
  document.querySelector("#app").innerHTML = session ? renderShell() : renderPublic();
  bindCommon();
  if (!session) bindPublic();
  if (session?.role === "prehospital" || (session?.role === "admin" && ["adminPrehospital", "alert"].includes(view))) bindPrehospital();
  if (session?.role === "hospital" || (session?.role === "admin" && view === "adminHospital")) bindHospitalUser();
  if (session?.role === "admin") {
    bindAdmin();
    bindAdminModeSwitch();
  }
  bindModal();
}

function isEditingField() {
  return ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
}

async function pollServerState() {
  if (!session) return;
  const before = JSON.stringify(state);
  const loaded = await loadStateFromServer();
  touchCurrentUser();
  if (loaded && JSON.stringify(state) !== before && !isEditingField()) render();
}

function isOnline(user) {
  if (!user.lastSeenMs) return false;
  return Date.now() - user.lastSeenMs < 5 * 60 * 1000;
}

function touchCurrentUser(markLogin = false) {
  if (!session?.id) return;
  const user = userById(session.id);
  if (!user) return;
  user.lastSeenAt = nowText();
  user.lastSeenMs = Date.now();
  if (markLogin) user.lastLoginAt = user.lastSeenAt;
  session = structuredClone(user);
  saveSession();
  saveState();
}

function renderPublic() {
  if (view === "login") return renderLogin();
  if (view === "register") return renderRegister();
  return `
    <section class="login">
      <div class="login-panel">
        <div class="login-title">
          <h1>院前 EKG 與急重症通報</h1>
          <p>STEMI、ECMO、重大創傷、急性腦梗塞的院前到院後通報原型。</p>
          <p class="small" id="homeClock">${nowText()}</p>
        </div>
        <div class="grid two">
          <button class="public-action" data-view="login">登入</button>
          <button class="secondary public-action" data-view="register">註冊</button>
        </div>
        <div class="notice">通報需登入，且只有院前端帳號可以發起通報。</div>
      </div>
    </section>
  `;
}

function renderLogin() {
  return `
    <section class="login">
      <form class="login-panel" id="loginForm">
        <div class="login-title">
          <h1>登入</h1>
          <p>請輸入管理者核發或註冊核准後的帳號密碼。</p>
          <p class="small">登入後會保持登入狀態，直到你主動按「登出」。</p>
        </div>
        <label>電話號碼<input name="phone" required autocomplete="username" /></label>
        <label>密碼<input name="password" type="password" required autocomplete="current-password" /></label>
        <div class="actions">
          <button type="submit">登入</button>
          <button type="button" class="secondary public-action" data-view="home">返回</button>
        </div>
      </form>
    </section>
  `;
}

function renderRegister() {
  return `
    <section class="login">
      <form class="login-panel" id="registerForm">
        <div class="login-title">
          <h1>註冊申請</h1>
          <p>原則上帳號需由管理者核准或事先造冊；Demo 會先列為待審核。</p>
        </div>
        <div class="tabs">
          <button type="button" class="active" data-register-role="prehospital">院前端</button>
          <button type="button" data-register-role="hospital">院後端</button>
        </div>
        <input type="hidden" name="role" value="prehospital" />
        <div class="grid two">
          <label>姓名<input name="name" required /></label>
          <label>電話號碼<input name="phone" required /></label>
          <label>密碼<input name="password" type="password" placeholder="未填則預設為手機號碼" /></label>
          <label class="pre-register">所屬分隊
            <select name="stationId">${activeStations().map((station) => `<option value="${station.id}">${station.city} ${station.name}</option>`).join("")}</select>
          </label>
          <label class="hospital-register" hidden>所屬醫院
            <select name="hospitalId">${activeHospitals().map((hospital) => `<option value="${hospital.id}">${hospital.name}</option>`).join("")}</select>
          </label>
          <label class="hospital-register" hidden>所屬科別
            <select name="departmentId">${activeDepartments().map((dep) => `<option value="${dep.id}">${dep.name}</option>`).join("")}</select>
          </label>
        </div>
        <div class="actions">
          <button type="submit">送出註冊申請</button>
          <button type="button" class="secondary public-action" data-view="home">返回</button>
        </div>
      </form>
    </section>
  `;
}

function renderShell() {
  return `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">EMS</div>
          <div>
            <h1>院前 EKG 與急重症通報</h1>
            <small>${session.role === "admin" ? `管理者 / ${adminModeLabel()}` : `${roleLabel(session.role)} Demo`}</small>
          </div>
        </div>
        <div class="userbar">
          <span>${session.name}</span>
          <button class="secondary" id="editProfile">修改資料</button>
          <button class="secondary" id="logout">登出</button>
        </div>
      </header>
      ${session.role === "admin" ? renderAdminModeTabs() : ""}
      <main class="page">${renderDashboard()}</main>
      ${selectedAlertId ? renderAlertModal(selectedAlertId) : ""}
    </div>
  `;
}

function roleLabel(role) {
  return { admin: "管理者", prehospital: "院前端", hospital: "院後端" }[role] || role;
}

function adminModeLabel() {
  return {
    adminPrehospital: "院前端測試",
    adminHospital: "院後端測試",
    alert: "院前端測試",
    dashboard: "管理頁面",
  }[view] || "管理頁面";
}

function renderAdminModeTabs() {
  return `
    <nav class="tabs admin-tabs">
      <button type="button" class="${view === "adminPrehospital" || view === "alert" ? "active" : ""}" data-admin-view="adminPrehospital">院前端測試</button>
      <button type="button" class="${view === "adminHospital" ? "active" : ""}" data-admin-view="adminHospital">院後端測試</button>
      <button type="button" class="${!["adminPrehospital", "adminHospital", "alert", "profile"].includes(view) ? "active" : ""}" data-admin-view="dashboard">管理頁面</button>
    </nav>
  `;
}

function renderDashboard() {
  if (view === "profile") return renderProfile();
  if (session.role === "admin") {
    if (view === "adminPrehospital") return renderPrehospitalHome();
    if (view === "adminHospital") return renderHospitalUser();
    if (view === "alert") return renderAlertComposer();
    return renderAdmin();
  }
  if (session.role === "hospital") return renderHospitalUser();
  return view === "alert" ? renderAlertComposer() : renderPrehospitalHome();
}

function renderPrehospitalHome() {
  const myAlerts = state.alerts.filter((alert) => alert.sender.userId === session.id).slice().reverse();
  return `
    <section class="grid two">
      <section class="panel">
        <h2>院前端通報</h2>
        <div class="meta"><span>${stationName(session.stationId)}</span><span>${session.phone}</span></div>
        <button id="startAlert">通報</button>
      </section>
      <section class="panel">
        <div class="toolbar"><h2>我的通報紀錄</h2><button class="secondary" id="refresh">更新</button></div>
        <div class="list">${myAlerts.length ? myAlerts.map(renderAlertCard).join("") : `<div class="muted">尚無通報</div>`}</div>
      </section>
      ${renderStatsPanel("我的通報統計", myAlerts)}
    </section>
  `;
}

function renderProfile() {
  return `
    <form class="panel" id="profileForm">
      <div class="toolbar">
        <h2>修改個人資料</h2>
        <button type="button" class="secondary" id="backFromProfile">返回</button>
      </div>
      <div class="grid two">
        <label>姓名<input name="name" required value="${escapeHtml(session.name)}" /></label>
        <label>電話號碼<input name="phone" required value="${escapeHtml(session.phone)}" /></label>
        <label>密碼<input name="password" type="password" required value="${escapeHtml(session.password || session.phone)}" /></label>
        ${session.role === "prehospital" || session.role === "admin" ? `
          <label>所屬分隊
            <select name="stationId">${activeStations().map((station) => `<option value="${station.id}" ${station.id === session.stationId ? "selected" : ""}>${station.city} ${station.name}</option>`).join("")}</select>
          </label>
        ` : ""}
        ${session.role === "hospital" || session.role === "admin" ? `
          <label>所屬醫院
            <select name="hospitalId">${activeHospitals().map((hospital) => `<option value="${hospital.id}" ${hospital.id === session.hospitalId ? "selected" : ""}>${hospital.name}</option>`).join("")}</select>
          </label>
          <label>所屬科別
            <select name="departmentId">${activeDepartments().map((department) => `<option value="${department.id}" ${department.id === session.departmentId ? "selected" : ""}>${department.name}</option>`).join("")}</select>
          </label>
        ` : ""}
      </div>
      <div class="actions"><button type="submit">儲存資料</button></div>
    </form>
  `;
}

function statsFor(alerts) {
  const rows = state.alertTypes.map((type) => {
    const typeAlerts = alerts.filter((alert) => alert.typeId === type.id);
    const activated = typeAlerts.filter((alert) => alert.status === "activated").length;
    const total = typeAlerts.length;
    return { id: type.id, name: type.name, total, activated, rate: total ? Math.round((activated / total) * 100) : 0 };
  });
  const total = alerts.length;
  const activated = alerts.filter((alert) => alert.status === "activated").length;
  return { rows, total, activated, rate: total ? Math.round((activated / total) * 100) : 0 };
}

function renderStatsPanel(title, alerts) {
  const stats = statsFor(alerts);
  return `
    <section class="panel">
      <h2>${title}</h2>
      <div class="notice">成功率目前以「成功啟動案件 / 總通報案件」計算。</div>
      <div class="table">
        <div class="row header"><span>類別</span><span>總通報</span><span>啟動</span><span>成功率</span><span></span></div>
        ${stats.rows.map((row) => `
          <div class="row">
            <span>${row.name}</span>
            <span>${row.total}</span>
            <span>${row.activated}</span>
            <span>${row.rate}%</span>
            <span></span>
          </div>
        `).join("")}
        <div class="row">
          <strong>總平均</strong>
          <strong>${stats.total}</strong>
          <strong>${stats.activated}</strong>
          <strong>${stats.rate}%</strong>
          <span></span>
        </div>
      </div>
    </section>
  `;
}

function renderAlertComposer() {
  const typeOptions = state.alertTypes.filter((type) => type.active).map((type) => `<option value="${type.id}">${type.name}</option>`).join("");
  return `
    <form class="panel" id="alertForm">
      <div class="toolbar">
        <h2>發起通報</h2>
        <button type="button" class="secondary" id="backDashboard">返回</button>
      </div>
      <div class="grid two">
        <label>通報類別<select name="typeId" id="typeSelect">${typeOptions}</select></label>
        <label>後送醫院<select name="hospitalId">${activeHospitals().map((hospital) => `<option value="${hospital.id}">${hospital.name}</option>`).join("")}</select></label>
      </div>
      <div id="typeFlow"></div>
      <button type="submit">送出通報</button>
    </form>
  `;
}

function renderTypeFlow(typeId) {
  const type = alertType(typeId);
  if (typeId === "stemi") {
    return `
      <div class="notice">${type.prompt}</div>
      <label>EKG 影像<input id="ekgFile" type="file" accept="image/*" capture="environment" /></label>
      <div class="actions"><button type="button" class="secondary" id="sampleImage">使用範例影像</button></div>
      <div class="preview ${uploadImage ? "" : "empty"}">${uploadImage ? `<img src="${uploadImage}" alt="EKG preview" />` : "尚未選擇影像"}</div>
    `;
  }
  if (typeId === "ecmo") {
    return `
      <div class="notice">${escapeHtml(type.prompt)}</div>
      <label>是否啟動 ECMO 通報<select name="decision"><option value="是">是</option><option value="否">否</option></select></label>
    `;
  }
  if (typeId === "stroke") {
    return `
      <div class="notice">${escapeHtml(type.prompt)}</div>
      <label>最後一次正常距離現在的時間
        <select name="strokeWindow">
          <option value="<4.5 小時 tPA">&lt;4.5 小時 tPA</option>
          <option value="<12 小時 IA">&lt;12 小時 IA</option>
          <option value=">=12 小時，不建議通報">&gt;=12 小時，不建議通報</option>
        </select>
      </label>
      <label>是否通報<select name="decision"><option value="是">是</option><option value="否">否</option></select></label>
    `;
  }
  return `
    <div class="notice">${escapeHtml(type.prompt)}</div>
    <label>是否符合大量輸血條件<select name="decision"><option value="是">是</option><option value="否">否</option></select></label>
  `;
}

function renderAlertCard(alert) {
  const type = alertType(alert.typeId);
  const accepted = alert.acceptedBy ? userById(alert.acceptedBy) : null;
  return `
    <article class="item ${alert.status === "notified" ? "critical" : ""}">
      <div class="item-head">
        <div>
          <strong>${type?.name || alert.typeId} - ${hospitalName(alert.hospitalId)}</strong>
          <div class="meta"><span>${alert.createdAt}</span><span>${stationName(alert.sender.stationId)}</span></div>
        </div>
        <span class="status ${statusClass(alert.status)}">${statusText(alert.status)}</span>
      </div>
      <div class="meta">
        <span>接收：${accepted ? accepted.name : "尚未"}</span>
        <span>通知：${alert.recipients.map((recipient) => `${recipient.name}/${departmentName(recipient.departmentId)}`).join("、") || "無"}</span>
      </div>
      ${alert.response ? `<div class="${alert.response === "啟動" ? "result-stemi" : "result-non"}">回覆：${alert.response}</div>` : ""}
      <div class="actions"><button class="secondary view-alert" data-id="${alert.id}">檢視</button></div>
    </article>
  `;
}

function renderHospitalUser() {
  const relevant = hospitalRelevantAlerts().slice().reverse();
  const ringing = relevant.some((alert) => alert.status === "notified");
  if (ringing) startAlarm();
  return `
    <section class="grid two">
      <section class="panel">
        <div class="toolbar">
          <h2>接收與回覆</h2>
          ${ringing ? `<span class="status alert">持續提醒</span>` : `<span class="status done">無待接收</span>`}
        </div>
        <div class="meta"><span>${hospitalName(session.hospitalId)}</span><span>${departmentName(session.departmentId)}</span><span>${session.phone}</span></div>
        <div class="list">${relevant.length ? relevant.map(renderHospitalAlert).join("") : `<div class="muted">目前沒有派送給你的通報</div>`}</div>
      </section>
      <section class="panel">
        <h2>通知規則</h2>
        <div class="notice">只通知後送醫院與對應科別的當班醫師；第一位醫師按下接收後，其他醫師不再需要回覆。</div>
      </section>
    </section>
  `;
}

function hospitalRelevantAlerts() {
  return state.alerts.filter((alert) => {
    if (alert.recipients.some((recipient) => recipient.userId === session.id)) return true;
    if (session.role !== "admin") return false;
    const type = alertType(alert.typeId);
    return alert.hospitalId === session.hospitalId && type?.routeDepartments.includes(session.departmentId);
  });
}

function renderHospitalAlert(alert) {
  const acceptedByMe = alert.acceptedBy === session.id;
  const acceptedByOther = alert.acceptedBy && alert.acceptedBy !== session.id;
  return `
    <article class="item ${alert.status === "notified" ? "critical" : ""}">
      <div class="item-head">
        <div>
          <strong>${alertType(alert.typeId)?.name || alert.typeId}</strong>
          <div class="meta"><span>${hospitalName(alert.hospitalId)}</span><span>${stationName(alert.sender.stationId)}</span><span>${alert.sender.phone}</span></div>
        </div>
        <span class="status ${statusClass(alert.status)}">${statusText(alert.status)}</span>
      </div>
      <div class="small">${escapeHtml(alert.extra || "")}</div>
      <div class="actions">
        <button class="secondary view-alert" data-id="${alert.id}">檢視</button>
        ${alert.status === "notified" ? `<button class="accept-alert" data-id="${alert.id}">接收</button>` : ""}
        ${acceptedByMe && alert.status === "accepted" ? `<button class="reply-alert danger" data-id="${alert.id}" data-response="啟動">啟動</button><button class="reply-alert" data-id="${alert.id}" data-response="不啟動">不啟動</button><button class="callback-alert secondary" data-id="${alert.id}">回撥電話</button>` : ""}
        ${acceptedByOther ? `<span class="status opened">已由 ${userById(alert.acceptedBy)?.name || "其他醫師"} 接收</span>` : ""}
      </div>
    </article>
  `;
}

function renderAdmin() {
  const pages = {
    overview: {
      title: "總覽",
      content: `
        ${renderUserOverviewPanel()}
        ${renderStatsPanel("全系統通報統計", state.alerts)}
        ${renderRecentAdminRecordsPanel(5)}
      `,
    },
    accounts: {
      title: "帳號管理",
      content: `
        ${renderPendingUsersPanel()}
        ${renderPrehospitalUsersPanel()}
        ${renderHospitalUsersPanel()}
        ${renderAdminUsersPanel()}
      `,
    },
    units: {
      title: "單位設定",
      content: renderUnitSettingsPanel(),
    },
    duty: {
      title: "班表管理",
      content: renderDutyPanel(),
    },
    alerts: {
      title: "通報設定",
      content: renderAlertSettingsPanel(),
    },
    stats: {
      title: "統計資料",
      content: `
        ${renderStatsPanel("全系統通報統計", state.alerts)}
        ${renderAdminRecordsPanel()}
      `,
    },
  };
  const current = pages[adminPage] || pages.overview;
  return `
    <section class="admin-page">
      ${renderAdminSubTabs(pages)}
      <div class="toolbar">
        <h2>${current.title}</h2>
      </div>
      <div class="grid two">
        ${current.content}
      </div>
    </section>
  `;
}

function renderAdminSubTabs(pages) {
  return `
    <nav class="tabs admin-subtabs">
      ${Object.entries(pages).map(([key, page]) => `
        <button type="button" class="${adminPage === key ? "active" : ""}" data-admin-page="${key}">${page.title}</button>
      `).join("")}
    </nav>
  `;
}

function renderPendingUsersPanel() {
  const users = state.users.filter((user) => !user.approved);
  return `
    <section class="panel">
      <h2>待審核帳號</h2>
      <div class="list">${users.length ? users.map(renderUserAdmin).join("") : `<div class="muted">目前沒有待審核帳號</div>`}</div>
    </section>
  `;
}

function renderUnitSettingsPanel() {
  return `
    <section class="panel">
      <h2>醫院與分隊</h2>
      <form id="hospitalForm" class="grid three"><label>醫院<input name="name" required /></label><label>縣市<input name="city" value="新北市" /></label><button type="submit">新增醫院</button></form>
      <form id="stationForm" class="grid three"><label>分隊<input name="name" required /></label><label>縣市<input name="city" value="新北市" /></label><button type="submit">新增分隊</button></form>
      <div class="meta"><span>醫院：${state.hospitals.map((h) => h.name).join("、")}</span></div>
      <div class="meta"><span>分隊：${state.stations.map((s) => s.name).join("、")}</span></div>
    </section>
    <section class="panel">
      <h2>科別</h2>
      <form id="departmentForm" class="grid two"><label>科別<input name="name" required /></label><button type="submit">新增科別</button></form>
      <div class="meta"><span>${state.departments.map((department) => department.name).join("、")}</span></div>
    </section>
  `;
}

function renderAlertSettingsPanel() {
  return `
    <section class="panel wide-panel">
      <h2>通報類別</h2>
      <div class="list">${state.alertTypes.map(renderAlertTypeAdmin).join("")}</div>
    </section>
  `;
}

function renderDutyPanel() {
  return `
    <section class="panel wide-panel">
      <h2>當班人員與班表匯入</h2>
      ${hospitalDoctors().length ? "" : `<div class="notice">目前沒有已核准的院後端醫師。請先讓醫師註冊院後端帳號，或在帳號管理中核准後再排班。</div>`}
      <form id="manualDutyForm" class="grid three">
        <label>院後端醫師
          <select name="userId" required>
            <option value="">請選擇已註冊醫師</option>
            ${hospitalDoctors().map((doctor) => `<option value="${doctor.id}">${doctor.name} / ${hospitalName(doctor.hospitalId)} / ${departmentName(doctor.departmentId)}</option>`).join("")}
          </select>
        </label>
        <label>值班日期<input name="dutyDate" type="date" value="${today()}" required /></label>
        <label>開始時間<input name="dutyStart" type="time" value="08:00" /></label>
        <label>結束時間<input name="dutyEnd" type="time" value="17:00" /></label>
        <button type="submit">加入值班</button>
      </form>
      <div class="notice">排班只從已核准的院後端醫師帳號選取；醫院與科別會沿用該醫師帳號資料。跨午夜班可直接輸入例如 20:00 到 08:00。</div>
      <label>CSV 匯入<textarea id="scheduleCsv">${sampleCsv()}</textarea></label>
      <label>AI 輔助判讀 Excel<input id="excelSchedule" type="file" accept=".xlsx,.xls,.csv" /></label>
      <div class="notice">目前 Demo 可先上傳檔案並產生預覽區；正式版會將 Excel 送到後端/AI 解析後，再由管理者確認匯入。</div>
      <div id="excelPreview" class="small muted">尚未上傳 Excel 班表。</div>
      <button id="importSchedule">匯入班表</button>
      <div class="list">${state.onDuty.filter((duty) => duty.dutyDate === today()).map(renderDutyAdmin).join("") || `<div class="muted">今日尚無班表</div>`}</div>
    </section>
  `;
}

function renderAdminRecordsPanel() {
  return `
    <section class="panel wide-panel">
      <h2>後台紀錄</h2>
      <div class="list">${state.alerts.slice().reverse().map(renderAdminAlertRecord).join("") || `<div class="muted">尚無通報</div>`}</div>
    </section>
  `;
}

function renderRecentAdminRecordsPanel(limit) {
  const alerts = state.alerts.slice().reverse().slice(0, limit);
  return `
    <section class="panel">
      <h2>近期通報</h2>
      <div class="list">${alerts.length ? alerts.map(renderAdminAlertRecord).join("") : `<div class="muted">尚無通報</div>`}</div>
    </section>
  `;
}

function renderUserOverviewPanel() {
  const approved = state.users.filter((user) => user.approved).length;
  const online = state.users.filter(isOnline).length;
  const prehospital = state.users.filter((user) => user.role === "prehospital").length;
  const hospital = state.users.filter((user) => user.role === "hospital").length;
  const admins = state.users.filter((user) => user.role === "admin").length;
  return `
    <section class="panel">
      <h2>帳號總覽</h2>
      <div class="grid three">
        <div class="item"><strong>${state.users.length}</strong><span class="muted">總帳號</span></div>
        <div class="item"><strong>${approved}</strong><span class="muted">已核准</span></div>
        <div class="item"><strong>${online}</strong><span class="muted">目前在線</span></div>
      </div>
      <div class="meta">
        <span>院前端：${prehospital}</span>
        <span>院後端：${hospital}</span>
        <span>管理者：${admins}</span>
      </div>
      <div class="small muted">在線人數以最近 5 分鐘有登入或同步活動計算。</div>
    </section>
  `;
}

function renderPrehospitalUsersPanel() {
  const users = state.users.filter((user) => user.role === "prehospital");
  return `
    <section class="panel">
      <h2>院前端使用者</h2>
      <div class="list">${users.length ? users.map(renderUserAdmin).join("") : `<div class="muted">尚無院前端帳號</div>`}</div>
    </section>
  `;
}

function renderHospitalUsersPanel() {
  const groups = activeHospitals().map((hospital) => {
    const users = state.users.filter((user) => user.role === "hospital" && user.hospitalId === hospital.id);
    if (!users.length) return "";
    return `
      <article class="item">
        <h3>${hospital.name}</h3>
        ${activeDepartments().map((department) => {
          const depUsers = users.filter((user) => user.departmentId === department.id);
          if (!depUsers.length) return "";
          return `
            <div class="list">
              <strong>${department.name}</strong>
              ${depUsers.map(renderUserAdmin).join("")}
            </div>
          `;
        }).join("")}
      </article>
    `;
  }).join("");
  return `
    <section class="panel">
      <h2>院後端使用者</h2>
      <div class="list">${groups || `<div class="muted">尚無院後端帳號</div>`}</div>
    </section>
  `;
}

function renderAdminUsersPanel() {
  const admins = state.users.filter((user) => user.role === "admin");
  return `
    <section class="panel">
      <h2>管理者名單</h2>
      <div class="list">${admins.map(renderUserAdmin).join("")}</div>
      <div class="notice">可在院前端或院後端帳號卡片中按「指定管理者」，讓該帳號取得管理者權限。</div>
    </section>
  `;
}

function renderUserAdmin(user) {
  const detail = user.role === "prehospital" ? stationName(user.stationId) : user.role === "hospital" ? `${hospitalName(user.hospitalId)} / ${departmentName(user.departmentId)}` : "管理者";
  const actions = [
    !user.approved ? `<button class="secondary approve-user" data-id="${user.id}">核准</button>` : "",
    `<button class="secondary save-password" data-id="${user.id}">儲存密碼</button>`,
    user.role !== "admin" ? `<button class="ghost make-admin" data-id="${user.id}">指定管理者</button>` : `<button class="ghost revoke-admin" data-id="${user.id}">取消管理者</button>`,
    `<button class="danger delete-user" data-id="${user.id}">刪除</button>`,
  ].filter(Boolean).join("");
  return `
    <article class="item">
      <div class="item-head">
        <div>
          <strong>${user.name}</strong>
          <div class="meta">
            <span>${roleLabel(user.role)}</span>
            <span>${user.phone}</span>
            <span>${detail}</span>
            <span>最後登入：${user.lastLoginAt || "尚無"}</span>
          </div>
        </div>
        <span class="status ${isOnline(user) ? "done" : user.approved ? "opened" : "pending"}">${isOnline(user) ? "在線" : user.approved ? "已核准" : "待審核"}</span>
      </div>
      <div class="grid two">
        <label>密碼<input class="password-input" data-id="${user.id}" value="${escapeHtml(user.password || user.phone)}" /></label>
        <div class="actions">
          ${actions}
        </div>
      </div>
    </article>
  `;
}

function roleAfterAdminRevoked(user) {
  if (["prehospital", "hospital"].includes(user.previousRole)) return user.previousRole;
  if (user.hospitalId && user.departmentId) return "hospital";
  return "prehospital";
}

function renderAdminAlertRecord(alert) {
  const acceptedUser = alert.acceptedBy ? userById(alert.acceptedBy) : null;
  const responseUser = alert.respondedBy ? userById(alert.respondedBy) : acceptedUser;
  return `
    <article class="item">
      <div class="item-head">
        <strong>${alertType(alert.typeId)?.name || alert.typeId} - ${hospitalName(alert.hospitalId)}</strong>
        <span class="status ${statusClass(alert.status)}">${statusText(alert.status)}</span>
      </div>
      <div class="meta">
        <span>發送分隊：${stationName(alert.sender.stationId)}</span>
        <span>發送人：${alert.sender.name}</span>
        <span>發送時間：${alert.createdAt}</span>
      </div>
      <div class="meta">
        <span>接收醫師：${acceptedUser?.name || "尚未"}</span>
        <span>接收時間：${alert.acceptedAt || "尚未"}</span>
      </div>
      <div class="meta">
        <span>回報醫師：${responseUser?.name || "尚未"}</span>
        <span>回報時間：${alert.respondedAt || "尚未"}</span>
        <span>回報結果：${alert.response || "尚未"}</span>
      </div>
      <div class="actions"><button class="secondary view-alert" data-id="${alert.id}">檢視</button></div>
    </article>
  `;
}

function renderAlertTypeAdmin(type) {
  return `
    <article class="item">
      <strong>${type.name}</strong>
      <div class="meta"><span>通知科別：${type.routeDepartments.map(departmentName).join("、")}</span></div>
      <label>提示文字<textarea class="prompt-input" data-id="${type.id}">${escapeHtml(type.prompt)}</textarea></label>
      <div class="actions"><button class="secondary save-prompt" data-id="${type.id}">儲存提示文字</button></div>
    </article>
  `;
}

function renderDutyAdmin(duty) {
  const user = userById(duty.userId);
  return `
    <article class="item">
      <div class="item-head">
        <strong>${user?.name || "未知醫師"}</strong>
        <span class="status ${duty.active ? "done" : "pending"}">${duty.active ? "當班" : "停用"}</span>
      </div>
      <div class="meta"><span>${hospitalName(duty.hospitalId)}</span><span>${departmentName(duty.departmentId)}</span><span>${dutyTimeText(duty)}</span></div>
      <button class="secondary toggle-duty" data-id="${duty.id}">${duty.active ? "停用" : "啟用"}</button>
    </article>
  `;
}

function renderAlertModal(id) {
  const alert = state.alerts.find((item) => item.id === id);
  if (!alert) return "";
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="toolbar"><h2>${alertType(alert.typeId)?.name || alert.typeId} 通報</h2><button class="secondary" id="closeModal">關閉</button></div>
        <div class="meta"><span>${hospitalName(alert.hospitalId)}</span><span>${stationName(alert.sender.stationId)}</span><span>${alert.createdAt}</span></div>
        <div class="notice">${escapeHtml(alert.extra || "")}</div>
        ${alert.image ? `<div class="preview"><img src="${alert.image}" alt="uploaded ECG" /></div>` : ""}
        <div class="small">${alert.audit.map(escapeHtml).join("<br />")}</div>
      </div>
    </div>
  `;
}

function bindPublic() {
  document.querySelectorAll(".public-action").forEach((button) => button.addEventListener("click", () => {
    view = button.dataset.view;
    render();
  }));
  document.querySelector("#loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const phone = data.get("phone");
    const password = data.get("password");
    const user = state.users.find((item) => item.phone === phone && item.approved && (item.password || item.phone) === password);
    if (!user) return alert("找不到已核准帳號。請使用測試帳號或先由管理者核准。");
    session = structuredClone(user);
    saveSession();
    touchCurrentUser(true);
    view = "dashboard";
    render();
  });
  document.querySelectorAll("[data-register-role]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-register-role]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector("[name='role']").value = button.dataset.registerRole;
    document.querySelectorAll(".pre-register").forEach((item) => (item.hidden = button.dataset.registerRole !== "prehospital"));
    document.querySelectorAll(".hospital-register").forEach((item) => (item.hidden = button.dataset.registerRole !== "hospital"));
  }));
  document.querySelector("#registerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    data.password = data.password || data.phone;
    state.users.push({ id: uid("u"), ...data, approved: false });
    saveState();
    alert("已送出註冊申請，需管理者核准。");
    view = "home";
    render();
  });
}

function bindCommon() {
  document.querySelector("#logout")?.addEventListener("click", () => {
    stopAlarm();
    session = null;
    saveSession();
    view = "home";
    render();
  });
  document.querySelector("#editProfile")?.addEventListener("click", () => {
    view = "profile";
    render();
  });
  document.querySelector("#backFromProfile")?.addEventListener("click", () => {
    view = "dashboard";
    render();
  });
  document.querySelector("#profileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const user = userById(session.id);
    if (!user) return;
    user.name = data.name;
    user.phone = data.phone;
    user.password = data.password || data.phone;
    if (user.role === "prehospital" || user.role === "admin") user.stationId = data.stationId;
    if (user.role === "hospital" || user.role === "admin") {
      user.hospitalId = data.hospitalId;
      user.departmentId = data.departmentId;
      state.onDuty
        .filter((duty) => duty.userId === user.id)
        .forEach((duty) => {
          duty.hospitalId = user.hospitalId;
          duty.departmentId = user.departmentId;
        });
    }
    session = structuredClone(user);
    saveSession();
    saveState();
    view = "dashboard";
    render();
  });
  document.querySelector("#refresh")?.addEventListener("click", () => pollServerState());
  document.querySelectorAll(".view-alert").forEach((button) => button.addEventListener("click", () => {
    selectedAlertId = button.dataset.id;
    render();
  }));
}

function bindAdminModeSwitch() {
  document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => {
    view = button.dataset.adminView;
    uploadImage = "";
    stopAlarm();
    render();
  }));
}

function bindPrehospital() {
  document.querySelector("#startAlert")?.addEventListener("click", () => {
    view = "alert";
    render();
  });
  document.querySelector("#backDashboard")?.addEventListener("click", () => {
    view = session.role === "admin" ? "adminPrehospital" : "dashboard";
    uploadImage = "";
    render();
  });
  const typeSelect = document.querySelector("#typeSelect");
  const flow = document.querySelector("#typeFlow");
  if (typeSelect && flow) {
    const paintFlow = () => {
      flow.innerHTML = renderTypeFlow(typeSelect.value);
      bindFlowControls();
    };
    typeSelect.addEventListener("change", () => {
      uploadImage = "";
      paintFlow();
    });
    paintFlow();
  }
  document.querySelector("#alertForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const type = alertType(data.typeId);
    if (data.typeId === "stemi" && !uploadImage) return alert("請先上傳或使用範例 EKG 影像。");
    if (data.decision === "否") return alert("已選擇不通報，未送出通知。");
    if (data.strokeWindow?.includes(">=12")) return alert("最後正常時間已超過 12 小時，Demo 依規則不送出通報。");
    const extra = buildExtra(data, type);
    createAlert({ typeId: data.typeId, hospitalId: data.hospitalId, extra, image: data.typeId === "stemi" ? uploadImage : "" });
    uploadImage = "";
    view = session.role === "admin" ? "adminPrehospital" : "dashboard";
    render();
  });
}

function bindFlowControls() {
  document.querySelector("#sampleImage")?.addEventListener("click", () => {
    uploadImage = sampleEkgImage();
    const flow = document.querySelector("#typeFlow");
    flow.innerHTML = renderTypeFlow("stemi");
    bindFlowControls();
  });
  document.querySelector("#ekgFile")?.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadImage = reader.result;
      const flow = document.querySelector("#typeFlow");
      flow.innerHTML = renderTypeFlow("stemi");
      bindFlowControls();
    };
    reader.readAsDataURL(file);
  });
}

function buildExtra(data, type) {
  if (data.typeId === "stemi") return "院前端已上傳 EKG 影像，請判讀並決定是否啟動。";
  if (data.typeId === "stroke") return `${type.prompt}\n最後正常時間：${data.strokeWindow}`;
  return `${type.prompt}\n院前端選擇：${data.decision}`;
}

function bindHospitalUser() {
  document.querySelectorAll(".accept-alert").forEach((button) => button.addEventListener("click", () => {
    const item = state.alerts.find((alert) => alert.id === button.dataset.id);
    if (!item || item.status !== "notified") return;
    item.status = "accepted";
    item.acceptedBy = session.id;
    item.acceptedAt = nowText();
    const recipient = item.recipients.find((r) => r.userId === session.id);
    if (recipient) recipient.acceptedAt = item.acceptedAt;
    item.audit.push(`${nowText()} ${session.name} 接收通報`);
    stopAlarm();
    saveState();
    render();
  }));
  document.querySelectorAll(".reply-alert").forEach((button) => button.addEventListener("click", () => {
    const item = state.alerts.find((alert) => alert.id === button.dataset.id);
    item.response = button.dataset.response;
    item.respondedBy = session.id;
    item.respondedAt = nowText();
    item.status = button.dataset.response === "啟動" ? "activated" : "declined";
    item.audit.push(`${nowText()} ${session.name} 回覆：${button.dataset.response}`);
    saveState();
    render();
  }));
  document.querySelectorAll(".callback-alert").forEach((button) => button.addEventListener("click", () => {
    const item = state.alerts.find((alert) => alert.id === button.dataset.id);
    item.response = "回撥電話";
    item.respondedBy = session.id;
    item.respondedAt = nowText();
    item.status = "callback";
    item.audit.push(`${nowText()} ${session.name} 選擇回撥 ${item.sender.phone}`);
    saveState();
    window.location.href = `tel:${item.sender.phone}`;
    render();
  }));
}

function bindAdmin() {
  document.querySelectorAll("[data-admin-page]").forEach((button) => button.addEventListener("click", () => {
    adminPage = button.dataset.adminPage;
    render();
  }));
  document.querySelectorAll(".approve-user").forEach((button) => button.addEventListener("click", () => {
    const user = userById(button.dataset.id);
    user.approved = !user.approved;
    saveState();
    render();
  }));
  document.querySelectorAll(".save-password").forEach((button) => button.addEventListener("click", () => {
    const user = userById(button.dataset.id);
    const input = document.querySelector(`.password-input[data-id="${button.dataset.id}"]`);
    user.password = input.value || user.phone;
    saveState();
    render();
  }));
  document.querySelectorAll(".make-admin").forEach((button) => button.addEventListener("click", () => {
    const user = userById(button.dataset.id);
    if (!user) return;
    user.previousRole = user.role;
    user.role = "admin";
    user.approved = true;
    saveState();
    render();
  }));
  document.querySelectorAll(".revoke-admin").forEach((button) => button.addEventListener("click", () => {
    const user = userById(button.dataset.id);
    if (!user) return;
    user.role = roleAfterAdminRevoked(user);
    user.approved = true;
    delete user.previousRole;
    if (session?.id === user.id) {
      session = { ...session, role: user.role };
      saveSession(session);
      view = "dashboard";
    }
    saveState();
    render();
  }));
  document.querySelectorAll(".delete-user").forEach((button) => button.addEventListener("click", () => {
    const user = userById(button.dataset.id);
    if (!user) return;
    if (!confirm(`確定要刪除「${user.name}」這個帳號嗎？此動作會移除帳號與相關值班資料。`)) return;
    pendingDeletedUserIds.push(user.id);
    state.users = state.users.filter((item) => item.id !== user.id);
    state.onDuty = state.onDuty.filter((duty) => duty.userId !== user.id);
    if (session?.id === user.id) {
      session = null;
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(REMEMBER_KEY);
      view = "home";
    }
    saveState();
    render();
  }));
  document.querySelector("#hospitalForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    state.hospitals.push({ id: uid("h"), active: true, ...data });
    saveState();
    render();
  });
  document.querySelector("#stationForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    state.stations.push({ id: uid("s"), active: true, ...data });
    saveState();
    render();
  });
  document.querySelector("#departmentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    state.departments.push({ id: uid("dep"), active: true, ...data });
    saveState();
    render();
  });
  document.querySelectorAll(".save-prompt").forEach((button) => button.addEventListener("click", () => {
    const type = alertType(button.dataset.id);
    type.prompt = document.querySelector(`.prompt-input[data-id="${button.dataset.id}"]`).value;
    saveState();
    render();
  }));
  document.querySelector("#manualDutyForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const user = userById(data.userId);
    if (!user || user.role !== "hospital" || !user.approved) return alert("請選擇已核准的院後端醫師。");
    state.onDuty.push({
      id: uid("od"),
      userId: user.id,
      hospitalId: user.hospitalId,
      departmentId: user.departmentId,
      dutyDate: data.dutyDate || today(),
      dutyStart: data.dutyStart || "",
      dutyEnd: data.dutyEnd || "",
      active: true,
    });
    saveState();
    render();
  });
  document.querySelectorAll(".toggle-duty").forEach((button) => button.addEventListener("click", () => {
    const duty = state.onDuty.find((item) => item.id === button.dataset.id);
    duty.active = !duty.active;
    saveState();
    render();
  }));
  document.querySelector("#importSchedule")?.addEventListener("click", () => {
    parseCsv(document.querySelector("#scheduleCsv").value).forEach((row) => {
      const hospital = state.hospitals.find((item) => item.name === row.hospital);
      const department = state.departments.find((item) => item.name === row.department);
      if (!hospital || !department) return;
      let user = state.users.find((item) => item.phone === row.phone);
      if (!user) {
        user = { id: uid("u"), role: "hospital", name: row.name, phone: row.phone, password: row.phone, hospitalId: hospital.id, departmentId: department.id, approved: true };
        state.users.push(user);
      } else {
        Object.assign(user, { name: row.name || user.name, hospitalId: hospital.id, departmentId: department.id, approved: true, password: user.password || user.phone });
      }
      state.onDuty.push({
        id: uid("od"),
        userId: user.id,
        hospitalId: hospital.id,
        departmentId: department.id,
        dutyDate: row.dutyDate || today(),
        dutyStart: row.dutyStart || "",
        dutyEnd: row.dutyEnd || "",
        active: true,
      });
    });
    saveState();
    render();
  });
  document.querySelector("#excelSchedule")?.addEventListener("change", (event) => {
    const file = event.target.files[0];
    const preview = document.querySelector("#excelPreview");
    if (!file || !preview) return;
    preview.textContent = `已選擇 ${file.name}。Demo 會先保留此檔作為 AI 解析入口；正式版會解析日期、醫院、科別、醫師與電話後產生匯入預覽。`;
  });
}

function sampleCsv() {
  return `hospital,department,name,phone,dutyDate,dutyStart,dutyEnd
土城醫院,急診醫學科,陳承彬,0986994929,${today()},08:00,17:00
土城醫院,心臟內科,請填姓名,請填手機,${today()},08:00,17:00
土城醫院,心臟外科,請填姓名,請填手機,${today()},17:00,23:00
亞東醫院,急診醫學科,請填姓名,請填手機,${today()},08:00,17:00
亞東醫院,急診醫學科,夜班醫師,請填手機,${today()},20:00,08:00`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map((header) => header.trim());
  return lines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

function bindModal() {
  document.querySelector("#closeModal")?.addEventListener("click", () => {
    selectedAlertId = "";
    render();
  });
}

function startAlarm() {
  if (audio.timer) return;
  const play = () => {
    try {
      if (navigator.vibrate) navigator.vibrate([500, 180, 500]);
      audio.context = audio.context || new AudioContext();
      audio.oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      audio.oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      audio.oscillator.connect(gain);
      gain.connect(audio.context.destination);
      audio.oscillator.start();
      window.setTimeout(() => {
        audio.oscillator?.stop();
        audio.oscillator = null;
      }, 420);
    } catch {
      stopAlarm();
    }
  };
  play();
  audio.timer = window.setInterval(play, 1400);
}

function stopAlarmIfNotNeeded() {
  if (!(session?.role === "hospital" || (session?.role === "admin" && view === "adminHospital"))) {
    stopAlarm();
    return;
  }
  const hasPending = hospitalRelevantAlerts().some((alert) => alert.status === "notified");
  if (!hasPending) stopAlarm();
}

function stopAlarm() {
  if (audio.timer) window.clearInterval(audio.timer);
  audio.timer = null;
  if (navigator.vibrate) navigator.vibrate(0);
  try {
    audio.oscillator?.stop();
  } catch {}
  audio.oscillator = null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function initApp() {
  state = migrateState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  await loadStateFromServer();
  session = loadSession();
  if (session?.id && !userById(session.id)?.approved) {
    session = null;
    saveSession();
  }
  render();
  window.setInterval(pollServerState, 3000);
  window.setInterval(() => {
    const clock = document.querySelector("#homeClock");
    if (clock) clock.textContent = nowText();
  }, 1000);
}

initApp();
