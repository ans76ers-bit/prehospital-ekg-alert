const STORAGE_KEY = "prehospital-critical-alert-test-v1";
const SESSION_KEY = "prehospital-critical-alert-session-v2";
const REMEMBER_KEY = "prehospital-critical-alert-remember-v1";
const API_STATE_URL = "./api/state";
const API_PUSH_TOKEN_URL = "./api/push-token";
const MAX_ALERT_IMAGE_CHARS = 650000;
const ALERT_IMAGES_TO_KEEP = 3;
const EKG_IMAGE_MAX_WIDTH = 900;
const EKG_IMAGE_QUALITY = 0.62;
const TAIWAN_CITIES = ["基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"];
const RETIRED_HOSPITAL_NAMES = ["亞東", "亞東醫院", "為恭", "為恭醫院", "違工", "違工醫院"];
const RETIRED_HOSPITAL_KEYWORDS = ["亞東", "為恭", "違工"];
const RETIRED_HOSPITAL_IDS = ["h-fy"];
const AGE_RANGE_OPTIONS = ["不詳", "0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80以上"];
const GENDER_OPTIONS = ["不詳", "男", "女"];
const FIXED_ALERT_TYPE_ORDER = ["stemi", "ohca", "trauma", "stroke"];
const DEFAULT_ECMO_CRITERIA = [
  "年齡小於 70 歲",
  "目擊倒地且有人立即 CPR",
  "初始心律為 VF/VT 或可電擊心律",
  "無臥床、癌末或其他不可逆末期疾病",
  "預估報案後 40 分鐘內可抵達醫院",
  "無明顯大出血",
].join("\n");
const ACCEPTED_RING_GRACE_MS = 10000;

const dateKey = (date = new Date()) => {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
};
const today = () => dateKey();
const nowText = () => new Date().toLocaleString("zh-TW", { hour12: false });
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

const seed = {
  brigades: [
    { id: "b-ntpc-5", city: "新北市", name: "第五救災救護大隊", active: true },
  ],
  stations: [
    { id: "s-tucheng", city: "新北市", brigadeId: "b-ntpc-5", name: "土城分隊", active: true },
    { id: "s-dingpu", city: "新北市", brigadeId: "b-ntpc-5", name: "頂埔分隊", active: true },
    { id: "s-qingshui", city: "新北市", brigadeId: "b-ntpc-5", name: "清水分隊", active: true },
    { id: "s-shulin", city: "新北市", brigadeId: "b-ntpc-5", name: "樹林分隊", active: true },
    { id: "s-shutan", city: "新北市", brigadeId: "b-ntpc-5", name: "樹潭分隊", active: true },
    { id: "s-ganyuan", city: "新北市", brigadeId: "b-ntpc-5", name: "柑園分隊", active: true },
    { id: "s-sanxia", city: "新北市", brigadeId: "b-ntpc-5", name: "三峽分隊", active: true },
    { id: "s-longen", city: "新北市", brigadeId: "b-ntpc-5", name: "隆恩分隊", active: true },
    { id: "s-yingge", city: "新北市", brigadeId: "b-ntpc-5", name: "鶯歌分隊", active: true },
    { id: "s-fengming", city: "新北市", brigadeId: "b-ntpc-5", name: "鳳鳴分隊", active: true },
  ],
  hospitals: [
    { id: "h-tu", city: "新北市", name: "土城醫院", active: true },
  ],
  departments: [
    { id: "dep-er", name: "急診醫學科", active: true },
    { id: "dep-trauma", name: "外傷科", active: true },
    { id: "dep-cardio", name: "心臟內科", active: true },
    { id: "dep-cvs", name: "心臟外科", active: true },
    { id: "dep-neuro", name: "神經內科", active: true },
    { id: "dep-other", name: "其他科", active: false },
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
      id: "ohca",
      name: "內科 OHCA",
      routeDepartments: ["dep-er"],
      ecmoRouteDepartments: ["dep-er", "dep-cvs"],
      active: true,
      prompt: `院前啟動 ECMO 參考標準：\n${DEFAULT_ECMO_CRITERIA}\n\n本段文字可由管理者修改。`,
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
let audio = { context: null, oscillator: null, gain: null, timer: null, autoStopTimer: null };
let pendingDeletedUserIds = [];
let pendingDeletedDutyIds = [];
let pendingCanceledAlertIds = [];
let authMessage = "";
let registerRole = "prehospital";
let registerStationCity = "新北市";
let registerBrigadeId = "b-ntpc-5";
let registerStationId = "s-tucheng";
let registerHospitalCity = "新北市";
let registerHospitalId = "h-tu";
let dutyRosterDate = today();
let dutyHospitalCity = "新北市";
let dutyHospitalFilter = "h-tu";
let unitHospitalCity = "新北市";
let unitHospitalId = "h-tu";
let unitStationCity = "新北市";
let unitBrigadeId = "b-ntpc-5";
let alertHospitalCity = "";
let alertAudioUnlocked = false;
let pushRegistrationStarted = false;
let nativePushToken = "";
let alertComposerMessage = "";
let historyExpanded = false;
let hospitalHistoryExpanded = false;
let adminRecordsExpanded = false;
let statsView = "hospital";
let statsHospitalCity = "all";
let statsHospitalId = "all";
let statsFireCity = "all";
let statsBrigadeId = "all";
let statsStationId = "all";
let accountRoleFilter = "prehospital";
let accountCityFilter = "all";
let accountBrigadeFilter = "all";
let accountStationFilter = "all";
let accountHospitalFilter = "all";
let accountDepartmentFilter = "all";
let statsRange = {
  typeId: "all",
  start: monthStart(),
  end: today(),
};
const notifiedAlertIds = new Set();
const ALERT_CHANNEL_ID = "critical-alerts-fire-v2";
const ALERT_VIBRATION_PATTERN = [900, 120, 900, 120, 900, 120, 1600, 180, 1200];

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
  next.brigades = mergeByName(seed.brigades, current.brigades || []);
  const brigadeByCityName = new Map(next.brigades.map((brigade) => [`${brigade.city}|${brigade.name}`, brigade]));
  next.stations = mergeByName(seed.stations, current.stations || []).map((station) => {
    const brigadeName = station.brigade || (station.city === "新北市" ? "第五救災救護大隊" : "");
    const brigade = station.brigadeId ? next.brigades.find((item) => item.id === station.brigadeId) : brigadeByCityName.get(`${station.city}|${brigadeName}`);
    return {
      ...station,
      brigadeId: brigade?.id || station.brigadeId || "",
      brigade: brigade?.name || brigadeName,
    };
  });
  next.hospitals = mergeByName(seed.hospitals, current.hospitals || []).filter((hospital) => !isRetiredHospital(hospital));
  next.departments = mergeDepartments(seed.departments, current.departments || []).map((department) => {
    const clean = { ...department, name: department.id === "dep-er" ? "急診醫學科" : department.name };
    delete clean.hospitalId;
    return clean;
  });
  next.users = mergeByPhone(seed.users, current.users || [])
    .filter((user) => !["u-admin", "u-pre-1", "u-doc-er", "u-doc-cardio", "u-doc-trauma", "u-doc-neuro", "u-doc-cvs"].includes(user.id))
    .map((user) => ({
      ...user,
      password: user.password || user.phone,
      stationId: user.stationId === "s-banqiao" ? "s-tucheng" : user.role === "admin" && !user.stationId ? "s-tucheng" : user.stationId,
    }));
  const activeHospitalIds = new Set(next.hospitals.filter((hospital) => hospital.active && !isRetiredHospital(hospital)).map((hospital) => hospital.id));
  next.onDuty = (current.onDuty || []).filter((duty) => activeHospitalIds.has(duty.hospitalId));
  next.alerts = (current.alerts || []).map((alert) => ({
    acceptedAt: "",
    acceptedMs: 0,
    respondedBy: "",
    respondedAt: "",
    response: "",
    sex: alert.sex || alert.gender || "不詳",
    ageRange: alert.ageRange || "不詳",
    ...alert,
    typeId: alert.typeId === "ecmo" ? "ohca" : alert.typeId,
  }));
  compactAlertImages(next);
  next.alertTypes = mergeAlertTypes(seed.alertTypes, current.alertTypes || []).map((type) => {
    const nextType = { ...type, id: type.id === "ecmo" ? "ohca" : type.id, name: type.id === "ecmo" ? "內科 OHCA" : type.name };
    if (type.id === "stemi") {
      return {
        ...nextType,
        routeDepartments: ["dep-er", "dep-cardio"],
        prompt: "拍攝 12 導程 EKG 後，送至後送醫院當班急診醫學科醫師與心臟內科醫師。",
      };
    }
    if (type.id === "ecmo" || type.id === "ohca") {
      return {
        ...nextType,
        name: "內科 OHCA",
        routeDepartments: ["dep-er"],
        ecmoRouteDepartments: type.ecmoRouteDepartments?.length ? type.ecmoRouteDepartments : ["dep-er", "dep-cvs"],
        prompt: type.prompt?.includes("年齡小於 70") ? type.prompt : `院前啟動 ECMO 參考標準：\n${DEFAULT_ECMO_CRITERIA}\n\n本段文字可由管理者修改。`,
      };
    }
    return nextType;
  })
    .filter((type, index, all) => FIXED_ALERT_TYPE_ORDER.includes(type.id) && all.findIndex((item) => item.id === type.id) === index)
    .sort((a, b) => FIXED_ALERT_TYPE_ORDER.indexOf(a.id) - FIXED_ALERT_TYPE_ORDER.indexOf(b.id));
  return next;
}

function mergeDepartments(requiredItems, existingItems) {
  const merged = [];
  [...existingItems, ...requiredItems].forEach((item) => {
    const key = item.id || item.name;
    const existing = merged.find((department) => department.id === item.id || department.name === item.name || department.id === key);
    const clean = { ...item, active: item.active !== false };
    delete clean.hospitalId;
    if (existing) Object.assign(existing, { ...clean, id: existing.id || clean.id });
    else merged.push(clean);
  });
  return merged;
}

function mergeAlertTypes(requiredItems, existingItems) {
  const merged = [...existingItems];
  requiredItems.forEach((required) => {
    const normalizedId = required.id === "ecmo" ? "ohca" : required.id;
    const existing = merged.find((item) => item.id === normalizedId || (normalizedId === "ohca" && item.id === "ecmo"));
    if (existing) Object.assign(existing, { ...required, ...existing, id: normalizedId });
    else merged.push({ ...required, id: normalizedId });
  });
  return merged;
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

function stationById(id) {
  return state.stations.find((item) => item.id === id);
}

function brigadeById(id) {
  return state.brigades?.find((item) => item.id === id);
}

function brigadeName(id) {
  return brigadeById(id)?.name || "未設定大隊";
}

function stationLabel(station) {
  const brigade = brigadeById(station.brigadeId)?.name || station.brigade || "";
  return [station.city, brigade, station.name].filter(Boolean).join(" ");
}

function hospitalName(id) {
  return state.hospitals.find((item) => item.id === id)?.name || "未設定醫院";
}

function isRetiredHospital(hospital) {
  const name = hospital?.name || "";
  return Boolean(
    hospital &&
      (RETIRED_HOSPITAL_IDS.includes(hospital.id) ||
        RETIRED_HOSPITAL_NAMES.includes(name) ||
        RETIRED_HOSPITAL_KEYWORDS.some((keyword) => name.includes(keyword)))
  );
}

function hospitalLabel(hospital) {
  return [hospital.city, hospital.name].filter(Boolean).join(" ");
}

function departmentName(id) {
  return state.departments.find((item) => item.id === id)?.name || "未設定科別";
}

function departmentById(id) {
  return state.departments.find((item) => item.id === id);
}

function departmentLabel(department) {
  return department.name;
}

function alertType(id) {
  return state.alertTypes.find((item) => item.id === id);
}

function userById(id) {
  return state.users.find((item) => item.id === id);
}

function clinicianLabel(user) {
  if (!user) return "尚未";
  const department = user.departmentId ? departmentName(user.departmentId) : "";
  const suffix = user.name?.includes("醫師") ? "" : "醫師";
  return [department, `${user.name}${suffix}`].filter(Boolean).join(" ");
}

function activeHospitals() {
  return state.hospitals.filter((item) => item.active && !isRetiredHospital(item));
}

function activeHospitalsForCity(city) {
  return activeHospitals().filter((hospital) => hospital.city === city);
}

function activeHospitalCities() {
  return [...new Set(activeHospitals().map((hospital) => hospital.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function hospitalCityOptions(selectedCity) {
  return cityOptions(selectedCity);
}
function normalizeRegisterStationSelection() {
  if (!TAIWAN_CITIES.includes(registerStationCity)) registerStationCity = "新北市";
  const brigades = activeBrigadesForCity(registerStationCity);
  if (!brigades.some((brigade) => brigade.id === registerBrigadeId)) registerBrigadeId = brigades[0]?.id || "";
  const stations = registerBrigadeId ? activeStationsForBrigade(registerBrigadeId) : [];
  if (!stations.some((station) => station.id === registerStationId)) registerStationId = stations[0]?.id || "";
  return { brigades, stations };
}

function normalizeRegisterHospitalSelection() {
  if (!TAIWAN_CITIES.includes(registerHospitalCity)) registerHospitalCity = "新北市";
  const hospitals = activeHospitalsForCity(registerHospitalCity);
  if (!hospitals.some((hospital) => hospital.id === registerHospitalId)) registerHospitalId = hospitals[0]?.id || "";
  return hospitals;
}

function normalizeDutyHospitalSelection() {
  const cities = activeHospitalCities();
  if (!cities.includes(dutyHospitalCity)) dutyHospitalCity = cities[0] || "新北市";
  const hospitals = activeHospitalsForCity(dutyHospitalCity);
  if (!hospitals.some((hospital) => hospital.id === dutyHospitalFilter)) dutyHospitalFilter = hospitals[0]?.id || "";
  return hospitals;
}

function activeStations() {
  return state.stations.filter((item) => item.active);
}

function activeBrigades() {
  return (state.brigades || []).filter((item) => item.active);
}

function activeBrigadesForCity(city) {
  return activeBrigades().filter((brigade) => brigade.city === city);
}

function activeStationsForBrigade(brigadeId) {
  return activeStations().filter((station) => station.brigadeId === brigadeId);
}

function activeDepartments() {
  return state.departments.filter((item) => item.active && item.id !== "dep-other" && item.name !== "其他科");
}

function activeDepartmentsForHospital(hospitalId) {
  return activeDepartments();
}

function routeDepartmentNames(departmentIds) {
  return departmentIds.map((id) => departmentName(id)).filter(Boolean);
}

function departmentMatchesRoute(departmentId, routeDepartments) {
  if (routeDepartments.includes(departmentId)) return true;
  const department = departmentById(departmentId);
  if (!department?.active) return false;
  return routeDepartmentNames(routeDepartments).includes(department.name);
}

function departmentBelongsToHospital(departmentId, hospitalId) {
  const department = departmentById(departmentId);
  const hospital = activeHospitals().find((item) => item.id === hospitalId);
  return Boolean(department?.active && hospital?.active);
}

function cityOptions(selectedCity) {
  return TAIWAN_CITIES.map((city) => `<option value="${city}" ${city === selectedCity ? "selected" : ""}>${city}</option>`).join("");
}

function cityOptionsWithAll(selectedCity) {
  return [`<option value="all" ${selectedCity === "all" ? "selected" : ""}>全部縣市</option>`, cityOptions(selectedCity)].join("");
}

function selectOptions(items, selectedValue, getLabel, allLabel = "") {
  const prefix = allLabel ? [`<option value="all" ${selectedValue === "all" ? "selected" : ""}>${allLabel}</option>`] : [];
  return prefix.concat(items.map((item) => `<option value="${item.id}" ${item.id === selectedValue ? "selected" : ""}>${getLabel(item)}</option>`)).join("");
}

function defaultAlertHospitalCity() {
  const station = stationById(session?.stationId);
  return station?.city || "新北市";
}

function normalizeAlertHospitalSelection() {
  if (!alertHospitalCity || !TAIWAN_CITIES.includes(alertHospitalCity)) alertHospitalCity = defaultAlertHospitalCity();
  let hospitals = activeHospitalsForCity(alertHospitalCity);
  if (!hospitals.length) {
    alertHospitalCity = activeHospitals()[0]?.city || "新北市";
    hospitals = activeHospitalsForCity(alertHospitalCity);
  }
  return hospitals;
}

function normalizeUnitSelections() {
  if (!TAIWAN_CITIES.includes(unitHospitalCity)) unitHospitalCity = "新北市";
  if (!TAIWAN_CITIES.includes(unitStationCity)) unitStationCity = "新北市";
  const hospitals = activeHospitalsForCity(unitHospitalCity);
  if (!hospitals.some((hospital) => hospital.id === unitHospitalId)) unitHospitalId = hospitals[0]?.id || "";
  const brigades = activeBrigadesForCity(unitStationCity);
  if (!brigades.some((brigade) => brigade.id === unitBrigadeId)) unitBrigadeId = brigades[0]?.id || "";
}

function hospitalDoctors() {
  return state.users
    .filter((user) => user.role === "hospital" && user.approved)
    .filter((user) => departmentBelongsToHospital(user.departmentId, user.hospitalId))
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
    (duty) => isDutyActiveNow(duty) && duty.hospitalId === hospitalId && departmentMatchesRoute(duty.departmentId, departments),
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
      acceptedMs: 0,
    }));
}

function alertRouteDepartments(type, extraPayload = {}) {
  if (type.id === "ohca" && extraPayload.decision === "是") return [...(type.ecmoRouteDepartments?.length ? type.ecmoRouteDepartments : ["dep-er", "dep-cvs"])];
  return [...(type.routeDepartments || [])];
}

function createAlert({ typeId, hospitalId, extra, image }) {
  const type = alertType(typeId);
  const extraPayload = typeof extra === "object" && extra !== null ? extra : { sex: "不詳", ageRange: "不詳", text: String(extra || "") };
  const recipients = recipientsFor(hospitalId, alertRouteDepartments(type, extraPayload));
  const alert = {
    id: uid("alert"),
    typeId,
    hospitalId,
    sex: extraPayload.sex || "不詳",
    ageRange: extraPayload.ageRange || "不詳",
    extraText: extraPayload.text || "",
    extra: extraPayload,
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
    acceptedMs: 0,
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
  if (session?.role === "prehospital" || (session?.role === "admin" && ["adminPrehospital", "alertType", "alert"].includes(view))) bindPrehospital();
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
          <p>STEMI、內科 OHCA、重大創傷、急性腦梗塞的院前到院後通報原型。</p>
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
  const { brigades: registerBrigades, stations: registerStations } = normalizeRegisterStationSelection();
  const registerHospitals = normalizeRegisterHospitalSelection();
  const isHospitalRegister = registerRole === "hospital";
  const isPrehospitalRegister = registerRole === "prehospital";
  return `
    <section class="login">
      <form class="login-panel" id="registerForm">
        <div class="login-title">
          <h1>註冊申請</h1>
          <p>原則上帳號需由管理者核准或事先造冊；Demo 會先列為待審核。</p>
        </div>
        <div class="tabs">
          <button type="button" class="${registerRole === "prehospital" ? "active" : ""}" data-register-role="prehospital">院前端</button>
          <button type="button" class="${registerRole === "hospital" ? "active" : ""}" data-register-role="hospital">院後端</button>
        </div>
        <input type="hidden" name="role" value="${registerRole}" />
        <div class="grid two">
          <label>姓名<input name="name" required /></label>
          <label>電話號碼<input name="phone" required /></label>
          <label>密碼<input name="password" type="password" placeholder="未填則預設為手機號碼" /></label>
          <label class="pre-register" ${isPrehospitalRegister ? "" : "hidden"}>所屬縣市
            <select id="registerStationCity">${cityOptions(registerStationCity)}</select>
          </label>
          <label class="pre-register" ${isPrehospitalRegister ? "" : "hidden"}>所屬大隊
            <select id="registerBrigadeId">${registerBrigades.map((brigade) => `<option value="${brigade.id}" ${brigade.id === registerBrigadeId ? "selected" : ""}>${brigade.name}</option>`).join("")}</select>
          </label>
          <label class="pre-register" ${isPrehospitalRegister ? "" : "hidden"}>所屬分隊
            <select name="stationId" id="registerStationId">${registerStations.map((station) => `<option value="${station.id}" ${station.id === registerStationId ? "selected" : ""}>${station.name}</option>`).join("")}</select>
          </label>
          <label class="hospital-register" ${isHospitalRegister ? "" : "hidden"}>所屬縣市
            <select id="registerHospitalCity">${hospitalCityOptions(registerHospitalCity)}</select>
          </label>
          <label class="hospital-register" ${isHospitalRegister ? "" : "hidden"}>所屬醫院
            <select name="hospitalId" id="registerHospitalId">${registerHospitals.map((hospital) => `<option value="${hospital.id}" ${hospital.id === registerHospitalId ? "selected" : ""}>${hospital.name}</option>`).join("")}</select>
          </label>
          <label class="hospital-register" ${isHospitalRegister ? "" : "hidden"}>所屬科別
            <select name="departmentId">${activeDepartments().map((dep) => `<option value="${dep.id}">${departmentLabel(dep)}</option>`).join("")}</select>
          </label>
        </div>
        <div class="notice pre-register" ${isPrehospitalRegister ? "" : "hidden"}>如果你所屬的單位沒有在選單中，請洽管理者先於單位設定新增大隊與分隊後再註冊。</div>
        <div class="notice hospital-register" ${isHospitalRegister ? "" : "hidden"}>如果你所屬的醫院沒有在選單中，請洽管理者先於單位設定新增醫院後再註冊。</div>
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
      <button type="button" class="${["adminPrehospital", "alertType", "alert"].includes(view) ? "active" : ""}" data-admin-view="adminPrehospital">院前端測試</button>
      <button type="button" class="${view === "adminHospital" ? "active" : ""}" data-admin-view="adminHospital">院後端測試</button>
      <button type="button" class="${!["adminPrehospital", "adminHospital", "alertType", "alert", "profile"].includes(view) ? "active" : ""}" data-admin-view="dashboard">管理頁面</button>
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

function currentAlertRecipient(alert) {
  if (!session?.id) return null;
  return alert.recipients?.find((recipient) => recipient.userId === session.id) || null;
}

function acceptedElapsedMs(alert) {
  const acceptedMs = Number(alert.acceptedMs || 0);
  if (acceptedMs) return Date.now() - acceptedMs;
  const parsed = Date.parse(alert.acceptedAt || "");
  return Number.isNaN(parsed) ? 0 : Date.now() - parsed;
}

function shouldRingForCurrentUser(alert) {
  const recipient = currentAlertRecipient(alert);
  if (!recipient) return false;
  if (recipient.acceptedAt) return false;
  if (alert.status === "notified") return true;
  if (alert.status === "accepted" && alert.acceptedBy !== session.id) {
    const elapsed = acceptedElapsedMs(alert);
    return elapsed ? elapsed < ACCEPTED_RING_GRACE_MS : true;
  }
  return false;
}

function ringingAlertsForCurrentUser() {
  return hospitalRelevantAlerts().filter(shouldRingForCurrentUser);
}

function alertDecisionMeta(alert) {
  const acceptedUser = alert.acceptedBy ? userById(alert.acceptedBy) : null;
  const responseUser = alert.respondedBy ? userById(alert.respondedBy) : null;
  const acceptedText = acceptedUser ? `${clinicianLabel(acceptedUser)} 接收` : "尚未有人接收";
  const decisionText = alert.response ? `${clinicianLabel(responseUser || acceptedUser)} 決定：${alert.response}` : "尚未決定啟動/不啟動";
  return `
    <div class="meta">
      <span>接收狀態：${acceptedText}</span>
      <span>決定狀態：${decisionText}</span>
    </div>
  `;
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
        <button id="startAlert" class="emergency-alert-button">通報案件</button>
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
            <select name="stationId">${activeStations().map((station) => `<option value="${station.id}" ${station.id === session.stationId ? "selected" : ""}>${stationLabel(station)}</option>`).join("")}</select>
          </label>
        ` : ""}
        ${session.role === "hospital" || session.role === "admin" ? `
          <label>所屬醫院
            <select name="hospitalId">${activeHospitals().map((hospital) => `<option value="${hospital.id}" ${hospital.id === session.hospitalId ? "selected" : ""}>${hospitalLabel(hospital)}</option>`).join("")}</select>
          </label>
          <label>所屬科別
            <select name="departmentId">${activeDepartments().map((department) => `<option value="${department.id}" ${department.id === session.departmentId ? "selected" : ""}>${departmentLabel(department)}</option>`).join("")}</select>
          </label>
        ` : ""}
      </div>
      <div class="actions"><button type="submit">儲存資料</button></div>
    </form>
  `;
}

function summarizeAlerts(label, alerts) {
  const total = alerts.length;
  const activated = alerts.filter((alert) => alert.status === "activated").length;
  return { label, total, activated, rate: total ? Math.round((activated / total) * 100) : 0 };
}

function statsRowsByCategory(alerts) {
  return state.alertTypes.map((type) => summarizeAlerts(type.name, alerts.filter((alert) => alert.typeId === type.id)));
}

function statsRowsByHospital(alerts) {
  const visible = alerts.filter((alert) => {
    const hospital = state.hospitals.find((item) => item.id === alert.hospitalId);
    if (statsHospitalCity !== "all" && hospital?.city !== statsHospitalCity) return false;
    if (statsHospitalId !== "all" && alert.hospitalId !== statsHospitalId) return false;
    return true;
  });
  if (statsHospitalId !== "all") return [summarizeAlerts(hospitalName(statsHospitalId), visible)];
  if (statsHospitalCity !== "all") {
    const hospitals = activeHospitalsForCity(statsHospitalCity);
    return hospitals.map((hospital) => summarizeAlerts(hospital.name, visible.filter((alert) => alert.hospitalId === hospital.id)));
  }
  return TAIWAN_CITIES.map((city) => summarizeAlerts(city, visible.filter((alert) => state.hospitals.find((hospital) => hospital.id === alert.hospitalId)?.city === city)))
    .filter((row) => row.total > 0 || activeHospitalsForCity(row.label).length);
}

function statsRowsByFire(alerts) {
  const visible = alerts.filter((alert) => {
    const station = stationById(alert.sender?.stationId);
    const brigade = brigadeById(station?.brigadeId);
    if (statsFireCity !== "all" && station?.city !== statsFireCity) return false;
    if (statsBrigadeId !== "all" && brigade?.id !== statsBrigadeId) return false;
    if (statsStationId !== "all" && station?.id !== statsStationId) return false;
    return true;
  });
  if (statsStationId !== "all") return [summarizeAlerts(stationName(statsStationId), visible)];
  if (statsBrigadeId !== "all") {
    return activeStationsForBrigade(statsBrigadeId).map((station) => summarizeAlerts(station.name, visible.filter((alert) => alert.sender?.stationId === station.id)));
  }
  if (statsFireCity !== "all") {
    return activeBrigadesForCity(statsFireCity).map((brigade) => summarizeAlerts(brigade.name, visible.filter((alert) => stationById(alert.sender?.stationId)?.brigadeId === brigade.id)));
  }
  return TAIWAN_CITIES.map((city) => summarizeAlerts(city, visible.filter((alert) => stationById(alert.sender?.stationId)?.city === city)))
    .filter((row) => row.total > 0 || activeBrigadesForCity(row.label).length);
}

function statsRows(alerts) {
  if (statsView === "hospital") return statsRowsByHospital(alerts);
  if (statsView === "fire") return statsRowsByFire(alerts);
  return statsRowsByCategory(alerts);
}

function totalStats(rows) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const activated = rows.reduce((sum, row) => sum + row.activated, 0);
  return { total, activated, rate: total ? Math.round((activated / total) * 100) : 0 };
}

function renderStatsPanel(title, alerts) {
  const filteredAlerts = alertsInStatsRange(alerts);
  const rows = statsRows(filteredAlerts);
  const totals = totalStats(rows);
  const range = statsRangeBounds();
  const typeOptions = [["all", "全部重症"], ...state.alertTypes.map((type) => [type.id, type.name])];
  const typeLabel = typeOptions.find(([value]) => value === statsRange.typeId)?.[1] || "全部重症";
  const hospitalCityHospitals = statsHospitalCity === "all" ? [] : activeHospitalsForCity(statsHospitalCity);
  const fireCityBrigades = statsFireCity === "all" ? [] : activeBrigadesForCity(statsFireCity);
  const fireStations = statsBrigadeId === "all" ? [] : activeStationsForBrigade(statsBrigadeId);
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
      <div class="grid three compact-controls">
        <label>統計方式
          <select id="statsView">
            <option value="hospital" ${statsView === "hospital" ? "selected" : ""}>以醫院為單位</option>
            <option value="fire" ${statsView === "fire" ? "selected" : ""}>以消防為單位</option>
            <option value="category" ${statsView === "category" ? "selected" : ""}>以重症類別為單位</option>
          </select>
        </label>
        ${statsView === "hospital" ? `
          <label>醫院縣市<select id="statsHospitalCity">${cityOptionsWithAll(statsHospitalCity)}</select></label>
          <label>醫院<select id="statsHospitalId">${selectOptions(hospitalCityHospitals, statsHospitalId, (hospital) => hospital.name, "全部醫院")}</select></label>
        ` : ""}
        ${statsView === "fire" ? `
          <label>消防縣市<select id="statsFireCity">${cityOptionsWithAll(statsFireCity)}</select></label>
          <label>大隊<select id="statsBrigadeId">${selectOptions(fireCityBrigades, statsBrigadeId, (brigade) => brigade.name, "全部大隊")}</select></label>
          <label>分隊<select id="statsStationId">${selectOptions(fireStations, statsStationId, (station) => station.name, "全部分隊")}</select></label>
        ` : ""}
      </div>
      <div class="notice">成功率目前以「成功啟動案件 / 總通報案件」計算；目前納入 ${filteredAlerts.length} / ${alerts.length} 筆。</div>
      <div class="table">
        <div class="row header"><span>單位/類別</span><span>總通報</span><span>啟動</span><span>成功率</span><span></span></div>
        ${rows.map((row) => `
          <div class="row">
            <span>${row.label}</span>
            <span>${row.total}</span>
            <span>${row.activated}</span>
            <span>${row.rate}%</span>
            <span></span>
          </div>
        `).join("")}
        <div class="row">
          <strong>總平均</strong>
          <strong>${totals.total}</strong>
          <strong>${totals.activated}</strong>
          <strong>${totals.rate}%</strong>
          <span></span>
        </div>
      </div>
    </section>
  `;
}

function renderAlertComposer() {
  const type = alertType(selectedAlertTypeId) || state.alertTypes.find((item) => item.active);
  const cityHospitals = normalizeAlertHospitalSelection();
  const selectedHospitalId = cityHospitals[0]?.id || "";
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
        <label>後送縣市<select id="alertHospitalCity">${cityOptions(alertHospitalCity)}</select></label>
        <label>後送醫院<select name="hospitalId">${cityHospitals.map((hospital) => `<option value="${hospital.id}" ${hospital.id === selectedHospitalId ? "selected" : ""}>${hospital.name}</option>`).join("")}</select></label>
        <label>性別
          <select name="sex">${GENDER_OPTIONS.map((option) => `<option value="${option}">${option}</option>`).join("")}</select>
        </label>
        <label>年齡區間
          <select name="ageRange">${AGE_RANGE_OPTIONS.map((option) => `<option value="${option}">${option}</option>`).join("")}</select>
        </label>
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
    ohca: "tone-purple",
  }[typeId] || "tone-green";
}

function alertTypeHint(type) {
  if (type.id === "stemi") return "EKG 判讀與心導管啟動";
  if (type.id === "stroke") return "急性腦梗塞流程";
  if (type.id === "trauma") return "重大創傷與大量輸血";
  if (type.id === "ohca") return "內科 OHCA 與院前 ECMO 評估";
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
  if (typeId === "ohca") {
    return `
      <div class="notice">${escapeHtml(type.prompt)}</div>
      <label>是否符合啟動院前 ECMO<select name="decision"><option value="是">是</option><option value="否">否</option></select></label>
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
    `;
  }
  return `
    <div class="notice">${escapeHtml(type.prompt)}</div>
    <label>是否符合大量輸血條件<select name="decision"><option value="是">是</option><option value="否">否</option></select></label>
    <label>是否 OHCA<select name="traumaOhca"><option value="不詳">不詳</option><option value="是">是</option><option value="否">否</option></select></label>
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
      ${alertDecisionMeta(alert)}
      <div class="meta"><span>性別：${alert.sex || alert.extra?.sex || "不詳"}</span><span>年齡：${alert.ageRange || alert.extra?.ageRange || "不詳"}</span></div>
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
  const pendingAlerts = ringingAlertsForCurrentUser().slice().reverse();
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
        <div class="notice">沒有人接收前會持續提醒；第一位醫師接收後負責決定啟動/不啟動，其他醫師仍會短暫提醒，直到自己按接收或超過 10 秒後停止。</div>
      </section>
    </section>
  `;
}

function hospitalRelevantAlerts() {
  return state.alerts.filter((alert) => {
    if (alert.recipients.some((recipient) => recipient.userId === session.id)) return true;
    if (session.role !== "admin") return false;
    const type = alertType(alert.typeId);
    return alert.hospitalId === session.hospitalId && departmentMatchesRoute(session.departmentId, type?.routeDepartments || []);
  });
}

function renderHospitalAlert(alert) {
  const acceptedByMe = alert.acceptedBy === session.id;
  const acceptedByOther = alert.acceptedBy && alert.acceptedBy !== session.id;
  const recipient = currentAlertRecipient(alert);
  const recipientAccepted = Boolean(recipient?.acceptedAt);
  const shouldRing = shouldRingForCurrentUser(alert);
  const canAcknowledge = recipient && !recipientAccepted && ["notified", "accepted"].includes(alert.status);
  return `
    <article class="item ${shouldRing ? "critical" : ""}">
      <div class="item-head">
        <div>
          <strong>${alertType(alert.typeId)?.name || alert.typeId}</strong>
          <div class="meta"><span>${hospitalName(alert.hospitalId)}</span><span>${stationName(alert.sender.stationId)}</span><span>${alert.sender.phone}</span></div>
        </div>
        <span class="status ${statusClass(alert.status)}">${statusText(alert.status)}</span>
      </div>
      ${alertDecisionMeta(alert)}
      <div class="meta"><span>性別：${alert.sex || alert.extra?.sex || "不詳"}</span><span>年齡：${alert.ageRange || alert.extra?.ageRange || "不詳"}</span></div>
      <div class="small">${escapeHtml(alert.extraText || alert.extra?.text || alert.extra || "")}</div>
      <div class="actions">
        <button class="secondary view-alert" data-id="${alert.id}">檢視</button>
        ${canAcknowledge ? `<button class="accept-alert" data-id="${alert.id}">${alert.status === "accepted" ? "接收並停止提醒" : "接收"}</button>` : ""}
        ${acceptedByMe && alert.status === "accepted" ? `<button class="reply-alert danger" data-id="${alert.id}" data-response="啟動">啟動</button><button class="reply-alert" data-id="${alert.id}" data-response="不啟動">不啟動</button><button class="callback-alert secondary" data-id="${alert.id}">回撥電話</button>` : ""}
        ${acceptedByOther ? `<span class="status opened">已由 ${clinicianLabel(userById(alert.acceptedBy))} 接收</span>` : ""}
        ${recipientAccepted && !acceptedByMe ? `<span class="status done">你已停止提醒</span>` : ""}
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
        ${renderRecentAdminRecordsPanel(2)}
      `,
    },
    accounts: {
      title: "帳號管理",
      content: `
        ${renderPendingUsersPanel()}
        ${renderAccountManagementPanel()}
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

function accountFilteredUsers() {
  const approvedUsers = state.users.filter((user) => user.approved && user.role === accountRoleFilter);
  if (accountRoleFilter === "prehospital") {
    return approvedUsers.filter((user) => {
      const station = stationById(user.stationId);
      if (accountCityFilter !== "all" && station?.city !== accountCityFilter) return false;
      if (accountBrigadeFilter !== "all" && station?.brigadeId !== accountBrigadeFilter) return false;
      if (accountStationFilter !== "all" && station?.id !== accountStationFilter) return false;
      return true;
    });
  }
  if (accountRoleFilter === "hospital") {
    return approvedUsers.filter((user) => {
      const hospital = state.hospitals.find((item) => item.id === user.hospitalId);
      if (accountCityFilter !== "all" && hospital?.city !== accountCityFilter) return false;
      if (accountHospitalFilter !== "all" && user.hospitalId !== accountHospitalFilter) return false;
      if (accountDepartmentFilter !== "all" && user.departmentId !== accountDepartmentFilter) return false;
      return true;
    });
  }
  return approvedUsers.filter((user) => {
    const station = stationById(user.stationId);
    const hospital = state.hospitals.find((item) => item.id === user.hospitalId);
    if (accountCityFilter === "all") return true;
    return station?.city === accountCityFilter || hospital?.city === accountCityFilter;
  });
}

function renderAccountManagementPanel() {
  const cityBrigades = accountCityFilter === "all" ? [] : activeBrigadesForCity(accountCityFilter);
  const brigadeStations = accountBrigadeFilter === "all" ? [] : activeStationsForBrigade(accountBrigadeFilter);
  const cityHospitals = accountCityFilter === "all" ? [] : activeHospitalsForCity(accountCityFilter);
  const users = accountFilteredUsers();
  return `
    <section class="panel wide-panel">
      <h2>已核准帳號</h2>
      <div class="grid three compact-controls">
        <label>帳號類型
          <select id="accountRoleFilter">
            <option value="prehospital" ${accountRoleFilter === "prehospital" ? "selected" : ""}>院前端</option>
            <option value="hospital" ${accountRoleFilter === "hospital" ? "selected" : ""}>院後端</option>
            <option value="admin" ${accountRoleFilter === "admin" ? "selected" : ""}>管理者</option>
          </select>
        </label>
        <label>縣市<select id="accountCityFilter">${cityOptionsWithAll(accountCityFilter)}</select></label>
        ${accountRoleFilter === "prehospital" ? `
          <label>大隊<select id="accountBrigadeFilter">${selectOptions(cityBrigades, accountBrigadeFilter, (brigade) => brigade.name, "全部大隊")}</select></label>
          <label>分隊<select id="accountStationFilter">${selectOptions(brigadeStations, accountStationFilter, (station) => station.name, "全部分隊")}</select></label>
        ` : ""}
        ${accountRoleFilter === "hospital" ? `
          <label>醫院<select id="accountHospitalFilter">${selectOptions(cityHospitals, accountHospitalFilter, (hospital) => hospital.name, "全部醫院")}</select></label>
          <label>科別<select id="accountDepartmentFilter">${selectOptions(activeDepartments(), accountDepartmentFilter, (department) => department.name, "全部科別")}</select></label>
        ` : ""}
      </div>
      <div class="list">${users.length ? users.map(renderUserAdmin).join("") : `<div class="muted">沒有符合篩選條件的帳號</div>`}</div>
    </section>
  `;
}

function renderUnitSettingsPanel() {
  normalizeUnitSelections();
  const cityHospitals = activeHospitalsForCity(unitHospitalCity);
  const selectedHospital = cityHospitals.find((hospital) => hospital.id === unitHospitalId);
  const cityBrigades = activeBrigadesForCity(unitStationCity);
  const selectedBrigade = cityBrigades.find((brigade) => brigade.id === unitBrigadeId);
  const brigadeStations = selectedBrigade ? activeStationsForBrigade(selectedBrigade.id) : [];
  return `
    <section class="panel">
      <h2>醫院設定</h2>
      <div class="grid two compact-controls">
        <label>縣市<select id="unitHospitalCity">${cityOptions(unitHospitalCity)}</select></label>
        <label>醫院
          <select id="unitHospitalSelect">
            ${cityHospitals.map((hospital) => `<option value="${hospital.id}" ${hospital.id === unitHospitalId ? "selected" : ""}>${hospital.name}</option>`).join("")}
          </select>
        </label>
      </div>
      <form id="hospitalForm" class="grid two unit-form">
        <input type="hidden" name="city" value="${unitHospitalCity}" />
        <label>醫院<input name="name" required placeholder="例如：土城醫院" /></label>
        <button type="submit">新增醫院</button>
      </form>
      <div class="list">${selectedHospital ? renderHospitalUnitCard(selectedHospital) : `<div class="muted">此縣市尚未建立醫院</div>`}</div>
    </section>
    <section class="panel">
      <h2>全系統科別</h2>
      <form id="departmentForm" class="grid two unit-form">
        <label>科別<input name="name" required placeholder="例如：感染科" /></label>
        <button type="submit">新增科別</button>
      </form>
      <div class="unit-list">
        ${activeDepartments().map((department) => `
          <div class="unit-row">
            <span>${department.name}</span>
            <button type="button" class="secondary remove-department" data-id="${department.id}">移除</button>
          </div>
        `).join("") || `<div class="unit-row"><span class="muted">尚未建立科別</span></div>`}
      </div>
    </section>
    <section class="panel">
      <h2>消防大隊與分隊</h2>
      <div class="grid two compact-controls">
        <label>縣市<select id="unitStationCity">${cityOptions(unitStationCity)}</select></label>
        <label>大隊
          <select id="unitBrigadeSelect">
            ${cityBrigades.map((brigade) => `<option value="${brigade.id}" ${brigade.id === unitBrigadeId ? "selected" : ""}>${brigade.name}</option>`).join("")}
          </select>
        </label>
      </div>
      <form id="brigadeForm" class="grid two unit-form">
        <input type="hidden" name="city" value="${unitStationCity}" />
        <label>大隊<input name="name" required placeholder="例如：第五救災救護大隊" /></label>
        <button type="submit">新增大隊</button>
      </form>
      <form id="stationForm" class="grid two unit-form">
        <input type="hidden" name="city" value="${unitStationCity}" />
        <input type="hidden" name="brigadeId" value="${unitBrigadeId}" />
        <label>分隊<input name="name" required placeholder="例如：土城分隊" /></label>
        <button type="submit">新增分隊</button>
      </form>
      <div class="list">${selectedBrigade ? renderBrigadeUnitCard(selectedBrigade, brigadeStations) : `<div class="muted">此縣市尚未建立大隊</div>`}</div>
    </section>
  `;
}

function renderHospitalUnitCard(hospital) {
  return `
    <div class="item">
      <div class="toolbar">
        <strong>${hospitalLabel(hospital)}</strong>
        <button type="button" class="secondary remove-hospital" data-id="${hospital.id}">移除醫院</button>
      </div>
      <div class="small muted">科別由「全系統科別」統一管理；排班與帳號會以此醫院加上科別組合。</div>
    </div>
  `;
}

function renderBrigadeUnitCard(brigade, stations = activeStationsForBrigade(brigade.id)) {
  return `
    <div class="item">
      <div class="toolbar">
        <strong>${brigade.city} ${brigade.name}</strong>
        <button type="button" class="secondary remove-brigade" data-id="${brigade.id}">移除大隊</button>
      </div>
      <div class="unit-list">${stations.map(renderStationUnitCard).join("") || `<div class="unit-row"><span class="muted">此大隊尚未建立分隊</span></div>`}</div>
    </div>
  `;
}

function renderStationUnitCard(station) {
  return `
    <div class="unit-row">
      <span>${stationLabel(station)}</span>
      <button type="button" class="secondary remove-station" data-id="${station.id}">移除</button>
    </div>
  `;
}

function renderAlertSettingsPanel() {
  return `
    <section class="panel wide-panel">
      <h2>通報類別</h2>
      <div class="notice">目前測試版固定使用 STEMI、內科 OHCA、重大創傷、急性腦梗塞。未來若要新增疾病，將由程式端加入；此處只調整各通報要通知的科別與提示文字。</div>
      <div class="list">${state.alertTypes.filter((type) => type.active).map(renderAlertTypeAdmin).join("")}</div>
    </section>
  `;
}

function renderDutyPanel() {
  const dutyHospitals = normalizeDutyHospitalSelection();
  const dutyDoctors = hospitalDoctors().filter((doctor) => doctor.hospitalId === dutyHospitalFilter);
  const hospitalOptions = dutyHospitals.map((hospital) => `<option value="${hospital.id}" ${dutyHospitalFilter === hospital.id ? "selected" : ""}>${hospital.name}</option>`).join("");
  return `
    <section class="panel wide-panel">
      <h2>當班人員與班表匯入</h2>
      ${hospitalDoctors().length ? "" : `<div class="notice">目前沒有已核准的院後端醫師。請先讓醫師註冊院後端帳號，或在帳號管理中核准後再排班。</div>`}
      ${dutyHospitalFilter && !dutyDoctors.length ? `<div class="notice">所選醫院目前沒有已核准的院後端醫師。</div>` : ""}
      <form id="manualDutyForm" class="grid three">
        <label>院後端醫師
          <select name="userId" required>
            <option value="">請選擇已註冊醫師</option>
            ${dutyDoctors.map((doctor) => `<option value="${doctor.id}">${doctor.name} / ${departmentName(doctor.departmentId)}</option>`).join("")}
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
        <label>醫院縣市<select id="dutyHospitalCity">${hospitalCityOptions(dutyHospitalCity)}</select></label>
        <label>醫院<select id="dutyHospitalFilter">${hospitalOptions}</select></label>
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
  const hospitals = activeHospitals().filter((hospital) => hospital.id === dutyHospitalFilter);
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
  const alerts = state.alerts.slice().reverse();
  const recentAlerts = alerts.slice(0, limit);
  const historyAlerts = alerts.slice(limit);
  return `
    <section class="panel">
      <div class="toolbar">
        <h2>近期通報</h2>
        <button type="button" class="secondary" id="toggleAdminRecords">${adminRecordsExpanded ? "收合" : "展開"} ${historyAlerts.length} 筆</button>
      </div>
      <div class="list">${recentAlerts.length ? recentAlerts.map(renderAdminAlertRecord).join("") : `<div class="muted">尚無通報</div>`}</div>
      ${adminRecordsExpanded ? `<div class="list">${historyAlerts.length ? historyAlerts.map(renderAdminAlertRecord).join("") : `<div class="muted">尚無其他通報</div>`}</div>` : `<div class="muted">已收合 ${historyAlerts.length} 筆較早通報</div>`}
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
      ${alertDecisionMeta(alert)}
      <div class="meta">
        <span>接收醫師：${acceptedUser?.name || "尚未"}</span>
        <span>接收時間：${alert.acceptedAt || "尚未"}</span>
      </div>
      <div class="meta">
        <span>性別：${alert.sex || alert.extra?.sex || "不詳"}</span>
        <span>年齡：${alert.ageRange || alert.extra?.ageRange || "不詳"}</span>
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

function renderDepartmentToggleButtons(typeId, routeDepartments = [], routeKind = "default") {
  return activeDepartments().map((department) => {
    const selected = routeDepartments.includes(department.id);
    return `<button type="button" class="department-toggle ${selected ? "selected" : ""}" data-department-id="${department.id}" aria-pressed="${selected ? "true" : "false"}">${department.name}</button>`;
  }).join("");
}

function renderAlertTypeAdmin(type) {
  const routeSettings = type.id === "ohca" ? `
      <div class="field-label">不啟動 ECMO 通知科別</div>
      <div class="department-toggle-grid" data-alert-type-id="${type.id}" data-route-kind="default">
        ${renderDepartmentToggleButtons(type.id, type.routeDepartments || ["dep-er"])}
      </div>
      <div class="small muted">不符合啟動 ECMO 時，只通知急診醫學科值班人員。</div>
      <div class="field-label">啟動 ECMO 通知科別</div>
      <div class="department-toggle-grid" data-alert-type-id="${type.id}" data-route-kind="ecmo">
        ${renderDepartmentToggleButtons(type.id, type.ecmoRouteDepartments || ["dep-er", "dep-cvs"], "ecmo")}
      </div>
      <div class="small muted">符合啟動 ECMO 時，通知急診醫學科與心臟外科值班人員。</div>
    ` : `
      <div class="field-label">通知科別</div>
      <div class="department-toggle-grid" data-alert-type-id="${type.id}" data-route-kind="default">
        ${renderDepartmentToggleButtons(type.id, type.routeDepartments || [])}
      </div>
      <div class="small muted">院前端選擇醫院後，只會通知該醫院中符合以上科別且當班的人員。</div>
    `;
  return `
    <article class="item">
      <strong>${type.name}</strong>
      ${routeSettings}
      <label>提示文字<textarea class="prompt-input" data-id="${type.id}">${escapeHtml(type.prompt)}</textarea></label>
      <div class="actions"><button class="secondary save-alert-type" data-id="${type.id}">儲存設定</button></div>
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
        <div class="notice">${escapeHtml(alert.extraText || alert.extra?.text || alert.extra || "")}</div>
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
    registerNativePushToken();
    if (nativePushToken) sendPushTokenToServer(nativePushToken);
    view = "dashboard";
    render();
  };
  document.querySelector("#loginForm")?.addEventListener("submit", handleLogin);
  document.querySelector("#loginSubmit")?.addEventListener("click", handleLogin);
  document.querySelectorAll("[data-register-role]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-register-role]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    registerRole = button.dataset.registerRole;
    document.querySelector("[name='role']").value = registerRole;
    document.querySelectorAll(".pre-register").forEach((item) => (item.hidden = registerRole !== "prehospital"));
    document.querySelectorAll(".hospital-register").forEach((item) => (item.hidden = registerRole !== "hospital"));
  }));
  document.querySelector("#registerStationCity")?.addEventListener("change", (event) => {
    registerStationCity = event.currentTarget.value || registerStationCity;
    const { brigades, stations } = normalizeRegisterStationSelection();
    const brigadeSelect = document.querySelector("#registerBrigadeId");
    const stationSelect = document.querySelector("#registerStationId");
    if (brigadeSelect) {
      brigadeSelect.innerHTML = brigades.map((brigade) => `<option value="${brigade.id}" ${brigade.id === registerBrigadeId ? "selected" : ""}>${brigade.name}</option>`).join("");
    }
    if (stationSelect) {
      stationSelect.innerHTML = stations.map((station) => `<option value="${station.id}" ${station.id === registerStationId ? "selected" : ""}>${station.name}</option>`).join("");
    }
  });
  document.querySelector("#registerBrigadeId")?.addEventListener("change", (event) => {
    registerBrigadeId = event.currentTarget.value || "";
    const { stations } = normalizeRegisterStationSelection();
    const stationSelect = document.querySelector("#registerStationId");
    if (stationSelect) {
      stationSelect.innerHTML = stations.map((station) => `<option value="${station.id}" ${station.id === registerStationId ? "selected" : ""}>${station.name}</option>`).join("");
    }
  });
  document.querySelector("#registerStationId")?.addEventListener("change", (event) => {
    registerStationId = event.currentTarget.value || "";
  });
  document.querySelector("#registerHospitalCity")?.addEventListener("change", (event) => {
    registerHospitalCity = event.currentTarget.value || registerHospitalCity;
    const hospitals = normalizeRegisterHospitalSelection();
    const hospitalSelect = document.querySelector("#registerHospitalId");
    if (hospitalSelect) {
      hospitalSelect.innerHTML = hospitals.map((hospital) => `<option value="${hospital.id}" ${hospital.id === registerHospitalId ? "selected" : ""}>${hospital.name}</option>`).join("");
    }
  });
  document.querySelector("#registerHospitalId")?.addEventListener("change", (event) => {
    registerHospitalId = event.currentTarget.value || "";
  });
  document.querySelector("#registerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (data.role === "prehospital" && !data.stationId) {
      alert("請先選擇所屬分隊；若單位不在選單中，請洽管理者新增。");
      return;
    }
    if (data.role === "hospital" && !data.hospitalId) {
      alert("請先選擇所屬醫院；若醫院不在選單中，請洽管理者新增。");
      return;
    }
    if (data.role === "hospital" && !departmentBelongsToHospital(data.departmentId, data.hospitalId)) {
      alert("院後端科別必須屬於所選醫院，請重新選擇。");
      return;
    }
    data.password = data.password || data.phone;
    state.users.push({ id: uid("u"), ...data, approved: false });
    saveState();
    alert("已送出註冊申請，需管理者核准。");
    view = "home";
    render();
  });
}

function bindCommon() {
  document.querySelector("#logout")?.addEventListener("click", async () => {
    stopAlarm();
    const previousSession = session ? structuredClone(session) : null;
    await unregisterNativePushToken(previousSession);
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
      if (!departmentBelongsToHospital(data.departmentId, data.hospitalId)) {
        alert("院後端科別必須屬於所選醫院，請重新選擇。");
        return;
      }
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
  document.querySelectorAll("#statsView").forEach((select) => select.addEventListener("change", (event) => {
    statsView = event.currentTarget.value || "hospital";
    render();
  }));
  document.querySelectorAll("#statsHospitalCity").forEach((select) => select.addEventListener("change", (event) => {
    statsHospitalCity = event.currentTarget.value || "all";
    statsHospitalId = "all";
    render();
  }));
  document.querySelectorAll("#statsHospitalId").forEach((select) => select.addEventListener("change", (event) => {
    statsHospitalId = event.currentTarget.value || "all";
    render();
  }));
  document.querySelectorAll("#statsFireCity").forEach((select) => select.addEventListener("change", (event) => {
    statsFireCity = event.currentTarget.value || "all";
    statsBrigadeId = "all";
    statsStationId = "all";
    render();
  }));
  document.querySelectorAll("#statsBrigadeId").forEach((select) => select.addEventListener("change", (event) => {
    statsBrigadeId = event.currentTarget.value || "all";
    statsStationId = "all";
    render();
  }));
  document.querySelectorAll("#statsStationId").forEach((select) => select.addEventListener("change", (event) => {
    statsStationId = event.currentTarget.value || "all";
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
    alertHospitalCity = defaultAlertHospitalCity();
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
  document.querySelector("#alertHospitalCity")?.addEventListener("change", (event) => {
    alertHospitalCity = event.currentTarget.value || defaultAlertHospitalCity();
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
      if (!data.hospitalId) {
        setMessage("目前此縣市沒有可選擇的後送醫院，請改選縣市或先到管理頁面新增醫院。");
        return;
      }
      if (data.typeId === "stemi" && !uploadImage) {
        setMessage("STEMI 通報需先上傳 EKG 影像，或按「使用範例影像」後再送出。");
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
  const sex = data.sex || "不詳";
  const ageRange = data.ageRange || "不詳";
  const lines = [`性別：${sex}`, `年齡區間：${ageRange}`];
  if (data.typeId === "stemi") lines.push("院前端已上傳 EKG 影像，請判讀並決定是否啟動。");
  else if (data.typeId === "stroke") lines.push(type.prompt, `最後正常時間：${data.strokeWindow}`);
  else if (data.typeId === "ohca") lines.push(type.prompt, `是否符合啟動院前 ECMO：${data.decision || "不詳"}`);
  else if (data.typeId === "trauma") lines.push(type.prompt, `是否符合大量輸血條件：${data.decision || "不詳"}`, `是否 OHCA：${data.traumaOhca || "不詳"}`);
  else lines.push(type.prompt || "", `院前端選擇：${data.decision || "不詳"}`);
  return { sex, ageRange, decision: data.decision || "", text: lines.filter(Boolean).join("\n") };
}

function bindHospitalUser() {
  document.querySelectorAll(".accept-alert").forEach((button) => button.addEventListener("click", () => {
    const item = state.alerts.find((alert) => alert.id === button.dataset.id);
    if (!item || !["notified", "accepted"].includes(item.status)) return;
    const recipient = item.recipients.find((r) => r.userId === session.id);
    if (!recipient || recipient.acceptedAt) return;
    const acceptedAt = nowText();
    recipient.acceptedAt = acceptedAt;
    recipient.acceptedMs = Date.now();
    if (item.status === "notified") {
      item.status = "accepted";
      item.acceptedBy = session.id;
      item.acceptedAt = acceptedAt;
      item.acceptedMs = recipient.acceptedMs;
      item.audit.push(`${acceptedAt} ${clinicianLabel(session)} 接收通報，負責決定啟動/不啟動`);
    } else {
      item.audit.push(`${acceptedAt} ${clinicianLabel(session)} 接收通知並停止自己的提醒`);
    }
    saveState();
    render();
  }));
  document.querySelectorAll(".reply-alert").forEach((button) => button.addEventListener("click", () => {
    const item = state.alerts.find((alert) => alert.id === button.dataset.id);
    if (!item || item.acceptedBy !== session.id) return;
    item.response = button.dataset.response;
    item.respondedBy = session.id;
    item.respondedAt = nowText();
    item.status = button.dataset.response === "啟動" ? "activated" : "declined";
    item.audit.push(`${nowText()} ${clinicianLabel(session)} 決定：${button.dataset.response}`);
    saveState();
    render();
  }));
  document.querySelectorAll(".callback-alert").forEach((button) => button.addEventListener("click", () => {
    const item = state.alerts.find((alert) => alert.id === button.dataset.id);
    if (!item || item.acceptedBy !== session.id) return;
    item.response = "回撥電話";
    item.respondedBy = session.id;
    item.respondedAt = nowText();
    item.status = "callback";
    item.audit.push(`${nowText()} ${clinicianLabel(session)} 選擇回撥 ${item.sender.phone}`);
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
  document.querySelector("#unitHospitalCity")?.addEventListener("change", (event) => {
    unitHospitalCity = event.currentTarget.value || "新北市";
    unitHospitalId = activeHospitalsForCity(unitHospitalCity)[0]?.id || "";
    render();
  });
  document.querySelector("#unitHospitalSelect")?.addEventListener("change", (event) => {
    unitHospitalId = event.currentTarget.value || "";
    render();
  });
  document.querySelector("#unitStationCity")?.addEventListener("change", (event) => {
    unitStationCity = event.currentTarget.value || "新北市";
    unitBrigadeId = activeBrigadesForCity(unitStationCity)[0]?.id || "";
    render();
  });
  document.querySelector("#unitBrigadeSelect")?.addEventListener("change", (event) => {
    unitBrigadeId = event.currentTarget.value || "";
    render();
  });
  document.querySelector("#accountRoleFilter")?.addEventListener("change", (event) => {
    accountRoleFilter = event.currentTarget.value || "prehospital";
    accountCityFilter = "all";
    accountBrigadeFilter = "all";
    accountStationFilter = "all";
    accountHospitalFilter = "all";
    accountDepartmentFilter = "all";
    render();
  });
  document.querySelector("#accountCityFilter")?.addEventListener("change", (event) => {
    accountCityFilter = event.currentTarget.value || "all";
    accountBrigadeFilter = "all";
    accountStationFilter = "all";
    accountHospitalFilter = "all";
    render();
  });
  document.querySelector("#accountBrigadeFilter")?.addEventListener("change", (event) => {
    accountBrigadeFilter = event.currentTarget.value || "all";
    accountStationFilter = "all";
    render();
  });
  document.querySelector("#accountStationFilter")?.addEventListener("change", (event) => {
    accountStationFilter = event.currentTarget.value || "all";
    render();
  });
  document.querySelector("#accountHospitalFilter")?.addEventListener("change", (event) => {
    accountHospitalFilter = event.currentTarget.value || "all";
    render();
  });
  document.querySelector("#accountDepartmentFilter")?.addEventListener("change", (event) => {
    accountDepartmentFilter = event.currentTarget.value || "all";
    render();
  });
  document.querySelector("#hospitalForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (state.hospitals.some((hospital) => hospital.city === data.city && hospital.name === data.name && hospital.active)) return alert("已有相同縣市與名稱的醫院。");
    const hospital = { id: uid("h"), active: true, ...data };
    state.hospitals.push(hospital);
    unitHospitalCity = hospital.city;
    unitHospitalId = hospital.id;
    saveState();
    render();
  });
  document.querySelector("#brigadeForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (activeBrigades().some((brigade) => brigade.city === data.city && brigade.name === data.name)) return alert("已有相同縣市與名稱的大隊。");
    const brigade = { id: uid("b"), active: true, ...data };
    state.brigades = state.brigades || [];
    state.brigades.push(brigade);
    unitStationCity = brigade.city;
    unitBrigadeId = brigade.id;
    saveState();
    render();
  });
  document.querySelector("#stationForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!data.brigadeId) return alert("請先選擇或新增大隊。");
    if (state.stations.some((station) => station.city === data.city && station.brigadeId === data.brigadeId && station.name === data.name && station.active)) return alert("已有相同縣市、大隊與名稱的分隊。");
    state.stations.push({ id: uid("s"), active: true, ...data });
    saveState();
    render();
  });
  document.querySelector("#departmentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const name = String(data.name || "").trim();
    if (!name) return;
    if (state.departments.some((department) => department.name === name && department.active)) return alert("已有相同名稱的科別。");
    state.departments.push({ id: uid("dep"), name, active: true });
    saveState();
    render();
  });
  document.querySelectorAll(".remove-hospital").forEach((button) => button.addEventListener("click", () => {
    const hospital = state.hospitals.find((item) => item.id === button.dataset.id);
    if (!hospital) return;
    if (!confirm(`確定要移除 ${hospital.name}？此醫院的排班也會停用，但歷史通報仍會保留。`)) return;
    hospital.active = false;
    state.onDuty = state.onDuty.filter((duty) => duty.hospitalId !== hospital.id);
    if (dutyHospitalFilter === hospital.id) dutyHospitalFilter = activeHospitalsForCity(dutyHospitalCity).find((item) => item.id !== hospital.id)?.id || "";
    if (unitHospitalId === hospital.id) unitHospitalId = activeHospitalsForCity(unitHospitalCity).find((item) => item.id !== hospital.id)?.id || "";
    saveState();
    render();
  }));
  document.querySelectorAll(".remove-brigade").forEach((button) => button.addEventListener("click", () => {
    const brigade = brigadeById(button.dataset.id);
    if (!brigade) return;
    if (!confirm(`確定要移除 ${brigade.city} ${brigade.name}？此大隊底下分隊也會停用。`)) return;
    brigade.active = false;
    state.stations.filter((station) => station.brigadeId === brigade.id).forEach((station) => (station.active = false));
    if (unitBrigadeId === brigade.id) unitBrigadeId = activeBrigadesForCity(unitStationCity).find((item) => item.id !== brigade.id)?.id || "";
    saveState();
    render();
  }));
  document.querySelectorAll(".remove-department").forEach((button) => button.addEventListener("click", () => {
    const department = state.departments.find((item) => item.id === button.dataset.id);
    if (!department) return;
    if (!confirm(`確定要移除 ${department.name}？使用此科別的排班也會停用，歷史通報仍會保留。`)) return;
    department.active = false;
    state.onDuty = state.onDuty.filter((duty) => duty.departmentId !== department.id);
    saveState();
    render();
  }));
  document.querySelectorAll(".remove-station").forEach((button) => button.addEventListener("click", () => {
    const station = state.stations.find((item) => item.id === button.dataset.id);
    if (!station) return;
    if (!confirm(`確定要移除 ${stationLabel(station)}？歷史通報仍會保留。`)) return;
    station.active = false;
    saveState();
    render();
  }));
  document.querySelectorAll(".department-toggle").forEach((button) => button.addEventListener("click", () => {
    const selected = !button.classList.contains("selected");
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }));
  document.querySelectorAll(".save-alert-type").forEach((button) => button.addEventListener("click", () => {
    const type = alertType(button.dataset.id);
    const defaultRouteButtons = document.querySelectorAll(`.department-toggle-grid[data-alert-type-id="${button.dataset.id}"][data-route-kind="default"] .department-toggle.selected`);
    const routeDepartments = Array.from(defaultRouteButtons).map((item) => item.dataset.departmentId);
    if (!routeDepartments.length) return alert("請至少選擇一個通知科別。");
    type.routeDepartments = routeDepartments;
    if (type.id === "ohca") {
      const ecmoRouteButtons = document.querySelectorAll(`.department-toggle-grid[data-alert-type-id="${button.dataset.id}"][data-route-kind="ecmo"] .department-toggle.selected`);
      const ecmoRouteDepartments = Array.from(ecmoRouteButtons).map((item) => item.dataset.departmentId);
      if (!ecmoRouteDepartments.length) return alert("請至少選擇一個啟動 ECMO 通知科別。");
      type.ecmoRouteDepartments = ecmoRouteDepartments;
    }
    type.prompt = document.querySelector(`.prompt-input[data-id="${button.dataset.id}"]`).value;
    saveState();
    render();
  }));
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
  document.querySelector("#dutyHospitalCity")?.addEventListener("change", (event) => {
    dutyHospitalCity = event.currentTarget.value || dutyHospitalCity;
    const hospitals = normalizeDutyHospitalSelection();
    dutyHospitalFilter = hospitals[0]?.id || "";
    render();
  });
  document.querySelector("#dutyHospitalFilter")?.addEventListener("change", (event) => {
    dutyHospitalFilter = event.currentTarget.value || "";
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
      if (!hospital) return;
      const department = state.departments.find((item) => item.name === row.department && item.active);
      if (!department) return;
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
土城醫院,急診醫學科,夜班醫師,請填手機,${today()},20:00,${addDays(today(), 1)},08:00`;
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
  await registerNativePushToken();
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

function nativePlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

async function sendPushTokenToServer(token) {
  if (!session?.id || !token) return;
  nativePushToken = token;
  try {
    await fetch(API_PUSH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        userId: session.id,
        token,
        platform: nativePlatform(),
      }),
    });
  } catch {}
}

async function unregisterNativePushToken(user = session) {
  if (!isNativeApp() || !user?.id) return;
  try {
    const { PushNotifications } = nativePlugins();
    await PushNotifications?.removeAllListeners?.();
  } catch {}
  pushRegistrationStarted = false;
  if (!nativePushToken) return;
  try {
    await fetch(API_PUSH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unregister",
        userId: user.id,
        token: nativePushToken,
        platform: nativePlatform(),
      }),
    });
  } catch {}
}

async function registerNativePushToken() {
  if (!isNativeApp() || pushRegistrationStarted) return;
  const { PushNotifications } = nativePlugins();
  if (!PushNotifications) return;
  pushRegistrationStarted = true;
  try {
    await PushNotifications.requestPermissions();
  } catch {}
  try {
    await PushNotifications.addListener("registration", (token) => {
      nativePushToken = token?.value || token || "";
      sendPushTokenToServer(nativePushToken);
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("push registration failed", error);
    });
    await PushNotifications.addListener("pushNotificationReceived", async () => {
      await loadStateFromServer();
      if (shouldAutoUnlockAlerts()) {
        const pending = ringingAlertsForCurrentUser();
        if (pending.length) triggerAlertReminders(pending);
      }
      render();
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", async () => {
      await loadStateFromServer();
      view = session?.role === "admin" ? "adminHospital" : "dashboard";
      render();
    });
    await PushNotifications.register();
  } catch {
    pushRegistrationStarted = false;
  }
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
      id: ALERT_CHANNEL_ID,
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
          channelId: ALERT_CHANNEL_ID,
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
  if (!shouldAutoUnlockAlerts()) return;
  startAlarm();
  scheduleAlarmAutoStop(alerts);
  alerts.forEach((alert) => {
    if (notifiedAlertIds.has(alert.id)) return;
    notifiedAlertIds.add(alert.id);
    showDeviceNotification(alert);
  });
}

function scheduleAlarmAutoStop(alerts) {
  if (audio.autoStopTimer) window.clearTimeout(audio.autoStopTimer);
  audio.autoStopTimer = null;
  const remainingTimes = alerts
    .filter((alert) => alert.status === "accepted" && alert.acceptedBy !== session?.id)
    .map((alert) => ACCEPTED_RING_GRACE_MS - acceptedElapsedMs(alert))
    .filter((ms) => ms > 0);
  if (!remainingTimes.length) return;
  audio.autoStopTimer = window.setTimeout(() => {
    stopAlarmIfNotNeeded();
    render();
  }, Math.min(...remainingTimes) + 50);
}

async function playAlertTone() {
  await playSirenTone(1600);
}

async function playSirenTone(durationMs = 1800) {
  const unlocked = await ensureAudioContext();
  if (!unlocked) return;
  const carrier = audio.context.createOscillator();
  const harmonic = audio.context.createOscillator();
  const gain = audio.context.createGain();
  const limiter = audio.context.createDynamicsCompressor();
  const now = audio.context.currentTime;
  const duration = durationMs / 1000;
  carrier.type = "square";
  harmonic.type = "sawtooth";
  limiter.threshold.setValueAtTime(-10, now);
  limiter.knee.setValueAtTime(4, now);
  limiter.ratio.setValueAtTime(12, now);
  limiter.attack.setValueAtTime(0.003, now);
  limiter.release.setValueAtTime(0.16, now);
  gain.gain.setValueAtTime(0.0001, now);
  for (let i = 0; i < 12; i += 1) {
    const t = now + i * 0.15;
    const on = i % 3 !== 2;
    const freq = i % 2 === 0 ? 720 : 1180;
    carrier.frequency.setValueAtTime(freq, t);
    harmonic.frequency.setValueAtTime(freq * 1.5, t);
    gain.gain.cancelAndHoldAtTime?.(t);
    gain.gain.setTargetAtTime(on ? 0.32 : 0.0001, t, 0.018);
  }
  gain.gain.setTargetAtTime(0.0001, now + duration - 0.08, 0.025);
  carrier.connect(gain);
  harmonic.connect(gain);
  gain.connect(limiter);
  limiter.connect(audio.context.destination);
  carrier.start(now);
  harmonic.start(now);
  carrier.stop(now + duration);
  harmonic.stop(now + duration);
}

function startAlarm() {
  if (audio.timer) return;
  const play = async () => {
    try {
      if (navigator.vibrate) navigator.vibrate(ALERT_VIBRATION_PATTERN);
      try {
        await nativePlugins().Haptics?.vibrate?.({ duration: 1800 });
      } catch {}
      const unlocked = await ensureAudioContext();
      if (!unlocked) return;
      await playSirenTone(1800);
    } catch {
      stopAlarm();
    }
  };
  play();
  audio.timer = window.setInterval(play, 2100);
}

function stopAlarmIfNotNeeded() {
  if (!(session?.role === "hospital" || (session?.role === "admin" && view === "adminHospital"))) {
    stopAlarm();
    return;
  }
  const hasPending = ringingAlertsForCurrentUser().length > 0;
  if (!hasPending) stopAlarm();
}

function stopAlarm() {
  if (audio.timer) window.clearInterval(audio.timer);
  if (audio.autoStopTimer) window.clearTimeout(audio.autoStopTimer);
  audio.timer = null;
  audio.autoStopTimer = null;
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
  registerNativePushToken();
  render();
  window.setInterval(pollServerState, 3000);
  window.setInterval(() => {
    const clock = document.querySelector("#homeClock");
    if (clock) clock.textContent = nowText();
  }, 1000);
}

initApp();
