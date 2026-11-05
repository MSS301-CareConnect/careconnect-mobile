# Caregiver mobile alignment — 05/11/2026

Reference snapshots (read-only): BE `eec3231`, FE `c13daaf`; mobile baseline `9c33fcf`. Controllers, DTOs and services define the API contract. FE supplies caregiver interaction patterns; its validation or pagination shortcuts are not copied when they differ from BE.

## Scope and contract evidence

| Caregiver capability | Authoritative source | Mobile change |
| --- | --- | --- |
| Answer customer booking requests before payment | BookingService BookingController:76,197,205; CaregiverBookingRequestResponse:25; BookingServiceImpl:629,816,1387 | Typed paginated request inbox; accept without body/version; decline with required reason ≤1000; preserve privacy and actual response states. Accepted means waiting for customer payment. Deadline/conflict5116 requires refresh and may mean center handover. |
| View retained deposits | PaymentService DepositForfeitureController:28,36,50; DepositForfeitureServiceImpl:64; DepositForfeitureRepository:39 | Read-only list/summary with Vietnam-calendar ranges converted to Instants. Use caregiverAmount from summary; ledger is retained deposits, not salary or payout balance. |
| Report customer absence | BookingOccurrenceController:71; BookingOccurrenceServiceImpl:205; CaregiverOccurrenceResponse:64 | Explicit reason10–1000 and actual check-in window. Pending report waits for center decision; caregiver cannot decide outcomes. |
| Assigned visit actions | BookingOccurrenceServiceImpl:188; CareSessionServiceImpl:242 | Acknowledge only before start; show next permitted action and configured window; explain unpaid5242/reassignment5234 without simulating progress. |
| Work-shift lifecycle and registrations | ProviderService WorkShiftStates:19; ShiftRegistrationResponse:30; WorkShiftRepository:33; ShiftRegistrationServiceImpl:78,270 | Retain embedded history/cancellation/linked-schedule metadata; server-backed filters and effective statuses. Pending cancellation uses registration DELETE/version; approved withdrawal uses schedule PATCH/scheduleVersion. |
| Availability and time off | CaregiverController:88; CaregiverScheduleServiceImpl:124; CaregiverServiceImpl:378,603 | Keep typed versioned cancellation, add time-off create/list/confirmed delete and phone-friendly calendar/agenda. Time-off interval is exclusive at end, ≤30 days, reason≤500; no manager overlap override. |
| Notification management | BookingService NotificationController:34–102; NotificationResponse:24; NotificationServiceImpl:228 | Unread filter, read/unread, selected actions, delete and clear-read confirmation. Use resolved occurrence/booking links without forbidden booking-detail reads. No SERVICE-only notification creation. |
| Self-service profile and credentials | Identity UserServiceImpl:162,559; StrongPasswordValidator:12; Provider CertificateServiceImpl:51; ProviderMediaServiceImpl:197 | Successful password change clears session and returns to sign-in. Respect strong password/72-byte limit. Professional fields remain center-managed; own account/media/certificate actions use actual ownership and versions. |

## Deliberate FE deviations

- Request cards use permitted area/age/gender/services only; they do not fetch hidden patient names, full profiles or street addresses.
- Requests and ledgers paginate correctly; no first50/100-row or arbitrary five-page caps.
- Phone remains numeric10–11 digits; certificate expiry may equal issue date; shift note remains BE2000-character limit.
- No automatic retry of uncertain writes, including avatar deletion, certificate uploads, request decisions or notification writes.
- Retire the historical work-shift optional-date503 workaround based on the typed nullable predicates in current BE; runtime server remains authoritative.
- Report/session contracts remain aligned. Keep explicit overall-condition selection, existing notes and report/photo uncertainty safeguards.

## UI direction and implementation sequence

Keep the established green brand and five bottom tabs. Prioritize the next care visit and work requiring an answer. Add booking requests and retained-deposit destinations through Home/Profile/assigned visits, and use clear customer-request versus center-assignment labels. Use48dp Android controls,8dp spacing rhythm,16sp body text, semantic status tones, consistent field feedback and scalable layouts. Preserve View details text actions.

1. Add typed models/repositories and meaningful boundary/transition regressions for the verified gaps.
2. Implement isolated booking, work/availability and notification flows; maintain bilingual copy in core localization fragments.
3. Improve shared controls, Home/navigation, profile/account and professional read-only presentation using ui-ux-pro-max. Python is available; focused search guidance is recorded in design-system/careconnect-mobile/MASTER.md.
4. Integrate routes, calendar/request/notification destinations and docs. Review role boundaries and uncertain-write recovery.
5. Run formatter/lint/strict TypeScript/Jest, native CLI config/doctor and Android build. Verify native layouts where the available Android environment permits; distinguish fixture checks, source review and actual device QA.

Only this repository changes. No real booking acceptance, cancellation, report submission, profile writes, commits, pushes or releases are part of implementation verification.

## Implementation handoff

Caregiver booking requests, retained deposits, no-show reporting, effective work-shift filters/history, approved withdrawal, time off/day agenda, notification management, profile media/certificates and account sessions are integrated. Existing report rules and explicit View details actions remain intact. Cross-review fixes preserve decline input during reconciliation, clamp notification pages after filtered totals shrink and inset the foreground banner safely.

Before the user's testing preference update, the integrated code checks passed219 tests/27 suites and Android all-architecture debug build succeeded. Doctor reports the existing JDK-range mismatch and no connected emulator/Metro; no live business writes were made. These results do not represent visual testing on a device.

User instruction now assigns mobile visual testing to the user and requests no further automatic checks. No further tests or emulator work are required for the sign-in refinement: eye control inside the password outline at the right edge; VIE/ENG on the logo/name row aligned right. Manual function entry points are in docs/TEST_CAREGIVER_2026-11-05.md.
