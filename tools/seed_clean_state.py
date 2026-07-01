import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "app_state.json"


def main():
    state = {
        "stations": [
            {"id": "s-tucheng", "city": "新北市", "name": "土城分隊", "active": True},
            {"id": "s-dingpu", "city": "新北市", "name": "頂埔分隊", "active": True},
            {"id": "s-qingshui", "city": "新北市", "name": "清水分隊", "active": True},
            {"id": "s-shulin", "city": "新北市", "name": "樹林分隊", "active": True},
            {"id": "s-shutan", "city": "新北市", "name": "樹潭分隊", "active": True},
            {"id": "s-ganyuan", "city": "新北市", "name": "柑園分隊", "active": True},
            {"id": "s-sanxia", "city": "新北市", "name": "三峽分隊", "active": True},
            {"id": "s-longen", "city": "新北市", "name": "隆恩分隊", "active": True},
            {"id": "s-yingge", "city": "新北市", "name": "鶯歌分隊", "active": True},
            {"id": "s-fengming", "city": "新北市", "name": "鳳鳴分隊", "active": True},
        ],
        "hospitals": [
            {"id": "h-tu", "city": "新北市", "name": "土城醫院", "active": True},
            {"id": "h-fy", "city": "新北市", "name": "亞東醫院", "active": True},
        ],
        "departments": [
            {"id": "dep-er", "name": "急診醫學科", "active": True},
            {"id": "dep-trauma", "name": "外傷科", "active": True},
            {"id": "dep-cardio", "name": "心臟內科", "active": True},
            {"id": "dep-cvs", "name": "心臟外科", "active": True},
            {"id": "dep-neuro", "name": "神經內科", "active": True},
            {"id": "dep-other", "name": "其他科", "active": True},
        ],
        "users": [
            {
                "id": "u-admin-chen",
                "role": "admin",
                "name": "陳承彬",
                "phone": "0986994929",
                "password": "P123070487",
                "stationId": "s-tucheng",
                "hospitalId": "h-tu",
                "departmentId": "dep-er",
                "approved": True,
            }
        ],
        "onDuty": [],
        "alertTypes": [
            {
                "id": "stemi",
                "name": "STEMI",
                "routeDepartments": ["dep-er", "dep-cardio"],
                "active": True,
                "prompt": "請上傳 12 導程 EKG 影像，通報後送醫院急診醫學科醫師與心臟內科醫師。",
            },
            {
                "id": "ecmo",
                "name": "ECMO",
                "routeDepartments": ["dep-er", "dep-cvs"],
                "active": True,
                "prompt": "請通報後送醫院急診醫學科醫師與心臟外科醫師。",
            },
            {
                "id": "trauma",
                "name": "重大創傷",
                "routeDepartments": ["dep-er", "dep-trauma"],
                "active": True,
                "prompt": "請通報後送醫院急診醫學科醫師與外傷科醫師。",
            },
            {
                "id": "stroke",
                "name": "急性腦梗塞",
                "routeDepartments": ["dep-er", "dep-neuro"],
                "active": True,
                "prompt": "請通報後送醫院急診醫學科醫師與神經內科醫師。",
            },
        ],
        "alerts": [],
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
