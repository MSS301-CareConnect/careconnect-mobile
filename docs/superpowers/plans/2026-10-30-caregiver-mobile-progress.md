> HISTORICAL — Flutter implementation retired on 01/11/2026. Active design: 2026-11-01-react-native-caregiver-design.md.

# SDD ledger — plan: docs/superpowers/plans/2026-10-30-caregiver-mobile.md

- Design approved and implementation explicitly requested by user.
- Ruling: implement inline in current repo on codex/caregiver-mobile — user restricts edits to careconnect-mobile; no external worktree.
- Ruling: user instruction to begin covers execution of the approved design; no additional plan approval round.
- Ruling: retain uncommitted changes for review; avoid unsolicited commits.
- Pre-flight: Tasks 2–4 consume Task 1 ApiClient and auth scope; Task 3 consumes Task 2 booking/session IDs. No conflicting interfaces.
- Baseline: repo contains README and approved design only, no app/test suite. Installed Flutter 3.44.1, Dart 3.12.1.
- Task 1: core session/client and localized login/router implemented; tests demonstrated missing implementation then passed. Added regressions for non-JSON gateway 401 and revoked role on resume, observed both failures before fixes.
- Task 2: typed visits/sessions, snapshots, actions, optional location, task checklist, notes/vitals and check-out implemented. Check-in boundaries and documented payloads tested.
- Task 3: reports/photo workflow implemented. Submission guarded by ENDED session. Lost PUT/submit responses reconcile on explicit retry; entered fields retained. Focused tests passed after reproducing stale-version retry.
- Task 4: availability/time-off, open shifts/registrations, profile/media/certificates, account/password and notifications implemented.
- Ruling: current BE unified /auth/login and /auth/refresh + X-Client-Type mobile supersede deprecated aliases in original design — verified AuthenticationController and TokenTransport.
- Ruling: cancellation of registrations only for PENDING; APPROVED stays active for duplicate guards and its availability can be cancelled with reason — verified ShiftRegistrationServiceImpl.
- Ruling: provider shift time uses Asia/Ho_Chi_Minh (+07) regardless of device; clinical Instants use device local display.
- Ruling: native document picker handles both images/PDF; removed unused image_picker and cupertino_icons dependencies.
- Ruling: use Gradle 9.4.1, compatible with AGP 9.0.1 and available on host, after generated 9.1.0 distribution stalled during download. No check or threshold weakened.
- Independent review found five P2 issues: deleted historic shift blocks list; impossible approved-registration cancellation; small-screen visit overflow; report recovery after lost write response; time-off draft loss. All addressed; focused regression verification ongoing.
- Android emulator started headless. Native debug build progressing through Gradle/plugin dependencies; no real-backend mutation or account creation performed.
- Task 1: complete — auth/client/widget cases included in final suite.
- Task 2: complete — typed visit/session and action boundary tests included in final suite.
- Task 3: complete — lost draft and lost submission response tests pass; submitted editor becomes read only; explicit reload added for conflicts.
- Task 4: complete — historical 404, cancellation predicate, large-text navigation and retained time-off form regressions pass.
- Final checks: `flutter analyze --no-pub` → no issues; `flutter test --no-pub` → 25 passed; formatter → no changes; Android debug build → successful (fresh incremental rebuild 15s after code fixes).
- iOS deployment target raised to 14 to match file_picker_darwin; Keychain entitlement and vi/en location usage strings included. iOS native build unverified on Windows.
- Existing AVD had only 112 MB free; no data removed. Created repo-local ignored careconnect_qa AVD for native smoke verification.
- Local gateway localhost:8080 health connection unavailable; real-account BE integration remains explicitly unverified.
- Native smoke: installed APK on repo-local Android 36.1 emulator; launch, empty-login validation, locale change and password-recovery navigation verified via actual UI and semantics. No Flutter/AndroidRuntime errors observed for app PID.
- Device QA found cached validation copy remained in old language after switching locale. Added regression, reproduced failure, changed attempted login form to live validation and localized stored server errors at render time; focused tests now pass.
- Task 5: review fixes implemented and focused checks pass. Final analyzer/test/build rerun and native re-install of the final APK in progress. No commits, push, merge or publication performed.
- Task 5: complete — final formatter unchanged, analyzer no issues, 25/25 tests passed, fresh Android debug build passed (15.3s). Re-installed final APK successfully; native validation messages correctly follow locale changes. Final login preview saved under build/previews/android-login.png.
- Whole-change reviewer findings resolved with domain/widget regressions; no outstanding material review finding. Native iOS and real-account backend integration remain environment limitations, documented in README.
- Delivery: preserve current codex/caregiver-mobile branch and uncommitted files for user review. Temporary QA emulator stopped; no existing emulator data deleted.
- Cleanup limitation: automatic review rejected recursive deletion of the repo-owned temporary QA AVD with blocked by policy, including a safer literal-path retry after path/ownership verification. Emulator is stopped; ignored .tools/avd files remain. No alternative deletion mechanism attempted.
- User requested reducing folder size: preserved final APK at ignored artifacts/careconnect-debug.apk, ran flutter clean successfully. .tools was already absent when inspected in this turn. Verified total 188.13 MB, including APK 182.40 MB; source/config about 6 MB. No business source or lockfile removed.
