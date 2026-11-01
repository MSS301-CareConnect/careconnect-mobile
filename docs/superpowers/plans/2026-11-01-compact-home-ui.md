# Compact caregiver home UI

User direction: use the supplied healthcare reference, green palette and elderly-care photograph; keep the recently added **View details** text on visit cards. Reduce banner/stat height so visits appear early. Continue the Android-only React Native CLI implementation.

## Implementation

- Shared palette: primary `#087443`, pale `#E8F4EC`, background `#F8FAF8`, text `#202D26`.
- Add a small native heart/health mark and prominent app name to the header; retain the real notification unread count.
- Use the existing bundled care-at-home photograph, a native green gradient and a compact banner. Keep live greeting/date and actual server visit/completion totals, with icons on pale stat cards.
- Add a localized daily schedule heading and compact View all action navigating to Assigned visits. Preserve loading, empty, denied, retry and pagination behavior.
- Visit cards keep their actual names, times, status and address, with clock/address icons and a check icon only for COMPLETED. Keep the View details action and existing detail navigation.
- Round the five-tab bar and highlight the current tab without covering screen content. Preserve all caregiver routes and authorization.

## Verification

- Add meaningful home integration coverage for View all navigation, server totals/pagination and read/empty/retry states.
- Run formatting, ESLint, strict TypeScript, Jest, CLI config/doctor and Android debug build. Report tool/environment limitations accurately.
- No app installation or emulator launch: the user requested to run the Android app themselves. No BE/FE source edits, commits or publishing.

## Follow-up: work-shift cards

The user supplied a second reference for Work shifts: date and compact View details action share the header; large time and registration status follow; metadata uses small icons. Remove the bulky bottom View details button from My registrations and make registered cards navigable as a whole. Keep an explicit Register action for eligible unregistered shifts. Preserve historical unavailable-shift access, actual statuses, notes/rejection reasons, deadline/capacity guidance, polling, pagination and all registration/cancellation contracts.

## Verification ledger

- Home integration regressions observed RED for the missing section/link, then GREEN. Integrated formatter, ESLint (0 errors; existing warnings remain), strict TypeScript and all 80 tests/9 suites pass.
- Android x86_64 debug build succeeds. CLI config confirms Android package and no iOS target. Doctor reports the existing CLI JDK-range mismatch (installed JDK21; doctor supports17–20); the actual Gradle build succeeds with JDK21.
- Review found tab height/inset and active-background clipping issues. Tab height now reserves 72dp plus the bottom system inset; rounded tab wrappers clip the active background/ripple.
- Native visual inspection remains for the user's own Android run; no installation or emulator launch performed for this redesign.
- Work-shift follow-up has observed RED/GREEN interaction coverage; integrated checks pass 83 tests/9 suites. Android debug build and finite Metro Android bundle both succeed. Focused source review found no further material work-shift issues.
- Font-scaled header/tab heights now grow with Android font scale, while preserving bottom system insets and clipped rounded active highlights.

## Follow-up: cancel availability

The user requested the FE's Cancel availability slot action on Lịch rảnh. Verified CaregiverController, ScheduleStatusRequest, ScheduleResponse, ScheduleStatus and CaregiverScheduleServiceImpl as the authoritative contract. Add a reason/confirmation form and typed schedule version, using the gateway PATCH only. Match FE's non-past SCHEDULED action, using Vietnam time; BE rejects assigned bookings and owns secondary registration/work-shift changes. Keep failure text, lock pending/uncertain writes, require explicit fresh-read reconciliation and confirm closing a dirty form. Tests use fake transports; no live availability is cancelled during implementation.
