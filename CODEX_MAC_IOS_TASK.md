# Codex Task: Finish iOS Build On Mac

You are Codex running on the friend's Mac. The user is not technical. Your job is to continue this existing Capacitor app and get it as close as possible to an installable iPhone build, without asking the user to understand Xcode details.

## Goal

Finish the Mac-only iOS steps for this project:

1. Clone or update the repo.
2. Install Mac dependencies.
3. Sync Capacitor iOS.
4. Install CocoaPods.
5. Open/build the iOS project in Xcode.
6. Configure signing, Firebase iOS config, and push notification capabilities as far as the available accounts allow.
7. Run on a real iPhone if possible.
8. If account access allows, prepare an Archive/TestFlight build.
9. Report exactly what succeeded, what is still blocked, and what human account actions are needed.

## Project Facts

- GitHub repo: `https://github.com/ans76ers-bit/prehospital-ekg-alert.git`
- Branch: `main`
- App type: Capacitor web/native app
- iOS bundle id / Capacitor app id: `tw.org.ems.prehospitalekg`
- Native app loads this server URL: `https://prehospital-critical-alert-test.onrender.com`
- iOS project path after clone: `ios/App`
- Xcode workspace to open: `ios/App/App.xcworkspace`
- Do not open `ios/App/App.xcodeproj` unless debugging project metadata only.

## Important Safety Rules

- Do not ask for or store the user's GitHub, Apple ID, Firebase, or Render passwords.
- Prefer collaborator/team invitations and browser login by the account owner.
- Do not commit secrets.
- Do not commit `ios/App/App/GoogleService-Info.plist`.
- Do not commit APNs `.p8` private keys.
- Do not commit Firebase service account JSON.
- If an account login, 2FA, Apple Developer agreement, paid membership, certificate approval, or Firebase permission is needed, stop and tell the human exactly what screen/action is required.

## Files To Read First

After cloning the repo, read these files before making changes:

- `MAC_HANDOFF.md`
- `IOS_APP_PREP.md`
- `PUSH_PRODUCTION_SETUP.md`
- `capacitor.config.json`
- `package.json`
- `.gitignore`
- `ios/.gitignore`

Note: Some older Markdown files may show garbled Chinese because they were created on Windows. Trust `MAC_HANDOFF.md` and this file first.

## Recommended Setup Commands

Run these on the Mac. If a command is already satisfied, continue.

```bash
xcode-select --install
brew --version || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node git cocoapods
npm install -g pnpm
```

Clone and enter the repo:

```bash
git clone https://github.com/ans76ers-bit/prehospital-ekg-alert.git
cd prehospital-ekg-alert
git status --short --branch
git pull --ff-only
```

Install and sync:

```bash
pnpm install
pnpm exec cap sync ios
cd ios/App
pod install
open App.xcworkspace
```

## Xcode Work

In Xcode:

1. Open `ios/App/App.xcworkspace`.
2. Select the `App` project and `App` target.
3. Confirm Bundle Identifier is:
   ```text
   tw.org.ems.prehospitalekg
   ```
4. In Signing & Capabilities:
   - Select the correct Apple Developer Team.
   - Enable automatic signing if appropriate.
   - Add `Push Notifications`.
   - Add `Background Modes`.
   - Enable `Remote notifications` under Background Modes.
5. Confirm app display name and icons are acceptable.
6. Build the app for a real iPhone, not only the simulator.

## Firebase iOS Setup

The iOS app needs Firebase config and APNs setup for push notifications.

In Firebase Console:

1. Open the existing Firebase project for this app.
2. Add an iOS app if it does not already exist.
3. Use Bundle ID:
   ```text
   tw.org.ems.prehospitalekg
   ```
4. Download:
   ```text
   GoogleService-Info.plist
   ```
5. Place it locally at:
   ```text
   ios/App/App/GoogleService-Info.plist
   ```
6. In Xcode, make sure `GoogleService-Info.plist` is included in the `App` target.
7. For iOS push, upload the APNs authentication key to Firebase:
   - Firebase Console -> Project settings -> Cloud Messaging -> Apple app configuration
   - APNs `.p8` key
   - Key ID
   - Team ID
   - Bundle ID `tw.org.ems.prehospitalekg`

If the human cannot provide Firebase or Apple permissions, continue with local build/signing as far as possible and clearly report that iOS push validation is blocked by account access.

## Real iPhone Test Plan

Use a physical iPhone. Simulator testing is not enough for this project.

1. Install/run the app from Xcode.
2. Log in as a hospital-side physician account.
3. Allow notifications when iOS asks.
4. From another browser/device/session, log in as a prehospital user and send a test alert.
5. Test these states:
   - App open in foreground.
   - App in background.
   - App closed, if possible.
6. Verify:
   - Push notification arrives.
   - Notification opens the app.
   - Hospital-side alert list updates.
   - Alert sound/vibration behavior is acceptable.
   - Doctor can accept and reply.
   - Prehospital side can see the reply.

## Expected Limitations

- If Apple Developer Program membership is missing, TestFlight and full push capability may be blocked.
- If no physical iPhone is available, only build/simulator checks can be done.
- If Firebase iOS app or APNs key is missing, foreground/web-like behavior may work, but true iOS background push is not fully validated.
- If Xcode signing fails, this is usually account/team/provisioning related, not necessarily an app code problem.

## When To Modify Code

Only modify code if needed to make the iOS build work or to fix a clear iOS-specific bug.

Before changing files:

1. Check `git status --short`.
2. Keep changes narrowly scoped.
3. Do not rewrite unrelated app logic.
4. Do not remove Android setup.
5. Do not commit generated secrets.

After changes:

```bash
pnpm exec cap sync ios
cd ios/App
pod install
```

Then build again in Xcode.

## Completion Report Format

At the end, report in plain language:

- Repo commit tested.
- Mac setup completed: yes/no.
- `pnpm install`: passed/failed.
- `pnpm exec cap sync ios`: passed/failed.
- `pod install`: passed/failed.
- Xcode workspace opened: yes/no.
- Signing configured: yes/no/blocked.
- Firebase `GoogleService-Info.plist` added: yes/no/blocked.
- Push Notifications capability added: yes/no/blocked.
- Background Remote notifications enabled: yes/no/blocked.
- Real iPhone install: passed/failed/blocked.
- TestFlight/archive: passed/failed/blocked.
- Remaining blockers and exact human actions needed.

## Human-Friendly Summary To Give Back

If everything works, tell the user:

```text
Mac iOS build is ready. The app runs on a real iPhone. Push notification testing result: <result>. Next step: TestFlight or broader testing.
```

If blocked, tell the user:

```text
The code/project setup is ready, but iOS finalization is blocked by <Apple/Firebase/device/signing reason>. The next human action is: <specific action>.
```
