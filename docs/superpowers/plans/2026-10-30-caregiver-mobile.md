# CareConnect Caregiver Mobile Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, task by task. User approved the design and instructed implementation on 2026-10-30.

**Goal:** Deliver a Flutter Android/iOS caregiver application connected to the existing CareConnect gateway.

**Architecture:** Typed feature API models and repositories over one session-aware HTTP client. Riverpod owns session state; go_router guards access. Native integrations remain behind explicit user actions.

**Tech Stack:** Flutter 3.44.1 / Dart 3.12.1, Dio, Riverpod, go_router, secure storage, geolocator, image/file pickers, url_launcher, Flutter localizations.

**Spec:** `docs/superpowers/specs/2026-10-30-caregiver-mobile-design.md`

## Global Constraints

- Change only files inside careconnect-mobile; read BE/FE as contract references.
- Flutter Android/iOS; Vietnamese default and English available.
- Gateway `/api/v1/**`, mobile bearer auth; refresh token in OS secure storage.
- No medical defaults, fake success, background location, or automatic mutation retries on network failure.
- Colors: primary #075B31, background #F7F8F5, text #1B2922.
- Only caregiver role. No customer/manager/admin workflows or server changes.

## Review Focus

- Concurrent 401s must share a refresh, persist rotated refresh token, retry once and clear invalid sessions.
- Slow old requests must not repopulate data after logout/account change.
- Pagination must not hide registrations/reports and allow duplicate writes.
- Task/report mutations must preserve version and server state after partial failure.
- Device clock, UTC conversion, denied location permission, small screens and large text must leave controls usable.

## File map and interfaces

- `lib/core/api_client.dart`: `ApiClient.request(method, path, {data, query}) -> Future<Object?>`, unwrap result and typed failures; token refresh single-flight.
- `lib/core/auth.dart`: `AuthController` with `restore`, `login`, `logout`; `AuthUser`, `TokenStore`; provider dependencies and cache/session lifecycle.
- `lib/core/l10n.dart`, `theme.dart`, `widgets.dart`: translated copy, brand theme, asynchronous views, guarded actions and form helpers.
- `lib/app.dart`, `main.dart`: provider scope, router, lifecycle, four-tab shell, locale.
- `lib/features/visits/models.dart`, `repository.dart`, `visits_page.dart`, `visit_detail_page.dart`: assigned visits, snapshot, acknowledgment/check-in/no-show.
- `lib/features/sessions/session_page.dart`, `models.dart`: checklist, notes, vitals, check-out.
- `lib/features/reports/report_page.dart`, `models.dart`: session report, drafts, submit, photo attachment.
- `lib/features/availability/availability_page.dart`: schedules, status and time off.
- `lib/features/work_shifts/work_shifts_page.dart`: shift discovery, paged registrations, cancellation.
- `lib/features/profile/profile_page.dart`, `account_page.dart`: professional profile, certificates/media, account/password.
- `lib/features/notifications/notifications_page.dart`: list/read/count and safe target routing.
- `test/core/*`, `test/features/*`, `test/widget_test.dart`: behavior and boundary tests.
- `android/`, `ios/`, `pubspec.yaml`, `l10n/`, README and CI: platform setup and reproducible verification.

### Task 1: Bootstrap, secure session and app shell

Consumes: BE Identity mobile auth DTO/controllers. Produces: `ApiClient`, `AuthController`, localized shell and login/recovery pages.

- [x] Scaffold Android/iOS Flutter app, configure dependencies and localization.
- [x] Write tests for envelope parsing, one-refresh concurrency, refresh failure, network failure preservation, wrong-role login, and login form validation.
- [x] Run tests to see missing behavior fail; implement real client/session against a fake HTTP transport in tests.
- [x] Create router guard, login/recovery, theme, locale switch and four-tab navigation.
- [x] Run focused tests, formatter and analyze. Record evidence in progress ledger.

### Task 2: Assigned visits and active sessions

Consumes: `ApiClient`, auth session. Produces: typed `Visit`, `CareSession`, paginated visit list and detail/session UI.

- [x] Read BE DTO and rules for occurrences/session/task/note before implementation.
- [x] Write failing tests for timestamp conversion, check-in opening/closing, masked contact and task skip validation.
- [x] Implement visit filters/date picker/pagination, detail snapshot and allowed actions; obtain optional coordinates with timeout.
- [x] Implement session checklist, notes/vitals and check-out, refreshing authoritative data after each mutation.
- [x] Run focused and whole tests; verify loading/empty/error states.

### Task 3: Care reports and files

Consumes: session/booking IDs from Task 2 and `ApiClient`. Produces: draft/submit report screen, image upload.

- [x] Write failing tests for report selection across paged data, payload fields/version, no default condition and submitted lock.
- [x] Implement report editor with all BE fields, save draft, explicit submit confirmation and photo add/remove.
- [x] Preserve created report ID after failed upload/submit; retry without creating duplicate report.
- [x] Run report tests and suite.

### Task 4: Availability, work shifts, profile and notifications

Consumes: session-scoped client, typed paging and profile center identity. Produces: remaining functional tabs and account/notification routes.

- [x] Read Provider/Identity/Notification DTOs and permission rules.
- [x] Write failing tests for registration active/closed logic, versioned cancellation and no duplicate active registration across pages; report/notification route safety.
- [x] Implement paged availability and registrations, interval time off, open shift registration/cancellation.
- [x] Implement professional profile, media/certificates, account update/change password and notification list/read/count.
- [x] Run focused tests, all tests and analyze.

### Task 5: Verification, review and handoff

Consumes: all features. Produces: runnable app, platform configuration, README, CI and verified build where available.

- [x] Verify Android permissions/debug-only cleartext and iOS usage descriptions.
- [x] Run formatter, `flutter analyze`, `flutter test`, Android debug build.
- [x] Exercise app with emulator when available; otherwise document device verification limitation.
- [x] Request one independent whole-change review; fix material findings and rerun affected checks.
- [x] Update README with exact gateway setup, commands, tested results, remaining integration/device limitations.
- [x] Keep work uncommitted for user review unless a commit is requested; no push/merge/publication.
