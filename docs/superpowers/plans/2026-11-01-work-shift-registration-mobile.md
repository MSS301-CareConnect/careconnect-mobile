# Mobile work-shift registration implementation plan

> For agentic workers: use superpowers:executing-plans inline, then one fresh-context final review. No commits, pushes or source changes outside this repository.

**Goal:** Bring the existing caregiver FE work-shift registration workflow into the React Native app.

**Architecture:** A work-shifts feature owns typed API boundaries, repository workflows and two stack screens. The Schedule tab and assigned availability screen link to a paginated open-shifts/my-registrations screen. Shift details handle optional notes, registration and confirmed cancellation. No new dependency or shared-core domain imports.

**Tech stack:** Existing Expo/React Native/TypeScript, shared API/UI/hooks, Jest/native testing library.

**Spec:** User request: “đưa đăng kí ca vào mobile”; authoritative ProviderService WorkShiftController, ShiftRegistrationServiceImpl and WorkShiftServiceImpl; ARCHITECTURE.md.

## Constraints and decisions

- Gateway /api/v1 only; no BE/FE modifications. Existing login/storage/security stays unchanged.
- GET /work-shifts uses server caregiver scope and OPEN, preserving server pagination. Optional date filters are omitted due to the live PostgreSQL bug documented in ARCHITECTURE.md; started/expired/full shifts carry availability guidance. GET /work-shifts/registrations/me is paginated.
- POST /work-shifts/{id}/registrations sends caregiverNote (max 2000), no actor/status/version fields.
- DELETE /work-shifts/registrations/{id} sends authoritative version as query. Only PENDING may cancel; APPROVED remains assigned availability.
- Scan all registration pages when checking whether a shift already has an active registration; an older terminal record must not hide an active record.
- Work date/time is UTC+07 even if device timezone differs. Check start/deadline/capacity for UI guidance; BE authorizes and decides every write.
- Profile must be ACTIVE/VERIFIED to register. Unknown write result or 409 locks writes until explicit fresh reconciliation. Do not retry writes automatically.
- Lock writes, retain failed note input, guard dirty navigation, confirm cancellation, support VI/EN and loading/empty/retry/denied states.
- Work in the existing checkout: the ongoing RN replacement is uncommitted and this app is being run from this directory; do not relocate or commit it.
- Standalone APK research from the earlier interrupted request has no applied code changes; this plan adds shift registration only.

## Review focus

- Exact UTC+07 start/deadline boundaries and capacity changes.
- Active registrations beyond the first page; duplicate prevention and terminal re-registration.
- Registration status/version changing during cancellation.
- Network uncertainty: no repeated POST/DELETE, retained form and guarded navigation.
- Historical registrations whose shift is no longer readable retain status and a clear unavailable state.

## Tasks

- [x] Write failing contract/time/repository tests, then implement typed models/repository.
- [x] Write failing native UI tests, implement list/details and VI/EN copy, wire navigation and dirty guards.
- [x] Document role flow and testing, run check/install-check/doctor/Android build, perform final review and address findings.

## Execution ledger

- Contract inspection complete. PENDING-only cancellation is narrower than cancelling approved availability; preserve this distinction.
- No API/database writes for demonstration data are needed for implementation verification.
- Contract tests: RED missing feature modules, GREEN 5 cases. Native full-App tests: RED missing registration entry, then revealed that icon glyphs polluted shared Button accessible names; set accessibilityLabel to the existing visible label (no copy/action change). GREEN 4 flows before adding concurrent-approval regression.
- Ruling: preserve unrecognized server status strings in badge fallbacks rather than synthesizing a status. All known registration states have feature-specific VI/EN labels so PENDING is not translated as a care-task state.
- Ruling: preserve inaccessible historical registrations and expose retry rather than dropping them when the related shift GET fails.
- Final fresh-context review identified unreadable-shift cancellation and a stale README exclusion. Fixed both: detail preserves own registration actions when the shift GET fails; if no own record exists, the original read error is retained. POST DTO parse failures now become uncertain write errors. RED→GREEN regressions cover both cases; the native UI suite also covers malformed responses and concurrent approval during cancellation.
- npm run check: formatter/lint/strict TypeScript and 39 tests across 6 suites pass. Expo dependency check is up to date; expo-doctor 20/20. npm run build:android: BUILD SUCCESSFUL in 9m33s, all configured ABIs, artifacts/careconnect-react-native-debug.apk.
- Native test limitation: actual emulator UI hierarchy was unavailable to the read-only probe; full-App Jest flows use native test mocks. No live registration writes or backend source changes, no commits/pushes/merges/releases.
- Follow-up live bug: authenticated gateway GET with fromDate reproduces 503/4004, also with toDate; status-only GET succeeds with 3 records, and own registrations GET succeeds with 3 records. Temporary probe session revoked. RED regression reproduces rejection of date filters; remove those filters without modifying BE and annotate non-registerable OPEN records on the client. BE remains the write authority.
- Follow-up fix verification: npm run check passes all 39 tests/6 suites, formatter/lint/strict TypeScript. Metro serves the updated feature bundle with HTTP 200 and no fromDate filter in the repository module. JS-only correction; no new native module/config changes or live registration writes.
