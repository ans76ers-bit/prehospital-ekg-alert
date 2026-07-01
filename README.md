# 院前 EKG 與急重症通報測試版

這是目前用來讓消防員、急診科醫師、心臟內科醫師進行實際流程測試的網頁式 App / PWA 測試版。

## 測試版管理者

- 姓名：陳承彬
- 醫院：土城醫院
- 科別：急診醫學科
- 電話：0986994929
- 密碼：P123070487

目前已清除原本 Demo 的虛擬人員，測試人員請由管理者頁面重新建立或核准。

## 本機啟動

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\server.py
```

本機網址：

```text
http://127.0.0.1:5173/
```

同一個 Wi-Fi 下手機測試時，請使用電腦的區網 IP，例如：

```text
http://192.168.1.102:5173/
```

## 手機加入主畫面

Android：使用 Chrome 開啟網址，選單中點選「加入主畫面」或「安裝應用程式」。

iPhone：使用 Safari 開啟網址，點選分享，再選「加入主畫面」。

這是 PWA，所以外觀看起來會像手機 App，但本質仍是網頁式測試版。正式 App 可在測試流程穩定後再製作。

## 雲端部署

專案已加入可部署檔案：

- `server.py`：雲端後端與靜態檔案伺服器
- `requirements.txt`：Python 部署需求
- `Procfile`：通用 PaaS 啟動指令
- `render.yaml`：Render 部署設定
- `Dockerfile`：Docker 部署設定

重要：真正的固定測試網址需要部署到雲端平台後才會產生，例如 Render、Railway、Fly.io、Google Cloud Run、Azure App Service 或自有伺服器。

長時間多人測試時，建議使用有持久化儲存或資料庫的平台。若使用免費平台且沒有 persistent disk，重新部署或休眠後資料可能會消失。

## 測試重點

- 院前端建立通報、上傳 EKG 影像、選擇後送醫院。
- STEMI 通報應通知後送醫院的急診醫學科與心臟內科。
- ECMO 通報應通知後送醫院的急診醫學科與心臟外科。
- 院後端收到通知後，需開啟案件並回覆。
- 後台需紀錄院前發送時間、院後接收時間、院後回覆時間。
- 管理者可管理人員、分隊、醫院、班表、管理者權限與統計資料。
