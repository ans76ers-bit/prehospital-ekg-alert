from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parent
DATA_FILE = Path(os.environ.get("APP_STATE_FILE", ROOT / "data" / "app_state.json"))
DATABASE_URL = os.environ.get("DATABASE_URL")
DEMO_USER_IDS = {"u-admin", "u-pre-1", "u-doc-er", "u-doc-cardio", "u-doc-trauma", "u-doc-neuro", "u-doc-cvs"}
DEMO_PHONES = {"0900000000", "0911000001", "0912000001", "0912000002", "0912000003", "0912000004", "0912000005"}
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


def sanitize_state(payload):
    state = payload.get("state", payload)
    if not isinstance(state, dict):
        return state
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
    on_duty = state.get("onDuty")
    if isinstance(on_duty, list):
        state["onDuty"] = [
            shift
            for shift in on_duty
            if shift.get("phone") not in DEMO_PHONES
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
    merged["alerts"] = merge_alerts_by_id(existing_state.get("alerts", []), incoming_state.get("alerts", []))
    return merged


def db_connect():
    if not DATABASE_URL:
        return None
    import psycopg

    return psycopg.connect(DATABASE_URL)


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
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


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
        return state
    if DATABASE_URL and DATA_FILE.exists():
        state = json.loads(DATA_FILE.read_text(encoding="utf-8"))
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
        return
    DATA_FILE.parent.mkdir(exist_ok=True)
    DATA_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


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
        self._send_json({"error": "not found"}, status=404)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5173"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving app and API on http://0.0.0.0:{port}/")
    server.serve_forever()
