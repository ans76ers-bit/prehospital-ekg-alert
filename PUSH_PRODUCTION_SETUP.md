# 正式推播設定

目前程式已加入 Android FCM 推播流程：

- App 登入後會向 Android 取得 FCM device token。
- App 會把 token 回傳到 `/api/push-token` 並綁定登入使用者。
- 消防員送出新通報後，後台會針對該通報的接收醫師送出 FCM 推播。
- Android 通知使用 `critical-alerts-fire-v2` 頻道與 `ems_alert.wav` 警示音。

## 還需要提供的 Firebase 檔案

1. `google-services.json`

   從 Firebase Console 建立 Android app 後下載，套件名稱必須是：

   ```text
   tw.org.ems.prehospitalekg
   ```

   下載後放在：

   ```text
   android/app/google-services.json
   ```

2. Firebase service account JSON

   從 Firebase / Google Cloud 的服務帳戶下載，用於 Render 後台送出 FCM。
   不要提交到 GitHub。

   Render 環境變數請設定：

   ```text
   FIREBASE_SERVICE_ACCOUNT_JSON=<整份 service account JSON 內容>
   FIREBASE_PROJECT_ID=<Firebase project id>
   ```

## 重包 Android APK

放入 `google-services.json` 後，在本機執行：

```powershell
$node = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$jdk = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$sdk = 'C:\Users\user\Android\Sdk'
$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$node;$jdk\bin;$sdk\cmdline-tools\latest\bin;$sdk\platform-tools;" + $env:Path
pnpm exec cap sync android
cd android
.\gradlew.bat assembleDebug
```

產出的 APK：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 重要限制

正式急救使用前，仍需實測：

- App 關閉時是否收到 Android 系統通知。
- 通知是否使用緊急警示音。
- 醫師點通知後是否能進入通報頁。
- 回覆後院前端是否收到狀態更新。
- Render 免費版睡眠造成的延遲是否可接受。

