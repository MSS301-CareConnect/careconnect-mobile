# React Native Caregiver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. No commits unless the user requests them.

**Goal:** Replace Flutter with Expo React Native, TypeScript and real caregiver gateway APIs.
**Architecture:** Typed boundary parsers, authenticated client and session-scoped memory state; feature repositories and native stack/tab screens. Expo owns reproducible native generation.
**Tech Stack:** Expo stable and its compatible React Native/React, SecureStore, React Navigation, document/location modules, Jest.
**Spec:** docs/superpowers/specs/2026-11-01-react-native-caregiver-design.md

## Global Constraints
- Only careconnect-mobile changes; BE/FE read-only, gateway /api/v1 only.
- Refresh token secure storage, access token memory; no patient persistence/logging.
- Backend states/version/scope, no uncertain-write retries or simulated success.
- Vietnamese/English, no clinical defaults. Provider UTC+07, Booking Instants.
- Release HTTPS, local HTTP debug only. No commits/push/merge/release requested.
- User reiterated replacement: implement in this existing dev checkout without another approval round; back up all old source before deleting.

## Review Focus
1. Logout during refresh/read must not repopulate the previous session.
2. Write timeout retains forms and requires reconciliation before repeating.
3. A report matching the session can be beyond page one; submitted reports are immutable.
4. Background/resume must not replay old notifications or apply stale responses.
5. Small screens, large text and keyboard retain accessible actions.

### Task 1: Runtime, session and shared UI
**Files:** package/config, src/core/{api,auth,json,l10n,ui,hooks,time}, tests/core.
**Interfaces:** ApiClient.request(method,path,body?,query?) returns Promise<unknown>; useApp() supplies api/user/t/locale/setLocale/logout. useRemote(loader,deps) supplies data/error/loading/reload. Shared Screen/Card/Button/Field/RemoteState. Stack routes Visit{id}, Session{id}, Report{bookingId,sessionId}, Notifications, Account, ProviderSchedule.
- [x] Back up source and uncommitted files locally, remove Flutter, scaffold and lock Expo.
- [x] Write/run failing tests for mobile token transport, role guard, concurrent refresh, logout race, transient restore, no write retries, Vietnam dates.
- [x] Implement strict API/auth, translations, theme, native shared controls, session reset and dirty-form protection; run tests/typecheck.

### Task 2: Visits, active care and reports
**Files:** src/features/{visits,sessions,reports}, tests/care.test.ts, workflow UI tests.
**Produces:** HomeScreen, VisitsScreen, HistoryScreen, VisitScreen, SessionScreen, ReportScreen.
- [x] Write/run failing tests for filters/pagination/totals, returned session ID, skipped reason, report pagination/version/uncertain-write reconciliation.
- [x] Implement parsers/repositories against BE DTOs; snapshots only as returned.
- [x] Implement lists/detail, checklist/custom task, notes/vitals, confirmed end, report draft/photos/confirmed submit and submitted read-only; preserve dirty forms.
- [x] Run meaningful contract/UI tests and typecheck.

### Task 3: Profile, notifications and navigation
**Files:** src/features/{profile,notifications,auth}, App.tsx, navigation.tsx, tests.
- [x] Write/run failing notification seed/dedup/resume/logout/valid-reference and auth guard tests.
- [x] Implement profile/account/password, Provider schedule, login/restore/forgot password, inbox/badge/banner and foreground polling every 30 seconds.
- [x] Integrate four tabs/stacks, safe areas, keyboard, bilingual loading/empty/denied/retry states and pending-write locks.
- [x] Run all tests and inspect actual Android UI.

### Task 4: Native build, review and handoff
**Files:** app.config.ts, plugins/, scripts/, CI, README, ARCHITECTURE, AGENTS, docs/LDPLAYER.md.
- [x] Configure native modules, same app ID, debug-only HTTP and reproducible native generation. Replace Flutter scripts/CI/docs; mark previous docs historical.
- [x] Run formatter, lint, TypeScript, tests, Expo compatibility checks and Android debug build; fix failures without suppressions.
- [x] Fresh whole-change review; important fixes get regression tests and affected checks rerun.
- [x] Record APK/native QA and unavailable live-BE/iOS validation; leave changes uncommitted.
