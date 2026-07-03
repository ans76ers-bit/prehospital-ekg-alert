# 手機 App 測試版規劃

## 目前採用方向

使用 Capacitor 將既有網頁系統包成 iPhone / Android 可安裝 App。App 會先連到目前 Render 測試網址：

```text
https://prehospital-critical-alert-test.onrender.com
```

## 不上架的安裝方式

- Android：可產生 APK，直接安裝到指定手機。
- iPhone：不能像 Android 一樣任意安裝。不上 App Store 的選項包含 Apple Developer 的 Ad Hoc、TestFlight，或用 Xcode 安裝到指定裝置。這些都需要 Apple 開發者帳號或 Mac/Xcode。

## 警示音與震動

測試版會分三層：

1. App 開著時：用網頁內既有鈴聲與震動提醒。
2. App 在背景時：使用 Push Notification 喚醒通知，點通知進入案件。
3. 高可靠度備援：若一定時間內未接收，後續應串接電話語音或簡訊。

限制：

- Android 可做較強的通知音與震動通道，但仍受使用者音量、勿擾模式、系統權限影響。
- iPhone 一般通知不能保證大聲響鈴；真正的 Critical Alerts 需要 Apple 特別核准。
- 若要接近急救通報可靠度，建議正式版加入電話語音備援。

## 下一步

1. 安裝 Android Studio 與 JDK，建立 Android APK。
2. 準備 Firebase 專案，設定 Android FCM 推播。
3. 若要測 iPhone，準備 Mac、Xcode、Apple Developer 帳號與 iOS 裝置 UDID。
4. 在後端建立裝置 token 登錄與推播送出 API。

## 目前已完成的 App 骨架

- `package.json`：Capacitor 與通知/震動插件。
- `capacitor.config.json`：App ID、App 名稱、Render 測試網址。
- `android/`：Android 原生專案。
- `ios/`：iOS 原生專案。
- `www/`：Capacitor 啟動頁，會導向 Render 測試系統。
- `android/app/src/main/res/raw/ems_alert.wav`：Android 通知警示音。
- `ios/App/App/ems_alert.wav`：iOS 警示音備用檔，之後需在 Xcode 確認加入 Copy Bundle Resources。

## Android 產生測試 APK

這台電腦目前缺 JDK / Android Studio，所以還不能直接編譯 APK。安裝完成後：

```powershell
$env:Path='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' exec cap sync android
cd android
.\gradlew.bat assembleDebug
```

成功後 APK 會在：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## iPhone 測試安裝

iPhone 不上架仍需要 Apple 的簽章流程。可行方式：

- 用 Mac + Xcode 連接你的 iPhone 直接安裝測試。
- 使用 Apple Developer 的 Ad Hoc 或 TestFlight 給指定人員測試。

在 Mac 上：

```bash
pnpm exec cap sync ios
pnpm exec cap open ios
```

然後在 Xcode 設定 Team、Signing、實體 iPhone 裝置後安裝。

## 警示可靠度提醒

目前已先加入原生 Local Notifications / Haptics 的入口；但若 App 完全關閉或長時間背景化，要可靠通知仍需要 Push Notifications。正式急救測試建議下一階段串接 Firebase Cloud Messaging / APNs，並加上電話語音備援。
