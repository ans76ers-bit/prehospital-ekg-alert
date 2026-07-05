# Mac iOS Handoff Checklist

This project can be developed mostly on Windows, but the final iPhone build must be completed on macOS with Xcode.

## Current Project

- GitHub repo: `https://github.com/ans76ers-bit/prehospital-ekg-alert.git`
- Branch: `main`
- Capacitor app id / iOS bundle id: `tw.org.ems.prehospitalekg`
- Production/test server URL used by the native app: `https://prehospital-critical-alert-test.onrender.com`
- iOS project folder: `ios/App`
- Open in Xcode with: `ios/App/App.xcworkspace`

## Already Done On Windows

- The repo is synced to `origin/main`.
- Dependencies are installed with `pnpm install`.
- `pnpm exec cap sync ios` has been run successfully on Windows.
- Capacitor iOS plugins are detected:
  - `@capacitor/app`
  - `@capacitor/haptics`
  - `@capacitor/local-notifications`
  - `@capacitor/push-notifications`
- Windows could not run CocoaPods or Xcode steps, which is expected.

## What The Mac Must Do

1. Install Xcode from the Mac App Store or Apple Developer site.
2. Install command line tools:
   ```bash
   xcode-select --install
   ```
3. Install Homebrew if needed, then install tools:
   ```bash
   brew install node git cocoapods
   npm install -g pnpm
   ```
4. Clone the repo:
   ```bash
   git clone https://github.com/ans76ers-bit/prehospital-ekg-alert.git
   cd prehospital-ekg-alert
   ```
5. Install dependencies and sync iOS:
   ```bash
   pnpm install
   pnpm exec cap sync ios
   cd ios/App
   pod install
   open App.xcworkspace
   ```
6. In Xcode:
   - Open `App.xcworkspace`, not `App.xcodeproj`.
   - Select the `App` target.
   - Confirm bundle id is `tw.org.ems.prehospitalekg`.
   - Select the Apple Developer Team under Signing & Capabilities.
   - Add `Push Notifications`.
   - Add `Background Modes` and enable `Remote notifications`.
   - Confirm `ios/App/App/GoogleService-Info.plist` is included in the App target.
7. Connect an iPhone and run the app from Xcode.
8. Test notification flow on a real iPhone:
   - Log in as a hospital-side physician.
   - Allow notifications.
   - Send a test STEMI or critical alert from the prehospital side.
   - Verify foreground, background, and closed-app notification behavior.
9. For wider testing, archive in Xcode and upload to TestFlight.

## Firebase iOS Setup

In Firebase Console, add an iOS app to the same Firebase project:

- Bundle ID: `tw.org.ems.prehospitalekg`

Download:

```text
GoogleService-Info.plist
```

Place it locally on the Mac at:

```text
ios/App/App/GoogleService-Info.plist
```

Do not commit this file to GitHub.

For iOS push notifications, upload the Apple APNs authentication key to Firebase:

- Firebase Console -> Project settings -> Cloud Messaging -> Apple app configuration
- Bundle ID: `tw.org.ems.prehospitalekg`
- APNs key file: `.p8`
- Key ID
- Apple Team ID

## What To Give Your Friend

Give your friend:

- GitHub repo URL: `https://github.com/ans76ers-bit/prehospital-ekg-alert.git`
- Branch name: `main`
- This file: `MAC_HANDOFF.md`
- Bundle ID: `tw.org.ems.prehospitalekg`
- Render app URL: `https://prehospital-critical-alert-test.onrender.com`
- Firebase project access, preferably by inviting their Google account as a Firebase project member.
- Apple Developer access, preferably by inviting their Apple ID to the developer team or App Store Connect.

Do not give your friend your personal passwords.

## Account Access Recommendations

Use invitations and roles instead of sharing passwords:

- GitHub: invite the friend as a collaborator if the repo is private. If the repo is public, the URL is enough for cloning, but collaborator access is needed to push changes.
- Apple Developer / App Store Connect: invite the friend's Apple ID with the minimum role needed for Certificates, Identifiers, Profiles, and TestFlight work.
- Firebase: invite the friend's Google account to the Firebase project. They need enough permission to add the iOS app, download `GoogleService-Info.plist`, and configure Cloud Messaging/APNs.
- Render: only invite them if they must change backend environment variables or deployment settings.

Never send these through chat:

- GitHub password or personal access token
- Apple ID password
- Firebase service account private key
- Render API key
- APNs `.p8` private key, unless transferred through a secure channel and absolutely necessary
- `GoogleService-Info.plist` in a public repo

## Common Problems

- If Xcode cannot find pods or plugins, run `pod install` inside `ios/App` and reopen `App.xcworkspace`.
- If signing fails, check Apple Developer Team, bundle id, provisioning profile, and device registration.
- If push notifications do not work, check notification permission, Push Notifications capability, Background Modes, Firebase `GoogleService-Info.plist`, APNs key upload, and the backend Firebase service account environment variables on Render.
- If the app opens but shows old UI, confirm the Render deployment is current and the app is loading `https://prehospital-critical-alert-test.onrender.com`.
- If the app only works while open, test APNs/FCM on a physical iPhone; simulator/background behavior is not enough for this project.
