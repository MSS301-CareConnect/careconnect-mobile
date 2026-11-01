# Convert CareConnect to React Native CLI

User explicitly requests replacing Expo with React Native CLI, superseding the previous Expo decision and generated-native convention. Preserve all current caregiver UI/API/session/photo work and local data. BE/FE source remain read-only. No commits, releases, signing keys or local SDK paths in source.

## Design

Use the official CLI20.2.0 template matching existing RN0.88.1/React19.3.0/TypeScript6. Android becomes maintained native source; the user's later clarification limits this migration to Android. Replace Expo entry/status bar/icons/document picker/location/secure store and config/testing/build infrastructure. Refresh remains in native secure storage; access remains in memory; old Expo refresh storage is not imported, so the first CLI run signs in again. Documents remain content URIs without app cache copies; optional location stays foreground-only and bounded. Preserve gateway-only transport, write uncertainty, optimistic versions, locales and report confirmation/recovery.

Keep Metro8090 to avoid Identity8081. Debug launches the native app directly; no Expo development launcher. Debug uses Metro, release requires HTTPS and separate production signing. API_URL in ignored .env is bundled public configuration. Android HTTP is debug-only. No Expo dependency is installed. There is no iOS target or iOS run/build instruction; the unused template was archived locally.

## Ownership and work

- [x] Root: native template, package/lock, Metro/Babel/Jest/TS/ESLint, entry/icons/report picker integration, build/ADB scripts and architecture.
- [x] Native adapter agent: core secure storage/documents/location adapters, AppProvider, meaningful boundary tests.
- [x] Documentation agent: README/RUN_MOBILE/LDPLAYER/AGENTS and CI.
- [x] Integrate, run strict checks/native config/doctor, build Android, inspect packaged manifest/dependencies, final scoped fresh-context review.

## Verification boundaries

The latest photo flow is retained: local selection before draft, save/checkpoint/upload on Save or confirmed Submit, no uncertain upload replay. Live gateway PNG upload returned200 and its probe attachment was removed; this is distinct from a native device picker test. Existing large Flutter→RN work is uncommitted and must not be reset. Archive current Expo source/config locally without secrets before replacing generated native directories. Only delete resolved native targets within this workspace after validation.

## Ledger

- Retired generated native directories/config/source are archived under ignored artifacts; resolved paths were checked before reversible moves. No keys or local SDK paths were copied into new source.
- Clean dependency resolution from an empty scratch directory corrected stale optional lock entries and pins react-test-renderer19.3.0 to React19.3.0. Modern ft-flow3.0.11 is used with ESLint9 without suppressing rules. npm ci succeeds; the lock has no installed Expo package.
- npm run check passes format, lint (0 errors, style warnings under the native recommended rules), strict TypeScript and76 tests/8 suites, including23 native-adapter boundary tests. Current CLI project config recognizes the Android package and no iOS project. Fresh-context review found no actionable runtime/native/security/CI defects.
- Native x86_64 debug build passed in10m16s with JAVA_HOME21; artifact50,200,430 bytes. Packaged Feather font and expected MainActivity/application ID verified; no Expo-named APK entries. Main-source HTTP denial/debug HTTP override retained. CLI Metro returns200 for Android index bundle (5,350,236 bytes). maxWorkers2 bounds development resource use on this16GB host running BE services. Final Android-platform Jest run passes76 tests/8 suites; tab tests now use Android's actual tab accessibility role rather than the old iOS button label.
- Doctor uses Java from PATH; Oracle Java25 was found there while Gradle uses configured JAVA_HOME21. With JAVA_HOME/bin first and RCT_METRO_PORT8090, Node/npm/Metro/ADB/Studio/SDK/Gradle checks pass; one JDK-range error remains because CLI20.2 declares17–20. No check is patched or suppressed. Actual native build with21 passed, and the limitation is recorded in RUN_MOBILE.
- User will run the app later. No native APK installation or manual app interaction is claimed. Agent-started Metro and headless verification AVD were stopped; no app was uninstalled or cleared. Current instructions cover Android Studio, LDPlayer, first install vs later Fast Refresh, multi-device selection and signing mismatch preservation. npm run android targets the active device architecture; build:android/CI can still build the full configured ABI list.
