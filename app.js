const STORAGE_KEY = "prehospital-critical-alert-test-v1";
const SESSION_KEY = "prehospital-critical-alert-session-v2";
const REMEMBER_KEY = "prehospital-critical-alert-remember-v1";
const API_STATE_URL = "./api/state";
const MAX_ALERT_IMAGE_CHARS = 650000;
const ALERT_IMAGES_TO_KEEP = 3;
const EKG_IMAGE_MAX_WIDTH = 900;
const EKG_IMAGE_QUALITY = 0.62;

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
let uploadImageInfo = "";
let selectedAlertTypeId = "";
let selectedAlertId = "";
let audio = { context: null, oscillator: null, gain: null, timer: null };
let pendingDeletedUserIds = [];
let pendingDeletedDutyIds = [];
let pendingCanceledAlertIds = [];
let authMessage = "";
let dutyRosterDate = today();
let dutyHospitalFilter = "all";
let alertAudioUnlocked = false;
let alertComposerMessage = "";
let historyExpanded = false;
let hospitalHistoryExpanded = false;
let adminRecordsExpanded = false;
let statsRange = {
  typeId: "all",
  start: monthStart(),
  end: today(),
};
const notifiedAlertIds = new Set();
const ALERT_VIBRATION_PATTERN = [900, 180, 900, 180, 1400, 240, 900];

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
  compactAlertImages(next);
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
  compactAlertImages(state);
  writeStateToLocalStorage();
  syncStateToServer();
}

function writeStateToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    compactAlertImages(state, true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function compactAlertImages(targetState, force = false) {
  const alerts = targetState.alerts || [];
  let keptImages = 0;
  alerts
    .slice()
    .sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0))
    .forEach((alert) => {
      if (!alert.image) return;
      keptImages += 1;
      const shouldRemove = force || alert.image.length > MAX_ALERT_IMAGE_CHARS || keptImages > ALERT_IMAGES_TO_KEEP;
      if (!shouldRemove) return;
      alert.image = "";
      alert.imageRemoved = true;
      if (!Array.isArray(alert.audit)) alert.audit = [];
      const note = "EKG 影像因容量限制已移除，通報文字與回覆紀錄保留";
      if (!alert.audit.includes(note)) alert.audit.push(note);
    });
}

function applyPendingCanceledAlerts() {
  if (!pendingCanceledAlertIds.length) return;
  state.alerts.forEach((alert) => {
    if (!pendingCanceledAlertIds.includes(alert.id)) return;
    alert.status = "canceled";
    alert.canceledBy = alert.canceledBy || session?.id || "";
    alert.canceledAt = alert.canceledAt || nowText();
  });
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
    applyPendingCanceledAlerts();
    writeStateToLocalStorage();
    if ((payload.state.alerts || []).some((alert) => alert.image && alert.image.length > MAX_ALERT_IMAGE_CHARS)) syncStateToServer();
    refreshSessionFromState();
    return true;
  } catch {
    return false;
  }
}

async function syncStateToServer() {
  try {
    const deletedUserIds = [...pendingDeletedUserIds];
    const deletedDutyIds = [...pendingDeletedDutyIds];
    const response = await fetch(API_STATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, deletedUserIds, deletedDutyIds }),
    });
    if (response.ok && deletedUserIds.length) {
      pendingDeletedUserIds = pendingDeletedUserIds.filter((id) => !deletedUserIds.includes(id));
    }
    if (response.ok && deletedDutyIds.length) {
      pendingDeletedDutyIds = pendingDeletedDutyIds.filter((id) => !deletedDutyIds.includes(id));
    }
    if (response.ok && pendingCanceledAlertIds.length) {
      pendingCanceledAlertIds = pendingCanceledAlertIds.filter((id) => !state.alerts.some((alert) => alert.id === id && alert.status === "canceled"));
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
  const startDate = duty.dutyDate || today();
  const endDate = duty.dutyEndDate || startDate;
  if (!duty.dutyStart && !duty.dutyEnd) return `${startDate} 全天`;
  return `${startDate} ${timeLabel(duty.dutyStart || "00:00")} - ${endDate} ${timeLabel(duty.dutyEnd || "23:59")}`;
}

function timeLabel(value) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value || "";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? "上午" : "下午";
  const hour12 = hour % 12 || 12;
  return `${period} ${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeOptions(selectedValue) {
  const values = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute of [0, 30]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      values.push(`<option value="${value}" ${selectedValue === value ? "selected" : ""}>${timeLabel(value)}</option>`);
    }
  }
  return values.join("");
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function addMonths(dateValue, months) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return dateKey(date);
}

function monthStart(date = new Date()) {
  return dateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function quarterStart(date = new Date()) {
  return dateKey(new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1));
}

function yearStart(date = new Date()) {
  return dateKey(new Date(date.getFullYear(), 0, 1));
}

function statsRangeBounds() {
  return {
    start: statsRange.start || "",
    end: statsRange.end || "",
    label: `${statsRange.start || "未設定"} 至 ${statsRange.end || "未設定"}`,
  };
}

function alertDateKey(alert) {
  if (alert.createdMs) return dateKey(new Date(alert.createdMs));
  const matched = String(alert.createdAt || "").match(/\d{4}\/\d{1,2}\/\d{1,2}|\d{4}-\d{1,2}-\d{1,2}/);
  if (!matched) return "";
  return matched[0].replaceAll("/", "-").split("-").map((part, index) => (index === 0 ? part : part.padStart(2, "0"))).join("-");
}

function alertsInStatsRange(alerts) {
  const { start, end } = statsRangeBounds();
  return alerts.filter((alert) => {
    if (statsRange.typeId !== "all" && alert.typeId !== statsRange.typeId) return false;
    const created = alertDateKey(alert);
    if (!created) return true;
    if (start && created < start) return false;
    if (end && created > end) return false;
    return true;
  });
}

function dutyEndDate(duty) {
  if (duty.dutyEndDate) return duty.dutyEndDate;
  const start = timeToMinutes(duty.dutyStart);
  const end = timeToMinutes(duty.dutyEnd);
  if (start !== null && end !== null && start > end) return addDays(duty.dutyDate, 1);
  return duty.dutyDate;
}

function dutyIntersectsDate(duty, dateValue) {
  return duty.dutyDate <= dateValue && dutyEndDate(duty) >= dateValue;
}

function isDutyActiveNow(duty) {
  if (!duty.active) return false;
  const endDate = dutyEndDate(duty);
  const start = timeToMinutes(duty.dutyStart);
  const end = timeToMinutes(duty.dutyEnd);
  const currentDate = today();
  if (start === null && end === null) return dutyIntersectsDate(duty, currentDate);
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  if (currentDate < duty.dutyDate || currentDate > endDate) return false;
  if (currentDate === duty.dutyDate && start !== null && current < start) return false;
  if (currentDate === endDate && end !== null && current > end) return false;
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
  return canvas.toDataURL("image/jpeg", EKG_IMAGE_QUALITY);
}

function downscaleImage(source, maxWidth = EKG_IMAGE_MAX_WIDTH, quality = EKG_IMAGE_QUALITY) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = reject;
    image.src = source;
  });
}

function dataUrlSizeKb(value) {
  const base64 = String(value || "").split(",")[1] || "";
  return Math.round((base64.length * 3) / 4 / 1024);
}

function imageInfoText(value) {
  if (!value) return "";
  return `已壓縮為寬度不超過 ${EKG_IMAGE_MAX_WIDTH}px，約 ${dataUrlSizeKb(value)} KB`;
}

async function fitImageForAlert(source) {
  const attempts = [
    [EKG_IMAGE_MAX_WIDTH, EKG_IMAGE_QUALITY],
    [800, 0.58],
    [700, 0.54],
    [600, 0.5],
  ];
  let fitted = source;
  for (const [width, quality] of attempts) {
    fitted = await downscaleImage(source, width, quality);
    if (fitted.length <= MAX_ALERT_IMAGE_CHARS) return fitted;
  }
  return fitted;
}

function readCompressedImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        resolve(await fitImageForAlert(reader.result));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const alert = {
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
  };
  alert.audit.push(recipients.length ? `通知對象：${recipients.map((recipient) => `${recipient.name}/${departmentName(recipient.departmentId)}`).join("、")}` : "沒有符合目前值班條件的接收者");
  state.alerts.push(alert);
  saveState();
  return alert;
}

function statusText(status) {
  return {
    notified: "已通知",
    accepted: "已接收",
    activated: "已啟動",
    declined: "不啟動",
    callback: "回撥電話",
    canceled: "已取消",
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
    canceled: "done",
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

function userOnlineText(userId) {
  const user = userById(userId);
  if (!user) return "未登入";
  return isOnline(user) ? "在線" : `未在線${user.lastSeenAt ? `，最後在線 ${user.lastSeenAt}` : ""}`;
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
        <div class="notice" id="authMessage" ${authMessage ? "" : "hidden"}>${escapeHtml(authMessage)}</div>
        <div class="actions">
          <button type="button" id="loginSubmit">登入</button>
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
    if (view === "alertType") return renderAlertTypeChooser();
    if (view === "alert") return renderAlertComposer();
    return renderAdmin();
  }
  if (session.role === "hospital") return renderHospitalUser();
  if (view === "alertType") return renderAlertTypeChooser();
  return view === "alert" ? renderAlertComposer() : renderPrehospitalHome();
}

function renderPrehospitalHome() {
  const myAlerts = state.alerts.filter((alert) => alert.sender.userId === session.id).slice().reverse();
  const recentAlerts = myAlerts.slice(0, 2);
  const historyAlerts = myAlerts.slice(2);
  return `
    <section class="grid two">
      <section class="panel">
        <h2>院前端通報</h2>
        <div class="meta"><span>${stationName(session.stationId)}</span><span>${session.phone}</span></div>
        <button id="startAlert">通報</button>
      </section>
      <section class="panel">
        <div class="toolbar"><h2>我的通報紀錄</h2><button class="secondary" id="refresh">更新</button></div>
        <div class="list">${recentAlerts.length ? recentAlerts.map(renderAlertCard).join("") : `<div class="muted">尚無通報</div>`}</div>
      </section>
      <section class="panel">
        <div class="toolbar">
          <h2>歷史通報</h2>
          <button type="button" class="secondary" id="toggleHistoryAlerts">${historyExpanded ? "收合" : "展開"} ${historyAlerts.length} 筆</button>
        </div>
        ${historyExpanded ? `<div class="list">${historyAlerts.length ? historyAlerts.map(renderAlertCard).join("") : `<div class="muted">尚無歷史通報</div>`}</div>` : `<div class="muted">已收合 ${historyAlerts.length} 筆歷史通報</div>`}
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
  const filteredAlerts = alertsInStatsRange(alerts);
  const stats = statsFor(filteredAlerts);
  const range = statsRangeBounds();
  const typeOptions = [["all", "全部重症"], ...state.alertTypes.map((type) => [type.id, type.name])];
  const typeLabel = typeOptions.find(([value]) => value === statsRange.typeId)?.[1] || "全部重症";
  return `
    <section class="panel">
      <div class="toolbar">
        <h2>${title}</h2>
        <span class="status opened">${typeLabel} / ${range.label}</span>
      </div>
      <div class="grid three compact-controls">
        <label>重症類別
          <select id="statsTypeFilter">
            ${typeOptions.map(([value, label]) => `<option value="${value}" ${statsRange.typeId === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>開始日期<input id="statsRangeStart" type="date" value="${statsRange.start || range.start}" /></label>
        <label>結束日期<input id="statsRangeEnd" type="date" value="${statsRange.end || range.end}" /></label>
      </div>
      <div class="notice">成功率目前以「成功啟動案件 / 總通報案件」計算；目前納入 ${filteredAlerts.length} / ${alerts.length} 筆。</div>
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
  const type = alertType(selectedAlertTypeId) || state.alertTypes.find((item) => item.active);
  if (!type) return `
    <section class="panel">
      <div class="toolbar">
        <h2>發起通報</h2>
        <button type="button" class="secondary" id="backToAlertType">返回</button>
      </div>
      <div class="muted">目前沒有可用的通報類別，請先到管理頁面新增。</div>
    </section>
  `;
  return `
    <form class="panel" id="alertForm">
      <div class="toolbar">
        <h2>${type.name} 通報</h2>
        <button type="button" class="secondary" id="backToAlertType">返回</button>
      </div>
      <div class="grid two">
        <input type="hidden" name="typeId" value="${type.id}" />
        <label>後送醫院<select name="hospitalId">${activeHospitals().map((hospital) => `<option value="${hospital.id}">${hospital.name}</option>`).join("")}</select></label>
      </div>
      <div class="notice" id="alertComposerMessage" ${alertComposerMessage ? "" : "hidden"}>${escapeHtml(alertComposerMessage)}</div>
      <div id="typeFlow">${renderTypeFlow(type.id)}</div>
      <button type="submit">送出通報</button>
    </form>
  `;
}

function renderAlertTypeChooser() {
  const types = state.alertTypes.filter((type) => type.active);
  return `
    <section class="panel wide-panel">
      <div class="toolbar">
        <h2>選擇通報案件</h2>
        <button type="button" class="secondary" id="backDashboard">返回</button>
      </div>
      <div class="alert-type-grid">
        ${types.length ? types.map(renderAlertTypeButton).join("") : `<div class="muted">目前沒有可用的通報類別，請先到管理頁面新增。</div>`}
      </div>
    </section>
  `;
}

function alertTypeTone(typeId) {
  return {
    stemi: "tone-red",
    stroke: "tone-blue",
    trauma: "tone-orange",
    ecmo: "tone-purple",
  }[typeId] || "tone-green";
}

function alertTypeHint(type) {
  if (type.id === "stemi") return "EKG 判讀與心導管啟動";
  if (type.id === "stroke") return "急性腦梗塞流程";
  if (type.id === "trauma") return "重大創傷與大量輸血";
  if (type.id === "ecmo") return "ECMO 團隊評估";
  return type.routeDepartments.map(departmentName).join("、") || "急重症通報";
}

function renderAlertTypeButton(type) {
  return `
    <button type="button" class="alert-type-card ${alertTypeTone(type.id)}" data-alert-type="${type.id}">
      <strong>${type.name}</strong>
      <span>${alertTypeHint(type)}</span>
    </button>
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
      ${uploadImageInfo ? `<div class="small">${escapeHtml(uploadImageInfo)}</div>` : ""}
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
  const recipientText = alert.recipients.map((recipient) => `${recipient.name}/${departmentName(recipient.departmentId)}（${userOnlineText(recipient.userId)}）`).join("、") || "無";
  const canCancel = alert.sender.userId === session.id && ["notified", "accepted", "no-duty"].includes(alert.status);
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
        <span>通知：${recipientText}</span>
      </div>
      ${alert.response ? `<div class="${alert.response === "啟動" ? "result-stemi" : "result-non"}">回覆：${alert.response}</div>` : ""}
      <div class="actions">
        <button class="secondary view-alert" data-id="${alert.id}">檢視</button>
        ${canCancel ? `<button class="danger cancel-alert" data-id="${alert.id}">取消通報</button>` : ""}
      </div>
    </article>
  `;
}

function renderHospitalUser() {
  const relevant = hospitalRelevantAlerts().slice().reverse();
  const pendingAlerts = relevant.filter((alert) => alert.status === "notified");
  const recentAlerts = relevant.slice(0, 3);
  const historyAlerts = relevant.slice(3);
  const ringing = pendingAlerts.length > 0;
  if (ringing) triggerAlertReminders(pendingAlerts);
  return `
    <section class="grid two">
      <section class="panel">
        <div class="toolbar">
          <h2>接收與回覆</h2>
          ${ringing ? `<span class="status alert">持續提醒</span>` : `<span class="status done">無待接收</span>`}
        </div>
        <div class="meta"><span>${hospitalName(session.hospitalId)}</span><span>${departmentName(session.departmentId)}</span><span>${session.phone}</span></div>
        <div class="notice">${reminderStatusText()}</div>
        <div class="list">${recentAlerts.length ? recentAlerts.map(renderHospitalAlert).join("") : `<div class="muted">目前沒有派送給你的通報</div>`}</div>
      </section>
      <section class="panel">
        <div class="toolbar">
          <h2>院後端歷史通報</h2>
          <button type="button" class="secondary" id="toggleHospitalHistory">${hospitalHistoryExpanded ? "收合" : "展開"} ${historyAlerts.length} 筆</button>
        </div>
        ${hospitalHistoryExpanded ? `<div class="list">${historyAlerts.length ? historyAlerts.map(renderHospitalAlert).join("") : `<div class="muted">尚無歷史通報</div>`}</div>` : `<div class="muted">已收合 ${historyAlerts.length} 筆歷史通報</div>`}
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
      <form id="alertTypeForm" class="grid two">
        <label>疾病/通報名稱<input name="name" required placeholder="例如：敗血症、OHCA" /></label>
        <label>通知科別
          <select name="routeDepartments" multiple required>
            ${activeDepartments().map((department) => `<option value="${department.id}" ${department.id === "dep-er" ? "selected" : ""}>${department.name}</option>`).join("")}
          </select>
        </label>
        <label class="wide-field">提示文字<textarea name="prompt" placeholder="請輸入院前端填寫前要看到的提醒文字"></textarea></label>
        <button type="submit">新增通報疾病</button>
      </form>
      <div class="list">${state.alertTypes.map(renderAlertTypeAdmin).join("")}</div>
    </section>
  `;
}

function renderDutyPanel() {
  const hospitalOptions = [`<option value="all">全部醫院</option>`]
    .concat(activeHospitals().map((hospital) => `<option value="${hospital.id}" ${dutyHospitalFilter === hospital.id ? "selected" : ""}>${hospital.name}</option>`))
    .join("");
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
        <label>開始日期<input name="dutyDate" type="date" value="${today()}" required /></label>
        <label>開始時間<select name="dutyStart">${timeOptions("08:00")}</select></label>
        <label>結束日期<input name="dutyEndDate" type="date" value="${today()}" required /></label>
        <label>結束時間<select name="dutyEnd">${timeOptions("17:00")}</select></label>
        <button type="submit">加入值班</button>
      </form>
      <div class="notice">排班只從已核准的院後端醫師帳號選取；醫院與科別會沿用該醫師帳號資料。跨午夜班請把結束日期選到隔天，例如今天下午 08:00 到明天上午 08:00。</div>
      <section class="duty-roster-controls">
        <label>查看日期<input id="dutyRosterDate" type="date" value="${dutyRosterDate}" /></label>
        <label>醫院篩選<select id="dutyHospitalFilter">${hospitalOptions}</select></label>
      </section>
      ${renderDutyRoster()}
      <label>CSV 匯入<textarea id="scheduleCsv">${sampleCsv()}</textarea></label>
      <label>AI 輔助判讀 Excel<input id="excelSchedule" type="file" accept=".xlsx,.xls,.csv" /></label>
      <div class="notice">目前 Demo 可先上傳檔案並產生預覽區；正式版會將 Excel 送到後端/AI 解析後，再由管理者確認匯入。</div>
      <div id="excelPreview" class="small muted">尚未上傳 Excel 班表。</div>
      <button id="importSchedule">匯入班表</button>
    </section>
  `;
}

function renderDutyRoster() {
  const hospitals = activeHospitals().filter((hospital) => dutyHospitalFilter === "all" || hospital.id === dutyHospitalFilter);
  return `
    <section class="duty-roster">
      ${hospitals.map(renderHospitalDutySection).join("") || `<div class="muted">沒有符合條件的醫院</div>`}
    </section>
  `;
}

function renderHospitalDutySection(hospital) {
  const duties = state.onDuty.filter((duty) => dutyIntersectsDate(duty, dutyRosterDate) && duty.hospitalId === hospital.id);
  const activeDepartmentIds = new Set([...activeDepartments().map((department) => department.id), ...duties.map((duty) => duty.departmentId)]);
  const departments = [...activeDepartmentIds]
    .map((id) => state.departments.find((department) => department.id === id) || { id, name: departmentName(id) })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  return `
    <section class="duty-hospital">
      <div class="item-head">
        <h3>${hospital.name}</h3>
        <span class="status opened">${duties.filter((duty) => duty.active).length} 人當班</span>
      </div>
      <div class="duty-departments">
        ${departments.map((department) => renderDepartmentDutySection(hospital.id, department)).join("")}
      </div>
    </section>
  `;
}

function renderDepartmentDutySection(hospitalId, department) {
  const duties = state.onDuty
    .filter((duty) => dutyIntersectsDate(duty, dutyRosterDate) && duty.hospitalId === hospitalId && duty.departmentId === department.id)
    .sort((a, b) => `${a.dutyStart || ""}${userById(a.userId)?.name || ""}`.localeCompare(`${b.dutyStart || ""}${userById(b.userId)?.name || ""}`, "zh-Hant"));
  return `
    <section class="duty-department">
      <div class="item-head">
        <strong>${department.name}</strong>
        <span class="muted">${duties.length ? `${duties.length} 筆` : "尚無排班"}</span>
      </div>
      <div class="list">
        ${duties.map(renderDutyAdmin).join("") || `<div class="muted">此科別目前沒有排班</div>`}
      </div>
    </section>
  `;
}

function renderAdminRecordsPanel() {
  const alerts = state.alerts.slice().reverse();
  const recentAlerts = alerts.slice(0, 3);
  const historyAlerts = alerts.slice(3);
  return `
    <section class="panel wide-panel">
      <div class="toolbar">
        <h2>後台紀錄</h2>
        <button type="button" class="secondary" id="toggleAdminRecords">${adminRecordsExpanded ? "收合" : "展開"} ${historyAlerts.length} 筆歷史紀錄</button>
      </div>
      <div class="list">${recentAlerts.length ? recentAlerts.map(renderAdminAlertRecord).join("") : `<div class="muted">尚無通報</div>`}</div>
      ${adminRecordsExpanded ? `<div class="list">${historyAlerts.length ? historyAlerts.map(renderAdminAlertRecord).join("") : `<div class="muted">尚無歷史紀錄</div>`}</div>` : `<div class="muted">已收合 ${historyAlerts.length} 筆歷史紀錄</div>`}
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
  const recipientText = alert.recipients.map((recipient) => `${recipient.name}/${departmentName(recipient.departmentId)}（${userOnlineText(recipient.userId)}）`).join("、") || "無";
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
      <div class="meta"><span>通知名單：${recipientText}</span></div>
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
      <div class="actions">
        <button class="secondary toggle-duty" data-id="${duty.id}">${duty.active ? "停用" : "啟用"}</button>
        <button class="danger remove-duty" data-id="${duty.id}">移除</button>
      </div>
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
    authMessage = "";
    render();
  }));
  const handleLogin = async (event) => {
    event.preventDefault();
    const form = document.querySelector("#loginForm");
    const message = document.querySelector("#authMessage");
    const button = document.querySelector("#loginSubmit");
    const setMessage = (text) => {
      authMessage = text;
      if (message) {
        message.textContent = text;
        message.hidden = !text;
      }
    };
    const data = new FormData(form);
    const phone = String(data.get("phone") || "").trim();
    const password = String(data.get("password") || "").trim();
    if (!phone || !password) {
      setMessage("請先輸入電話號碼與密碼。");
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = "登入中";
    }
    setMessage("正在確認帳號狀態...");
    await loadStateFromServer();
    const user = state.users.find((item) => item.phone === phone && item.approved && (item.password || item.phone) === password);
    if (!user) {
      if (button) {
        button.disabled = false;
        button.textContent = "登入";
      }
      setMessage("找不到已核准帳號，或密碼不正確。請確認管理者已核准，並使用帳號管理中的電話與密碼。");
      return;
    }
    authMessage = "";
    session = structuredClone(user);
    saveSession();
    touchCurrentUser(true);
    view = "dashboard";
    render();
  };
  document.querySelector("#loginForm")?.addEventListener("submit", handleLogin);
  document.querySelector("#loginSubmit")?.addEventListener("click", handleLogin);
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
  document.querySelector("#toggleHistoryAlerts")?.addEventListener("click", () => {
    historyExpanded = !historyExpanded;
    render();
  });
  document.querySelector("#toggleHospitalHistory")?.addEventListener("click", () => {
    hospitalHistoryExpanded = !hospitalHistoryExpanded;
    render();
  });
  bindStatsRangeControls();
  document.querySelectorAll(".view-alert").forEach((button) => button.addEventListener("click", () => {
    selectedAlertId = button.dataset.id;
    render();
  }));
  document.querySelectorAll(".cancel-alert").forEach((button) => button.addEventListener("click", () => {
    const item = state.alerts.find((alert) => alert.id === button.dataset.id);
    if (!item || item.sender.userId !== session.id || !["notified", "accepted", "no-duty"].includes(item.status)) return;
    if (!confirm(`確定要取消 ${alertType(item.typeId)?.name || item.typeId} 通報嗎？取消後院後端將不再提醒。`)) return;
    item.status = "canceled";
    item.canceledBy = session.id;
    item.canceledAt = nowText();
    if (!pendingCanceledAlertIds.includes(item.id)) pendingCanceledAlertIds.push(item.id);
    item.audit.push(`${nowText()} ${session.name} 取消通報`);
    saveState();
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

function bindStatsRangeControls() {
  document.querySelectorAll("#statsTypeFilter").forEach((select) => select.addEventListener("change", (event) => {
    statsRange.typeId = event.currentTarget.value || "all";
    render();
  }));
  document.querySelectorAll("#statsRangeStart").forEach((input) => input.addEventListener("change", (event) => {
    statsRange.start = event.currentTarget.value;
    render();
  }));
  document.querySelectorAll("#statsRangeEnd").forEach((input) => input.addEventListener("change", (event) => {
    statsRange.end = event.currentTarget.value;
    render();
  }));
}

function bindPrehospital() {
  document.querySelector("#startAlert")?.addEventListener("click", () => {
    view = "alertType";
    selectedAlertTypeId = "";
    uploadImage = "";
    uploadImageInfo = "";
    alertComposerMessage = "";
    render();
  });
  document.querySelector("#backDashboard")?.addEventListener("click", () => {
    view = session.role === "admin" ? "adminPrehospital" : "dashboard";
    selectedAlertTypeId = "";
    uploadImage = "";
    uploadImageInfo = "";
    alertComposerMessage = "";
    render();
  });
  document.querySelectorAll(".alert-type-card").forEach((button) => button.addEventListener("click", () => {
    selectedAlertTypeId = button.dataset.alertType;
    uploadImage = "";
    uploadImageInfo = "";
    alertComposerMessage = "";
    view = "alert";
    render();
  }));
  document.querySelector("#backToAlertType")?.addEventListener("click", () => {
    view = "alertType";
    uploadImage = "";
    uploadImageInfo = "";
    alertComposerMessage = "";
    render();
  });
  if (document.querySelector("#typeFlow")) bindFlowControls();
  document.querySelector("#alertForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#alertComposerMessage");
    const setMessage = (text) => {
      alertComposerMessage = text;
      if (message) {
        message.textContent = text;
        message.hidden = !text;
      }
    };
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const type = alertType(data.typeId);
      if (!type) {
        setMessage("找不到通報類別，請重新整理頁面後再試。");
        return;
      }
      if (data.typeId === "stemi" && !uploadImage) {
        setMessage("STEMI 通報需先上傳 EKG 影像，或按「使用範例影像」後再送出。");
        return;
      }
      if (data.decision === "否") {
        setMessage("已選擇不通報，未送出通知。");
        return;
      }
      if (data.strokeWindow?.includes(">=12")) {
        setMessage("最後正常時間已超過 12 小時，Demo 依規則不送出通報。");
        return;
      }
      setMessage("正在送出通報...");
      const stemiImage = data.typeId === "stemi" ? await fitImageForAlert(uploadImage) : "";
      const extra = buildExtra(data, type);
      const alertRecord = createAlert({ typeId: data.typeId, hospitalId: data.hospitalId, extra, image: stemiImage });
      alertComposerMessage = "";
      if (alertRecord.recipients.length) {
        window.alert(`已通知：${alertRecord.recipients.map((recipient) => `${recipient.name}/${departmentName(recipient.departmentId)}`).join("、")}。對方需登入並開啟院後端頁面，手機瀏覽器允許聲音後才會即時響鈴震動。`);
      } else {
        window.alert("沒有找到目前值班且符合科別的接收者，請確認管理者頁面的值班日期、時間、醫院與科別。");
      }
      uploadImage = "";
      uploadImageInfo = "";
      selectedAlertTypeId = "";
      view = session.role === "admin" ? "adminPrehospital" : "dashboard";
      render();
    } catch (error) {
      console.error(error);
      setMessage("通報送出時發生錯誤，請重新整理頁面後再試。");
    }
  });
}

function bindFlowControls() {
  document.querySelector("#sampleImage")?.addEventListener("click", async () => {
    uploadImage = await fitImageForAlert(sampleEkgImage());
    uploadImageInfo = imageInfoText(uploadImage);
    alertComposerMessage = "";
    const flow = document.querySelector("#typeFlow");
    flow.innerHTML = renderTypeFlow("stemi");
    const message = document.querySelector("#alertComposerMessage");
    if (message) {
      message.textContent = "";
      message.hidden = true;
    }
    bindFlowControls();
  });
  document.querySelector("#ekgFile")?.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    readCompressedImage(file)
      .then((image) => {
        uploadImage = image;
        uploadImageInfo = imageInfoText(uploadImage);
        alertComposerMessage = "";
        const flow = document.querySelector("#typeFlow");
        flow.innerHTML = renderTypeFlow("stemi");
        const message = document.querySelector("#alertComposerMessage");
        if (message) {
          message.textContent = "";
          message.hidden = true;
        }
        bindFlowControls();
      })
      .catch(() => {
        uploadImageInfo = "";
        alertComposerMessage = "";
        const message = document.querySelector("#alertComposerMessage");
        if (message) {
          message.textContent = "EKG 影像讀取失敗，請重新拍攝或改用範例影像。";
          message.hidden = false;
        }
      });
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
  document.querySelector("#toggleAdminRecords")?.addEventListener("click", () => {
    adminRecordsExpanded = !adminRecordsExpanded;
    render();
  });
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
  document.querySelector("#alertTypeForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const routeDepartments = data.getAll("routeDepartments");
    state.alertTypes.push({
      id: uid("type"),
      name,
      routeDepartments: routeDepartments.length ? routeDepartments : ["dep-er"],
      active: true,
      prompt: String(data.get("prompt") || `${name} 通報，請確認是否符合通報條件。`).trim(),
    });
    saveState();
    render();
  });
  document.querySelector("#manualDutyForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const user = userById(data.userId);
    if (!user || user.role !== "hospital" || !user.approved) return alert("請選擇已核准的院後端醫師。");
    dutyRosterDate = data.dutyDate || today();
    dutyHospitalFilter = user.hospitalId;
    state.onDuty.push({
      id: uid("od"),
      userId: user.id,
      hospitalId: user.hospitalId,
      departmentId: user.departmentId,
      dutyDate: data.dutyDate || today(),
      dutyEndDate: data.dutyEndDate || data.dutyDate || today(),
      dutyStart: data.dutyStart || "",
      dutyEnd: data.dutyEnd || "",
      active: true,
    });
    saveState();
    render();
  });
  document.querySelector("#dutyRosterDate")?.addEventListener("change", (event) => {
    dutyRosterDate = event.currentTarget.value || today();
    render();
  });
  document.querySelector("#dutyHospitalFilter")?.addEventListener("change", (event) => {
    dutyHospitalFilter = event.currentTarget.value || "all";
    render();
  });
  document.querySelectorAll(".toggle-duty").forEach((button) => button.addEventListener("click", () => {
    const duty = state.onDuty.find((item) => item.id === button.dataset.id);
    duty.active = !duty.active;
    saveState();
    render();
  }));
  document.querySelectorAll(".remove-duty").forEach((button) => button.addEventListener("click", () => {
    const duty = state.onDuty.find((item) => item.id === button.dataset.id);
    if (!duty) return;
    if (!confirm(`確定要移除 ${hospitalName(duty.hospitalId)} / ${departmentName(duty.departmentId)} / ${dutyTimeText(duty)} 的值班資料嗎？`)) return;
    pendingDeletedDutyIds.push(duty.id);
    state.onDuty = state.onDuty.filter((item) => item.id !== duty.id);
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
        dutyEndDate: row.dutyEndDate || row.dutyDate || today(),
        dutyStart: row.dutyStart || "",
        dutyEnd: row.dutyEnd || "",
        active: true,
      });
      dutyRosterDate = row.dutyDate || today();
    });
    dutyHospitalFilter = "all";
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
  return `hospital,department,name,phone,dutyDate,dutyStart,dutyEndDate,dutyEnd
土城醫院,急診醫學科,陳承彬,0986994929,${today()},08:00,${today()},17:00
土城醫院,心臟內科,請填姓名,請填手機,${today()},08:00,${today()},17:00
土城醫院,心臟外科,請填姓名,請填手機,${today()},17:00,${today()},23:00
亞東醫院,急診醫學科,請填姓名,請填手機,${today()},08:00,${today()},17:00
亞東醫院,急診醫學科,夜班醫師,請填手機,${today()},20:00,${addDays(today(), 1)},08:00`;
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

function audioContextCtor() {
  return window.AudioContext || window.webkitAudioContext;
}

async function ensureAudioContext() {
  const Ctor = audioContextCtor();
  if (!Ctor) return false;
  audio.context = audio.context || new Ctor();
  if (audio.context.state === "suspended") await audio.context.resume();
  alertAudioUnlocked = audio.context.state === "running";
  return alertAudioUnlocked;
}

async function enableAlertReminders() {
  await ensureAudioContext();
  await prepareNativeAlertChannel();
  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {}
  }
  if (navigator.vibrate) navigator.vibrate([240, 80, 240]);
  try {
    await playSirenTone(700);
  } catch {}
  render();
}

function shouldAutoUnlockAlerts() {
  return session?.role === "hospital" || (session?.role === "admin" && view === "adminHospital");
}

function installReminderAutoUnlock() {
  const unlock = () => {
    if (!shouldAutoUnlockAlerts()) return;
    enableAlertReminders();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function reminderStatusText() {
  const notificationText = "Notification" in window ? `通知權限：${Notification.permission === "granted" ? "已允許" : Notification.permission === "denied" ? "已封鎖" : "尚未允許"}` : "此瀏覽器不支援通知";
  const audioText = alertAudioUnlocked ? "救護車警報音：已準備" : "救護車警報音：登入後點一下頁面即可自動準備";
  const nativeText = isNativeApp() ? "原生 App 警示：可使用手機通知與震動" : "網頁警示：需保持頁面開啟";
  return `${audioText}；${notificationText}；${nativeText}。正式背景提醒仍需推播服務。`;
}

function nativePlugins() {
  return window.Capacitor?.Plugins || {};
}

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function numericAlertId(alertId) {
  return Math.abs(String(alertId).split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)) || Date.now() % 2147483647;
}

async function prepareNativeAlertChannel() {
  const { LocalNotifications } = nativePlugins();
  if (!LocalNotifications) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch {}
  try {
    await LocalNotifications.createChannel({
      id: "critical-alerts",
      name: "急重症通報",
      description: "院前 EKG 與急重症通報提醒",
      importance: 5,
      visibility: 1,
      sound: "ems_alert.wav",
      vibration: true,
      lights: true,
      lightColor: "#ff0000",
    });
  } catch {}
}

async function showNativeNotification(alert) {
  const { LocalNotifications, Haptics } = nativePlugins();
  try {
    await Haptics?.vibrate?.({ duration: 1400 });
  } catch {}
  if (!LocalNotifications) return;
  await prepareNativeAlertChannel();
  const title = `${alertType(alert.typeId)?.name || alert.typeId} 急重症通報`;
  const body = `${hospitalName(alert.hospitalId)} / ${stationName(alert.sender.stationId)} / ${alert.sender.phone}`;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: numericAlertId(alert.id),
          title,
          body,
          channelId: "critical-alerts",
          sound: "ems_alert.wav",
          ongoing: true,
          autoCancel: false,
          extra: { alertId: alert.id },
        },
      ],
    });
  } catch {}
}

async function showDeviceNotification(alert) {
  await showNativeNotification(alert);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = `${alertType(alert.typeId)?.name || alert.typeId} 通報`;
  const body = `${hospitalName(alert.hospitalId)} / ${stationName(alert.sender.stationId)} / ${alert.sender.phone}`;
  try {
    if (navigator.serviceWorker?.ready) {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, { body, tag: alert.id, requireInteraction: true, vibrate: ALERT_VIBRATION_PATTERN });
      return;
    }
  } catch {}
  try {
    new Notification(title, { body, tag: alert.id, requireInteraction: true });
  } catch {}
}

function triggerAlertReminders(alerts) {
  startAlarm();
  alerts.forEach((alert) => {
    if (notifiedAlertIds.has(alert.id)) return;
    notifiedAlertIds.add(alert.id);
    showDeviceNotification(alert);
  });
}

async function playAlertTone() {
  await playSirenTone(850);
}

async function playSirenTone(durationMs = 1100) {
  const unlocked = await ensureAudioContext();
  if (!unlocked) return;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  const now = audio.context.currentTime;
  oscillator.type = "sawtooth";
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.24, now + 0.04);
  for (let i = 0; i < 8; i += 1) {
    const t = now + i * 0.14;
    oscillator.frequency.setValueAtTime(i % 2 === 0 ? 620 : 980, t);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  oscillator.connect(gain);
  gain.connect(audio.context.destination);
  oscillator.start(now);
  oscillator.stop(now + durationMs / 1000);
}

function startAlarm() {
  if (audio.timer) return;
  const play = async () => {
    try {
      if (navigator.vibrate) navigator.vibrate(ALERT_VIBRATION_PATTERN);
      try {
        await nativePlugins().Haptics?.vibrate?.({ duration: 1200 });
      } catch {}
      const unlocked = await ensureAudioContext();
      if (!unlocked) return;
      await playSirenTone(1200);
    } catch {
      stopAlarm();
    }
  };
  play();
  audio.timer = window.setInterval(play, 1800);
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
    nativePlugins().LocalNotifications?.cancel?.({
      notifications: hospitalRelevantAlerts().map((alert) => ({ id: numericAlertId(alert.id) })),
    });
  } catch {}
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
  writeStateToLocalStorage();
  await loadStateFromServer();
  session = loadSession();
  if (session?.id && !userById(session.id)?.approved) {
    session = null;
    saveSession();
  }
  installReminderAutoUnlock();
  render();
  window.setInterval(pollServerState, 3000);
  window.setInterval(() => {
    const clock = document.querySelector("#homeClock");
    if (clock) clock.textContent = nowText();
  }, 1000);
}

initApp();
