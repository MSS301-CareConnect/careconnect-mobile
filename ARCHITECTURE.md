# CareConnect Mobile architecture

Flutter Android/iOS app for active CAREGIVER accounts. Vietnamese is the default;
English is selectable. Material 3 uses the web's botanical brand colors.

## Runtime and boundaries

`app.dart` owns routes and the access guard. `core/` contains session/authenticated
HTTP, token storage, locale, theme, common widgets and foreground device actions.
`features/` owns typed domain models, API workflows and presentation. No backend
or web code is modified, imported or executed by the app.

All business data is read from the gateway `/api/v1/**`. `ApiClient` unwraps
`{code, result}`; `PageData<T>` handles `{items,page,size,totalPages,totalElements}`.
Dio has explicit timeouts and no logging interceptor. Repeated workflows such as
report draft lookup and visit actions have feature repositories; simple screen
requests use the same client directly. Riverpod supplies session-scoped services;
`DataView<T>` owns screen-local remote data and explicit refresh/error states.
No patient data is persisted. The router drops protected routes on sign-out and
the shell is keyed by session epoch. The HTTP client rejects late protected reads
from a prior epoch. Form controllers are disposed with their route.

## Authentication

The current BE `AuthenticationController` supports unified `/auth/login` and
`/auth/refresh` with `X-Client-Type: mobile`. Its `/auth/mobile/*` aliases are
deprecated (2026-10-19), despite the older Identity README. Implementation follows
the current controller and TokenTransport. `/users/me` is authoritative for
ACTIVE status and the CAREGIVER role. No cookie/CSRF transport is used by the app.

Only refresh tokens are stored in platform secure storage. Access tokens stay in
memory. A single in-flight refresh rotates tokens for concurrent 401s. Calls retry
once after authentication failure, but not after timeouts or uncertain writes.
Invalid refresh/role clears the session; temporary network/server failure keeps
the refresh token and offers retry. Writes to secure storage are serialized so a
late rotation cannot overwrite a logout. Logout attempts server revocation while
clearing local state, and reports when revocation could not be confirmed.

## Domain rules

- BookingOccurrence is the assigned visit; CareSession is the actual care session.
  Provider schedules are availability, not visit progress.
- Check-in is open from start minus 30 minutes to start plus 30 minutes; server
  checks authoritative time. Session task/notes are editable only while IN_PROGRESS.
- Reports are private drafts until SUBMITTED and become immutable after submission.
  Submission requires an ended session in BE. No condition is selected by default.
  Update sends version. The UI retains saved IDs across upload/submit failure.
- Provider work date/time is Asia/Ho_Chi_Minh, independent of device timezone;
  Booking Instant timestamps are displayed in the device timezone.
- Registration guards inspect all pages of own registrations; UI pages remain
  navigable. Server checks scope, overlap, capacity, deadline and duplicate writes.
- Notifications refresh on opening/resume and foreground count polling. No push
  background or continuous SSE connection. Navigation accepts only known reference
  types with UUID IDs, never arbitrary URLs from notification payloads.
- Location is optional, foreground only, no background permission. Uploads use
  native document picking. Remote file links require HTTPS.

## Platform and delivery

`API_BASE_URL` is a compile-time dart define pointing to the gateway origin without
`/api/v1`; Android emulator default is `http://10.0.2.2:8080`. Android debug permits
HTTP for local development; release disables cleartext. iOS uses HTTPS under ATS.
Release signing/store publication is not configured. Windows cannot build iOS.

Tests use a fake Dio transport to exercise real client/repository behavior and
widget flows; no test data is loaded by production screens. Reference source
paths and the approved scope are in `docs/superpowers/specs/`.
