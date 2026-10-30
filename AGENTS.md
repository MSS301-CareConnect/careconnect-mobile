# CareConnect Mobile conventions

Read `ARCHITECTURE.md` before changing data flow. This repo is a Flutter app for
the CAREGIVER role. Reference BE and FE-careconnect read-only; change only this repo.

- Backend controllers/DTOs/services are the authoritative contract. Verify code
  when README or frontend snapshots differ; record deviations in architecture/docs.
- Only use the gateway `/api/v1/**`. Use unified `/auth/login`, `/auth/refresh`
  with `X-Client-Type: mobile`, bearer access and body refresh tokens.
- Refresh tokens belong in secure storage, access tokens in memory. No token,
  password or patient-data logs; no persistent patient cache. Clear all session UI
  on logout. No retries of writes after uncertain network failures.
- Keep models typed and parse JSON at API/model boundaries. Domain actions live
  in their feature; shared core must not import features. Repositories should own
  repeated API workflows; do not add abstractions without a consumer.
- Use `context.t(key)` for user-facing copy and add Vietnamese/English together.
  API-provided domain text is displayed as returned. Never invent clinical defaults.
- Preserve backend states, scope and optimistic `version`; backend is the final
  authorization and business-rule authority. Do not simulate successful writes.
- Work shifts are local Vietnamese time (UTC+07); Booking timestamps are Instants.
- Show loading, empty, retry and denied states. Lock pending writes, retain form
  content on failure, confirm irreversible report submission and leaving dirty forms.
- Files: avatar 5 MB; certificate 10 MB PDF/JPEG/PNG; report images 10 MB JPEG/PNG/WebP,
  at most five report photos. Server validates content and ownership.
- Run `dart format --output=none --set-exit-if-changed lib test`, `flutter analyze`,
  `flutter test` and an Android debug build for a complete feature. Add tests for
  meaningful behavior/contracts; do not suppress lints or weaken checks to pass.
- Keep `pubspec.lock` committed with app source; no secrets, generated build output,
  local SDK paths or signing keys. No pushes/merges/releases without user request.
