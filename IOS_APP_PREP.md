# iOS App 前置作業

目前 Windows 這台電腦已完成 iOS 專案前置架構：

- Capacitor iOS 專案位於 `ios/App`
- Bundle ID 已設定為 `tw.org.ems.prehospitalekg`
- 已加入 Capacitor Push Notifications plugin
- 已準備 App icon 與警示音 `ios/App/App/ems_alert.wav`
- `ios/App/App/GoogleService-Info.plist` 已加入 `.gitignore`，避免 Firebase 設定檔進 GitHub

## 還需要 Mac 才能完成的事

iOS App 必須由 macOS + Xcode 編譯與簽章，Windows 不能直接產生可安裝到 iPhone 的 IPA。

需要準備：

1. Mac
2. Xcode
3. Apple Developer Program 帳號
4. Firebase iOS App 設定檔
5. APNs authentication key

## Firebase iOS App

在 Firebase Console 的同一個專案 `prehospital-ekg-alert` 裡新增 iOS app。

Bundle ID 請填：

```text
tw.org.ems.prehospitalekg
```

下載後會得到：

```text
GoogleService-Info.plist
```

之後在 Mac 上放到：

```text
ios/App/App/GoogleService-Info.plist
```

## APNs 推播金鑰

在 Apple Developer 後台建立 APNs authentication key，下載 `.p8` 檔，並記錄：

- Key ID
- Team ID
- Bundle ID: `tw.org.ems.prehospitalekg`

回到 Firebase Console：

```text
專案設定 -> Cloud Messaging -> Apple app configuration
```

上傳 APNs authentication key。

## Mac 上接續步驟

在 Mac 下載這個 GitHub 專案後：

```bash
pnpm install
pnpm exec cap sync ios
cd ios/App
pod install
open App.xcworkspace
```

在 Xcode 裡：

1. 選 App target
2. Signing & Capabilities 選 Apple Developer Team
3. 加入 Push Notifications capability
4. 加入 Background Modes，勾選 Remote notifications
5. 確認 `GoogleService-Info.plist` 已加入 App target
6. 接 iPhone 實機測試，或 Archive 上傳 TestFlight

## 建議測試順序

1. 安裝 iOS App
2. 登入院後端醫師帳號
3. 允許通知權限
4. 從院前端發出 STEMI 測試通報
5. 確認 App 關閉時 iPhone 是否收到推播
6. 確認點通知後能回到通報頁

