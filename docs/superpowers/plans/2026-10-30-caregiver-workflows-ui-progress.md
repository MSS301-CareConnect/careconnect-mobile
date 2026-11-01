> HISTORICAL — Flutter implementation retired on 01/11/2026. Active design: 2026-11-01-react-native-caregiver-design.md.

# SDD ledger — plan: docs/superpowers/plans/2026-10-30-caregiver-workflows-ui.md

- Design approved by user: “triển khai giúp tôi”, 30/10/2026.
- Execution: inline, with one independent review after implementation.
- Ruling: keep existing dev checkout — user previously requested this branch and changes only in this repo; avoid another checkout/build cache.
- Ruling: no extra plan approval — user explicitly authorized implementation of the reviewed design.
- Ruling: no commits or pushes — AGENTS.md and approved spec reserve these for explicit requests.
- Pre-flight: Task 1 provides typed day/today/history/session interfaces consumed by Tasks 2–3. Task 4 is feature-owned; shell moves to lib/ to preserve core boundary. No conflicting interfaces found.
- Baseline: 25 tests passed before implementation.
- Task 1: complete — visit_workflows_test + api_contract_test: 8 passed; new interfaces observed missing in RED before implementation.
- Task 2: complete — five-tab navigation on 320×480 / text 1.5, availability entry and history/upcoming tests: 3 passed.
- Task 3: complete — actual server session navigation, DONE-only progress, report entry and confirmed checkout: 3 passed.
- Task 4: complete — feed baseline/new IDs/backfill/pause/session/failure tests: 5 passed; notification-list foreground/pause/resume widget test: passed. Polling-disabled RED verified before restoring the implementation.
- Extra: home shows BE totals 47/24 and error never becomes zero visits: passed.
- Full suite before final review: 42 passed.
- Ruling: use in-app banner with generic localized copy — prevents notification content lingering in a cross-session snackbar; no OS notification/push dependency needed.
- Ruling: use native plugin channel boundary to model GPS disabled in widget tests — no actual device service in the widget harness; production optional-location flow is unchanged.
- Ruling: localized BackButton is tapped by widget type in tests — Flutter tester.pageBack looks for English 'Back', while the app uses Vietnamese.
- Independent review: 3 Important findings; no Critical or deferred Minor findings.
- Final: fixed stale DataView callbacks — Home/Schedule/History push→pause/resume→pop regressions RED→GREEN. Return callbacks refresh owner state, including visit→session/report routes.
- Final: fixed midnight page retention — Home/Schedule page-1→VN-midnight→resume regressions RED→GREEN with literal page 0 assertions; Home's label/query use one captured timestamp.
- Final: fixed stale inbox reads — deferred pre-pause response regression RED→GREEN; serialized request loop retries obsolete GET only after resume, never repeats a write.
- Ruling: shared feature-owned schedule clock provider — home and schedule need the same source for calendar day decisions and device-time tests; no dependency added.
- Ruling on review exclusions: actual BE writes/delivery remain untested by design; source contracts checked read-only. Native build/install and visual QA handled by executor; no second review dispatched.
- Native QA: LDPlayer Android API28, 720×1280; existing instance launched, debug APK installed and started. Gateway health returned HTTP000; no BE source/data changed.
- Native QA found pre-existing startup spinner on failed session restore. Added startup_widget_test, observed missing retry in RED, then GREEN after ListenableBuilder on auth state. Refresh storage and authentication contracts unchanged.
- Visual QA: home, today cards, schedule, history and profile captured using ignored test-only fixture harness, inspected screenshots. No fixture is imported by lib/ or bundled as production data.
- Task 5: complete — final formatter: 53 files unchanged; analyzer: no issues; full suite: 49/49 passed; Android debug build with localhost gateway define: success (14.6 seconds).
- Final: all three material review findings fixed with regression tests; additional native-startup regression passed. No deferred minor findings.
- Ruling: preserve LDPlayer's saved session — native startup verified, gateway unavailable; do not erase user app data just to force a login screenshot. Native authenticated writes remain unverified.
- Ruling: keep branch dev and all source changes uncommitted for user review. APK, preview images and QA harness stay ignored by Git; no publication, push or merge.
- Final native verification: installed final APK, opened MainActivity, observed localized network-error/retry UI while gateway 8080 was unavailable. No flutter:E or AndroidRuntime:E entries in the final filtered log. Saved session was preserved; no successful BE authentication/clinical write is claimed.
