from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import time

ROOT = Path(__file__).resolve().parent
DATA_FILE = Path(os.environ.get("APP_STATE_FILE", ROOT / "data" / "app_state.json"))
DATABASE_URL = os.environ.get("DATABASE_URL")
FIREBASE_SERVICE_ACCOUNT_JSON = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
FIREBASE_CREDENTIALS_FILE = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
DEMO_USER_IDS = {"u-admin", "u-pre-1", "u-doc-er", "u-doc-cardio", "u-doc-trauma", "u-doc-neuro", "u-doc-cvs"}
DEMO_PHONES = {"0900000000", "0911000001", "0912000001", "0912000002", "0912000003", "0912000004", "0912000005"}
RETIRED_HOSPITAL_IDS = {"h-fy"}
RETIRED_HOSPITAL_NAMES = {"亞東醫院"}
MAX_ALERT_IMAGE_CHARS = 650000
ALERT_STATUS_RANK = {
    "no-duty": 0,
    "notified": 0,
    "accepted": 1,
    "canceled": 2,
    "activated": 3,
    "declined": 3,
    "callback": 3,
}
ALERT_PROGRESS_FIELDS = {
    "status",
    "acceptedBy",
    "acceptedAt",
    "response",
    "responseNote",
    "respondedBy",
    "respondedAt",
    "canceledBy",
    "canceledAt",
}
_firebase_init_attempted = False
_firebase_ready = False


def compact_alert_images(state):
    if not isinstance(state, dict) or not isinstance(state.get("alerts"), list):
        return state
    for alert in state["alerts"]:
        if isinstance(alert.get("image"), str) and len(alert["image"]) > MAX_ALERT_IMAGE_CHARS:
            alert["image"] = ""
            alert["imageRemoved"] = True
            audit = alert.get("audit") if isinstance(alert.get("audit"), list) else []
            note = "EKG 影像因容量限制已移除，通報文字與回覆紀錄保留"
            if note not in audit:
                audit.append(note)
            alert["audit"] = audit
    return state


def sanitize_state(payload):
    state = payload.get("state", payload)
    if not isinstance(state, dict):
        return state
    state = compact_alert_images(state)
    hospitals = state.get("hospitals")
    if isinstance(hospitals, list):
        state["hospitals"] = [
            hospital
            for hospital in hospitals
            if hospital.get("id") not in RETIRED_HOSPITAL_IDS and hospital.get("name") not in RETIRED_HOSPITAL_NAMES
        ]
    users = state.get("users")
    if isinstance(users, list):
        state["users"] = [
            user
            for user in users
            if not (user.get("id") in DEMO_USER_IDS or user.get("phone") in DEMO_PHONES)
        ]
    alerts = state.get("alerts")
    if isinstance(alerts, list):
        state["alerts"] = [
            alert
            for alert in alerts
            if not (
                alert.get("createdBy", {}).get("phone") in DEMO_PHONES
                or any(recipient.get("phone") in DEMO_PHONES for recipient in alert.get("recipients", []))
            )
        ]
        for alert in state["alerts"]:
            if isinstance(alert.get("image"), str) and len(alert["image"]) > MAX_ALERT_IMAGE_CHARS:
                alert["image"] = ""
                alert["imageRemoved"] = True
                audit = alert.get("audit") if isinstance(alert.get("audit"), list) else []
                note = "EKG 影像因容量限制已移除，通報文字與回覆紀錄保留"
                if note not in audit:
                    audit.append(note)
                alert["audit"] = audit
    on_duty = state.get("onDuty")
    if isinstance(on_duty, list):
        state["onDuty"] = [
            shift
            for shift in on_duty
            if shift.get("phone") not in DEMO_PHONES and shift.get("hospitalId") not in RETIRED_HOSPITAL_IDS
        ]
    return state


def merge_list_by_id(existing_items, incoming_items, deleted_ids=None):
    deleted_ids = set(deleted_ids or [])
    merged = {item.get("id"): item for item in existing_items or [] if item.get("id") and item.get("id") not in deleted_ids}
    for item in incoming_items or []:
        item_id = item.get("id")
        if not item_id or item_id in deleted_ids:
            continue
        merged[item_id] = {**merged.get(item_id, {}), **item}
    return list(merged.values())


def merge_alerts_by_id(existing_items, incoming_items):
    merged = {item.get("id"): item for item in existing_items or [] if item.get("id")}
    for item in incoming_items or []:
        item_id = item.get("id")
        if not item_id:
            continue
        existing = merged.get(item_id, {})
        next_item = {**existing, **item}
        existing_rank = ALERT_STATUS_RANK.get(existing.get("status"), 0)
        incoming_rank = ALERT_STATUS_RANK.get(item.get("status"), 0)
        if existing and incoming_rank < existing_rank:
            for field in ALERT_PROGRESS_FIELDS:
                if field in existing:
                    next_item[field] = existing[field]
        existing_audit = existing.get("audit") if isinstance(existing.get("audit"), list) else []
        incoming_audit = item.get("audit") if isinstance(item.get("audit"), list) else []
        if existing_audit or incoming_audit:
            next_item["audit"] = list(dict.fromkeys([*existing_audit, *incoming_audit]))
        merged[item_id] = next_item
    return list(merged.values())


def merge_state(existing_state, incoming_state, deleted_user_ids=None, deleted_duty_ids=None):
    if not isinstance(existing_state, dict):
        return incoming_state
    if not isinstance(incoming_state, dict):
        return existing_state
    merged = {**existing_state, **incoming_state}
    merged["users"] = merge_list_by_id(existing_state.get("users", []), incoming_state.get("users", []), deleted_user_ids)
    merged["onDuty"] = [
        duty
        for duty in merge_list_by_id(existing_state.get("onDuty", []), incoming_state.get("onDuty", []), deleted_duty_ids)
        if duty.get("userId") not in set(deleted_user_ids or [])
    ]
    for key in ("stations", "hospitals", "departments", "alertTypes"):
        merged[key] = merge_list_by_id(existing_state.get(key, []), incoming_state.get(key, []))
    merged["hospitals"] = [
        hospital
        for hospital in merged.get("hospitals", [])
        if hospital.get("id") not in RETIRED_HOSPITAL_IDS and hospital.get("name") not in RETIRED_HOSPITAL_NAMES
    ]
    merged["alerts"] = merge_alerts_by_id(existing_state.get("alerts", []), incoming_state.get("alerts", []))
    return merged


def db_connect():
    if not DATABASE_URL:
        return None
    import psycopg

    return psycopg.connect(DATABASE_URL)


def ensure_firebase():
    global _firebase_init_attempted, _firebase_ready
    if _firebase_init_attempted:
        return _firebase_ready
    _firebase_init_attempted = True
    if not FIREBASE_SERVICE_ACCOUNT_JSON and not FIREBASE_CREDENTIALS_FILE:
        print("Firebase push disabled: missing FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS")
        return False
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            _firebase_ready = True
            return True
        if FIREBASE_SERVICE_ACCOUNT_JSON:
            service_account = json.loads(FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(service_account)
        else:
            cred = credentials.Certificate(FIREBASE_CREDENTIALS_FILE)
        options = {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None
        firebase_admin.initialize_app(cred, options)
        _firebase_ready = True
        print("Firebase push enabled")
        return True
    except Exception as exc:
        print(f"Firebase push disabled: {exc}")
        _firebase_ready = False
        return False


def user_push_tokens(user):
    tokens = []
    for item in user.get("pushTokens", []) or []:
        token = item.get("token") if isinstance(item, dict) else item
        if token and token not in tokens:
            tokens.append(token)
    legacy_token = user.get("pushToken")
    if legacy_token and legacy_token not in tokens:
        tokens.append(legacy_token)
    return tokens


def push_targets_for_alert(state, alert):
    users_by_id = {user.get("id"): user for user in state.get("users", []) if user.get("id")}
    targets = []
    for recipient in alert.get("recipients", []) or []:
        user = users_by_id.get(recipient.get("userId"))
        if not user:
            continue
        for token in user_push_tokens(user):
            targets.append({
                "token": token,
                "userId": user.get("id"),
                "name": user.get("name", ""),
            })
    deduped = {}
    for target in targets:
        deduped[target["token"]] = target
    return list(deduped.values())


def alert_type_name(state, type_id):
    for item in state.get("alertTypes", []) or []:
        if item.get("id") == type_id:
            return item.get("name") or type_id
    return type_id or "急重症"


def hospital_name(state, hospital_id):
    for item in state.get("hospitals", []) or []:
        if item.get("id") == hospital_id:
            return item.get("name") or hospital_id
    return hospital_id or "後送醫院"


def station_name(state, station_id):
    for item in state.get("stations", []) or []:
        if item.get("id") == station_id:
            return item.get("name") or station_id
    return station_id or "院前端"


def send_push_for_alert(state, alert):
    if alert.get("status") != "notified":
        return {"sent": 0, "skipped": "alert-not-notified"}
    targets = push_targets_for_alert(state, alert)
    if not targets:
        return {"sent": 0, "skipped": "no-device-token"}
    if not ensure_firebase():
        return {"sent": 0, "skipped": "firebase-not-configured"}
    from firebase_admin import messaging

    type_name = alert_type_name(state, alert.get("typeId"))
    sender = alert.get("sender", {}) or {}
    title = f"{type_name} 急重症通報"
    body = f"{hospital_name(state, alert.get('hospitalId'))} / {station_name(state, sender.get('stationId'))} / {sender.get('phone', '')}"
    sent = 0
    failed = 0
    for target in targets:
        message = messaging.Message(
            token=target["token"],
            notification=messaging.Notification(title=title, body=body),
            data={
                "alertId": str(alert.get("id", "")),
                "typeId": str(alert.get("typeId", "")),
                "hospitalId": str(alert.get("hospitalId", "")),
                "url": "https://prehospital-critical-alert-test.onrender.com",
            },
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="critical-alerts-fire-v2",
                    sound="ems_alert.wav",
                    tag=str(alert.get("id", "")),
                    color="#0d766e",
                ),
            ),
        )
        try:
            messaging.send(message)
            sent += 1
        except Exception as exc:
            failed += 1
            print(f"FCM send failed for {target.get('userId')}: {exc}")
    return {"sent": sent, "failed": failed}


def dispatch_new_alert_pushes(previous_state, next_state):
    existing_ids = {alert.get("id") for alert in (previous_state or {}).get("alerts", []) if alert.get("id")}
    for alert in next_state.get("alerts", []) or []:
        if alert.get("id") in existing_ids:
            continue
        if alert.get("status") != "notified":
            continue
        result = send_push_for_alert(next_state, alert)
        print(f"Push dispatch for {alert.get('id')}: {result}")


def register_push_token(payload):
    user_id = str(payload.get("userId", "")).strip()
    token = str(payload.get("token", "")).strip()
    platform = str(payload.get("platform", "android")).strip() or "android"
    if not user_id or not token:
        raise ValueError("missing userId or token")
    state = read_state()
    if not state:
        raise ValueError("state not initialized")
    now_ms = int(time.time() * 1000)
    updated = False
    for user in state.get("users", []) or []:
        if user.get("id") != user_id:
            continue
        tokens = [item for item in (user.get("pushTokens") or []) if isinstance(item, dict) and item.get("token") != token]
        tokens.insert(0, {"token": token, "platform": platform, "updatedAt": now_ms})
        user["pushTokens"] = tokens[:5]
        updated = True
        break
    if not updated:
        raise ValueError("user not found")
    write_state(state)
    return {"ok": True, "tokenCount": len(tokens)}


def read_persisted_state():
    if DATABASE_URL:
        with db_connect() as conn:
            ensure_db(conn)
            with conn.cursor() as cur:
                cur.execute("SELECT state FROM app_state WHERE id = %s", ("main",))
                row = cur.fetchone()
                if row:
                    return json.loads(row[0])
        return None
    if not DATA_FILE.exists():
        return None
    return json.loads(DATA_FILE.read_text(encoding="utf-8-sig"))


def ensure_db(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                id TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    conn.commit()


def read_state():
    state = read_persisted_state()
    if state:
        return sanitize_state(compact_alert_images(state))
    if DATABASE_URL and DATA_FILE.exists():
        state = json.loads(DATA_FILE.read_text(encoding="utf-8-sig"))
        write_state(state)
        return state
    return None


def write_state(state, deleted_user_ids=None, deleted_duty_ids=None):
    current = read_persisted_state() if deleted_user_ids or deleted_duty_ids or DATABASE_URL or DATA_FILE.exists() else None
    if current:
        state = merge_state(current, state, deleted_user_ids, deleted_duty_ids)
    if DATABASE_URL:
        with db_connect() as conn:
            ensure_db(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO app_state (id, state, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (id)
                    DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
                    """,
                    ("main", json.dumps(state, ensure_ascii=False)),
                )
            conn.commit()
        dispatch_new_alert_pushes(current or {}, state)
        return
    DATA_FILE.parent.mkdir(exist_ok=True)
    DATA_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    dispatch_new_alert_pushes(current or {}, state)


class Handler(SimpleHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json({"ok": True})

    def do_GET(self):
        if self.path == "/health":
            self._send_json({"ok": True})
            return
        if self.path == "/api/state":
            try:
                self._send_json({"state": read_state()})
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=500)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/state":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                write_state(sanitize_state(payload), payload.get("deletedUserIds", []), payload.get("deletedDutyIds", []))
                self._send_json({"ok": True})
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=500)
            return
        if self.path == "/api/push-token":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                self._send_json(register_push_token(payload))
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=500)
            return
        self._send_json({"error": "not found"}, status=404)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5173"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving app and API on http://0.0.0.0:{port}/")
    server.serve_forever()
