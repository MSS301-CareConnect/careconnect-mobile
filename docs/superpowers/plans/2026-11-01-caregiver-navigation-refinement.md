# Caregiver mobile navigation and work-shift board refinement

> Implement inline using executing-plans and TDD; perform one fresh-context final review. Work in the existing checkout, no commits or BE/FE edits.

**Goal:** Address the user's report that a newly created FE shift is hidden on mobile and primary feature navigation looks like calendar filters.

**Spec:** User screenshots of FE caregiver navigation/work-shift board and mobile's crowded calendar buttons; user requests FE-based UI/flow correction. See ARCHITECTURE.md and AGENTS.md.

**Architecture:** Keep Today and promote FE domain destinations to five bottom tabs: Today, Assigned visits, Work shifts, Availability, Profile. Preserve completed visit history within Assigned visits. Preserve root stack routes for details and existing links. Feature navigation is removed from visit filter rows. Visit filters open in a focused modal, with draft values applied together.

Work shifts mirror FE: a compact upcoming-open section and My registrations section on the same screen. Cards lead with Vietnam date/time, approved capacity, deadline, note preview, and explicit Register / View registration action. Refresh is a small labelled icon, not a full-width navigation/filter button. Open board loads all scoped OPEN pages without the known-broken optional date query, filters started shifts locally and computes accurate local pagination. All own registration pages determine active registrations, never just the first page. Existing POST/detail/cancel guards remain authoritative. No patient cache, write retries, fabricated results or clinical defaults.

**Evidence:** Authenticated gateway probe returns the FE center, ACTIVE/VERIFIED profile, and three OPEN rows. The 03/11/2026 13:00–17:04 row has capacity 1, approvedCount 0, no own active registration. The older 01/11 row is already past and displayed first by the old mobile list. Probe session revoked.

## Tasks

- [x] Add failing repository/native UI regressions for a new future shift after past OPEN pages, active registration on later pages, direct bottom navigation and clear register action.
- [x] Implement typed board workflow, compact board, dedicated primary tabs, availability entry and focused visit filters. Preserve history, cancellation, form guards, VI/EN and UTC+07 semantics.
- [ ] Update docs, run check/dependency/doctor/Android checks, inspect actual UI where available, final review and fix material findings.

## Review focus

- Filtering must not hide future shifts behind old server pages or fake totals.
- A registered/full shift must not present a false Register action; detail/BE recheck at submission.
- Modal filter drafts must not alter requests until Apply, and Reset restores the expected default.
- Primary tab wrappers must retain navigation/auth guards, history and logout cleanup.
- Failed reads/writes retain errors and retry/uncertainty behavior; historical pending cancellation remains available.

## Ledger

- Design selected from existing FE categories and explicit user feedback; preserve Today and move History into Assigned visits to keep all previous caregiver functions.
- RED board regression: board workflow absent; GREEN scans past OPEN pages and all registration pages, preserving new target shift and existing active registration. RED UI regression: dedicated main navigation absent; GREEN full-App tests cover separate tabs, visible future shift/Register CTA, no primary navigation in filters, filter draft isolation and retained unbounded completed history.
- npm run check: formatter/lint/strict TypeScript and 42 tests/6 suites pass. Expo dependencies up to date; expo-doctor20/20. Fresh-context review reports no actionable findings; native Android build running.
- Actual LDPlayer UI inspected with computer-use: five main tabs visible, upcoming board has two shifts, target 03/11 13:00–17:04 and primary Register button visible without scrolling, older registered shift has distinct Registered status. Opened the target form for read-only inspection; no registration/cancellation writes were submitted. Existing installed APK uses another debug signature, so do not uninstall it or claim this chat installed the generated APK; Metro delivers updated JS.
