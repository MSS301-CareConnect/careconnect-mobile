# Report photo selection and recovery

Implement inline with TDD, followed by a scoped fresh-context review. User requests fixing photo attachment failures and removing the manual save-draft prerequisite. Only mobile source is editable; BE/FE remain read-only. No live report submissions for verification.

## Contract and design

BE POST /care-reports/{id}/photos requires an existing draft ID and multipart files. The editor will select up to five JPEG/PNG/WebP files (10 MB each) before saving. Selected URIs/metadata stay in component memory, copyToCacheDirectory:false; no persistent image cache. Local removal does not call BE. Save/Submit explicitly saves the draft, checkpoints its ID/version, uploads the selected batch, checkpoints confirmed attachments, then submits only after existing confirmation and ENDED checks. No automatic write retries. Existing report text and pending selections remain on failure.

An uncertain save must reconcile by session/booking and preserve local text. An uncertain upload must show server attachments after fresh read and require explicit review/removal of the uncertain local batch before another upload, because BE has no upload idempotency key or per-file correlation. Submitted reports stay read-only. All copy is VI/EN. The two report text fields and explicit condition remain unchanged.

## Work

- [x] RED: six new native UI tests fail because photos cannot be staged. GREEN: eight report UI tests pass, including selection before draft, no request until Save, local removal/cancel/limits, save/upload/submit order, uncertain save reconciliation and upload review without duplicates.
- [x] GREEN: typed pending photos and repository workflow/checkpoints; safe form/picker state and localized recovery. Successful but malformed report write responses require reconciliation.
- [x] Check/lint/type/tests, Android build and scoped review; document verification limits. User subsequently replaced Expo with Android-only RN CLI, so final verification uses native CLI configuration/doctor rather than retired Expo commands. Final76-test Android suite and native x86_64 build pass; doctor retains a documented JDK-range warning/error despite the successful JDK21 build.

## Diagnostics

Live selected bookings have saved reports and zero attached media. Recent Media Service logs show no attempted upload errors. Booking logs show HTTP response/write-disconnect exception classes, with no SQLState failure. The screenshot is an uncertain write state; it does not prove Media Service rejected an image. No report content or credentials are logged.

Live multipart PNG probe through gateway on an owned existing DRAFT: HTTP 200/code200 in 6.9s. The probe attachment was removed through report DELETE and verified absent; no report was submitted. Probe sessions revoked. Media metadata GET is SERVICE-only, so cleanup identified the probe via a read-only filename/reference lookup and used the caregiver-authorized report removal endpoint. Booking's No-converter log entries have text/event-stream content type and cannot establish the cause of a report-save network failure. Fresh-context scoped review found no actionable regressions. Native device picker/upload interaction remains distinct from controlled native-component tests and the live HTTP probe.
