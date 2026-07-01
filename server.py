from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parent
DATA_FILE = Path(os.environ.get("APP_STATE_FILE", ROOT / "data" / "app_state.json"))
DATABASE_URL = os.environ.get("DATABASE_URL")
DEMO_USER_IDS = {"u-admin", "u-pre-1", "u-doc-er", "u-doc-cardio", "u-doc-trauma", "u-doc-neuro", "u-doc-cvs"}
DEMO_PHONES = {"0900000000", "0911000001", "0912000001", "0912000002", "0912000003", "0912000004", "0912000005"}


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


def db_connect():
    if not DATABASE_URL:
        return None
    import psycopg

    return psycopg.connect(DATABASE_URL)


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
    if DATABASE_URL:
        with db_connect() as conn:
            ensure_db(conn)
            with conn.cursor() as cur:
                cur.execute("SELECT state FROM app_state WHERE id = %s", ("main",))
                row = cur.fetchone()
                if row:
                    return json.loads(row[0])
            if DATA_FILE.exists():
                state = json.loads(DATA_FILE.read_text(encoding="utf-8"))
                write_state(state)
                return state
            return None
    if not DATA_FILE.exists():
        return None
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def write_state(state):
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
                write_state(sanitize_state(payload))
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
