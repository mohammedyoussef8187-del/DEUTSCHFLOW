# Claude Final iOS Application Handoff

- **branch:** `mobile-foundation` — not merged to `main`
- **start commit:** `9a30caf`
- **final commit:** see `FINAL` below

---

## Production build — PASS

The web app is a no-build static ESM site: `index.html` loads `src/app.js` as a module and
everything else is a plain file. There is no bundler step to run, so "production build" here
means the shipped tree is complete and current, which was verified by comparing it against
the copy Capacitor placed in the iOS bundle: **82 files, byte-identical, 0 problems**.

Vendor bundles (`vendor/lit.js`, `vendor/capacitor-sqlite.js`) are current. They were left
exactly as committed — rebuilding them on this machine only rewrites embedded comment paths
with this worktree's junctioned `node_modules` location, which would put a local absolute
path into a shipped file.

## Regression — PASS

**1336 passing / 78 files**, zero failures, confirmed on four consecutive clean runs.

One defect was found and fixed here, because it directly blocks a trustworthy release gate:
two tests walk every lesson of both courses through the real controller, and both were
running against Vitest's default five-second budget. Each takes about 1.1–1.3 s alone and
several times that when seventy-eight files run beside it, so the suite failed
intermittently — a different test each time, which is what made it look like a regression
rather than a timeout. Both now carry a 30 s budget that states the size of the work. **No
assertion was changed or weakened.**

`ORPHAN_REFERENCES = 0`, `INVALID_REFERENCES = 0`, `USER_ACTION_REQUIRED = 0`,
corrupted learner strings `0` — all unchanged from the cleanup gate.

## Capacitor — PASS

- **CLI / runtime:** Capacitor **8.5.0**; `@capacitor/ios` 8.5.0,
  `@capacitor-community/sqlite` 8.1.1
- **config:** `capacitor.config.json` at the repository root
  - `appId` `com.deutschflow.app`, `appName` `DeutschFlow`
  - `webDir` `01_APPLICATION/CURRENT_APP`
  - `ios.contentInset` `always`
  - `CapacitorSQLite`: `iosDatabaseLocation` `Library/CapacitorDatabase`,
    encryption off, biometrics off, `iosKeychainPrefix` `deutschflow`
- the config is copied into the app at `ios/App/App/capacitor.config.json`, with
  `packageClassList: ["CapacitorSQLitePlugin"]` resolved by the CLI

## iOS project — GENERATED

```
ios/App/App.xcodeproj          the Xcode project
ios/App/CapApp-SPM/Package.swift   native dependencies (Swift Package Manager)
ios/App/App/public/            the web app, 82 files
```

Capacitor 8 generates an **SPM** project — there is no Podfile and no `.xcworkspace`, and
CocoaPods is not used anywhere. `@capacitor-community/sqlite` is both declared as a package
dependency and linked into the `CapApp-SPM` target; those are the two assertions
`codemagic.yaml` makes, and both hold.

`Info.plist` needs no hand-editing: display name `DeutschFlow`, all four orientations on
iPad and three on iPhone, launch storyboard present, and **no permission strings required**
— the app records nothing, and notifications are gated off.

`ios/` and `android/` remain **gitignored**, which is this repository's existing decision:
native projects are build output regenerated on the build machine. That decision is load
bearing here, because a project generated on Windows writes a Windows absolute path into
`Package.swift`:

```
.package(name: "CapacitorCommunitySqlite", path: "..\..\..\...\node_modules\@capacitor-community\sqlite")
```

which is meaningless to macOS. `npx cap sync ios` rewrites that file on every run, so a Mac
regenerates it correctly from its own `node_modules`. Committing the Windows copy would
ship a project that cannot build.

## iOS sync — PASS

`npx cap add ios` and `npx cap sync ios` both complete on this machine. Sync copies the web
assets and rewrites the SPM manifest; the plugin is found and included each time.

## Clean dataset bundled — YES

`ios/App/App/public/data/canonical-content.json` is byte-identical to the shipped dataset:
2 courses, 35 lessons, 442 vocabulary rows, produced by the real pipeline and carrying the
legacy cleanup. `data/seed-data.js` (2820 raw rows, 3 excluded at load by the triage) is
bundled beside it.

## Offline ready — YES

Every asset the app loads is a file inside the bundle — `index.html`, `styles.css`,
`src/`, `vendor/`, both data files, icons and manifest. The content loader fetches a
**relative** path (`data/canonical-content.json`), which under Capacitor resolves inside the
bundle, and there is not one absolute or remote URL in the application source.

Worth stating plainly, because it looks like a gap and is not: the service worker registers
only on `https:`, so it does **not** register under Capacitor's `capacitor://` scheme. That
is correct. On iOS offline works because the assets *are* the app, not because something
cached them. The service worker exists for the deployed PWA, where the origin is HTTPS.

## Learner journey on the bundle — PASS

Run against `ios/App/App/public` — the exact bytes the iOS app will load — from a cleared
first launch:

| step | result |
| --- | --- |
| open app, start A1 | resumes at `Hallo! Ich heiße …`; A1 = 18 lessons, A2 = 17 |
| lesson renders | 8 sections, 25 items, 0 unlabelled |
| answer exercises | `bin` rejected, `heiße` accepted |
| save progress | 1/18 (6 %) |
| open A2 | 17 lessons reachable |
| reopen without losing progress | resume `Woher kommst du?`, A1 6 %, lesson 1 `completed` |
| legacy vocabulary | 2817 stored, review queue 0 |

## Persistence

Learner state persists in **IndexedDB inside the WebView**, which is the intended path while
the native-storage gates stay off — `learnerStorageSwitch`, `canonicalNativeStore` and
`nativeStorageEnabled` are all `false`, and `codemagic.yaml` asserts the last of these on
every run. The CapacitorSQLite plugin is configured and linked so the native store can be
switched on after on-device verification; nothing was activated here.

## Native build — REQUIRES_MACOS_XCODE

Not attempted and not simulated. This machine is Windows with no macOS, no Xcode and no
Apple hardware; nothing was compiled, installed or launched.

### Exact remaining step on a Mac

```bash
npm ci && npx cap sync ios && open ios/App/App.xcodeproj
```

`cap sync` is what regenerates `Package.swift` with a correct relative path, so it must run
before Xcode opens the project. To compile without opening Xcode:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

Pushing this branch also triggers the `ios-capacitor-validation` workflow in
`codemagic.yaml`, which does all of the above on a `mac_mini_m2` and then boots a
simulator, installs, launches, and runs a two-phase persistence harness.

## Genuine blockers

None in the software. Remaining conditions are external and unchanged:

- **macOS + Xcode** for compilation and simulator/device verification
- **Apple signing credentials** before the `ios-signed-device-build` workflow can run;
  `com.deutschflow.app` is still a placeholder bundle identifier
- audio production for the 7 script-only listening activities
- pronunciation content
