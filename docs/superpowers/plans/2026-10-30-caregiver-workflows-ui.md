> HISTORICAL — Flutter implementation retired on 01/11/2026. Active design: 2026-11-01-react-native-caregiver-design.md.

# Caregiver Workflows and UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the approved five-tab caregiver experience with live home/history data and foreground notifications.

**Architecture:** Keep typed feature repositories and authenticated ApiClient. Move the application shell out of core so it can consume the notifications feature without reversing dependencies. Reuse visit cards and server pagination across home, schedule and history.

**Tech Stack:** Existing Flutter 3.44.1, Dart 3.12.1, Riverpod, Dio and go_router; no new packages.

**Spec:** `docs/superpowers/specs/2026-10-30-caregiver-workflows-ui-design.md`.

## Global Constraints

- Only careconnect-mobile changes; BE/FE read-only. Work on the user's dev branch; no commit/push requested.
- Five tabs: Hôm nay, Lịch làm, Ca mở, Lịch sử, Hồ sơ.
- API gateway `/api/v1/**`, typed models, refresh secure storage/access memory; no persistent patient data or sensitive logging.
- `context.t` for all new copy, Vietnamese/English together; preserve backend states and optimistic version.
- VN UTC+07 calendar date queries, Booking Instants displayed in device timezone.
- Foreground polling 30 seconds, baseline without replay, pause/logout invalidate pending results; no native push claim.
- Keep loading/empty/retry/denied states and lock writes; no automatic uncertain-write retries.
- No new emulator data; use existing LDPlayer when available.

## Review Focus

1. Crossing midnight UTC/Vietnam: date queries and labels agree (Task 1).
2. More records than one page: totals come from BE, history is unbounded and paginated (Tasks 1–2).
3. Notifications finishing after pause/logout: no old-session UI/banners (Task 4).
4. Check-in returns a session unlike the occurrence ID: navigate using server sessionId, never retry write (Task 3).
5. Narrow display and text scale 1.5: all five destinations and availability remain accessible (Task 2).

### Task 1: Typed visit workflows

**Files:** Modify `lib/features/visits/repository.dart`, `lib/features/sessions/models.dart`; create `lib/features/visits/schedule.dart`; test `test/features/visit_workflows_test.dart`.

**Interfaces:** Produce `vietnamDay(DateTime) -> DateTime`, `VisitRepository.today(DateTime, {int page}) -> Future<TodayVisits>`, `history({int page}) -> Future<PageData<Visit>>`, `checkIn(String, Json) -> Future<CareSession>`, `CareSession.doneTasks -> int`.

- [x] Write tests for UTC+07 midnight, server totals larger than page length, completed history page 2 without dates, typed check-in response, DONE distinct from SKIPPED.
- [x] Run targeted Flutter test and observe expected failures.
- [x] Implement the interfaces; TodayVisits owns typed page plus completed total; parallel independent GETs with Future.wait.
- [x] Run targeted tests; expect all pass.

### Task 2: Five-tab UI

**Files:** Create `lib/shell.dart`, `lib/features/home/home_page.dart`, `lib/features/visits/visit_card.dart`; modify `lib/app.dart`, `lib/features/visits/visits_page.dart`, `lib/core/theme.dart`, `lib/core/l10n.dart`, profile/work_shifts pages, `pubspec.yaml`; copy brand hero into `assets/images`.

**Interfaces:** Consume Task 1; `VisitsPage({bool history = false, bool upcoming = false})`; routes `/home`, `/visits`, `/history`, `/work-shifts`, `/profile`, preserve `/availability` as a standalone guarded screen.

- [x] Update navigation test for home, five destinations, history completed query and availability entry; add schedule widget tests for upcoming and old completed history.
- [x] Run tests; observe missing home/history/destinations.
- [x] Implement home with exact BE totals, real account name, image hero, today cards/pager, upcoming shortcut. Reuse VisitCard; schedule day modes and history filters preserve server pagination. Move shell out of core and update callers.
- [x] Apply prototype typography, green/pale surfaces, brand header and consistent profile/open-shift headers. Preserve every existing action.
- [x] Run navigation/schedule tests including 320×480 at text scale 1.5; expect no layout exceptions.

### Task 3: Care-session flow

**Files:** Modify `lib/features/visits/visit_detail_page.dart`, `lib/features/sessions/session_page.dart`, report copy; test `test/features/care_flow_widget_test.dart`.

**Interfaces:** Consume typed checkIn and doneTasks from Task 1; preserve existing report routes and status guards.

- [x] Write navigation test for returned check-in session, completed checkout/report entry and read-only checklist progress.
- [x] Run test and observe missing navigation/progress behavior.
- [x] Implement clear detail header/services/notes panels, enter server session on check-in, show DONE progress, checkout time and report guidance after completion. Keep confirmation and locks.
- [x] Run tests; expect correct API calls and no fake completion.

### Task 4: Foreground notification updates

**Files:** Create `lib/features/notifications/notification_feed.dart`; modify `lib/shell.dart`, `lib/features/notifications/notifications_page.dart`; test `test/features/notification_feed_test.dart`.

**Interfaces:** `NotificationFeed(ApiClient)` ChangeNotifier with unread, latest/new notification, refresh(), setActive(bool), dispose(); shell owns its lifetime and presents generic localized in-app banner linking to notifications.

- [x] Write tests for baseline, new IDs, no duplicates, failed reads, overlapping refresh, pause/logout while pending and resume.
- [x] Run test; observe missing feed.
- [x] Implement 30-second foreground polling, latest-page baseline, bounded in-memory IDs, epoch/activity guard and cleanup. Shell observes auth and feed; no payload persistence/logging. Notification screen auto-refreshes foreground on timer/resume.
- [x] Run feed/widget tests; expect no stale or repeated banners.

### Task 5: Verification and documentation

**Files:** README, ARCHITECTURE, this plan and progress record.

- [x] Run formatter check, analyze, full tests and Android debug build.
- [x] Review whole change with fresh reviewer per executing-plans; address material findings with regression tests.
- [x] Check native startup on available LDPlayer; preserve the existing session. Login/protected flows use test fixtures when gateway/test account is unavailable.
- [x] Document implemented coverage, notification limits and exact verification results. No commit/push.
