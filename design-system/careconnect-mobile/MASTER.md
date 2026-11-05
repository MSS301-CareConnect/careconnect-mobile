# CareConnect Mobile — Android design system

Product: authenticated Caregiver work application, React Native CLI0.88.1, Android only. The established brand and business contracts remain authoritative. This is an operational interface prioritizing the next care visit, requests requiring an answer and clear recovery after failed actions.

## Evidence and selected guidance

Applied ui-ux-pro-max on05/11/2026 after Python became available. Local `--design-system` queries `healthcare caregiver task mobile` and narrower `healthcare operations dashboard minimal` both returned a marketing hero/testimonials pattern, not a verified match for this authenticated work app; that generated system is not persisted or adopted. Native `--stack react-native accessibility` returned semantic-role, descriptive-label and TalkBack guidance. Focused `--domain ux error recovery form validation` returned explicit recovery paths and announced errors. Stack examples refer to0.86; implementations are checked against this repository's installed0.88 types.

## Tokens and layout

- Brand: primary `#087443`, pale `#E8F4EC`, background `#F8FAF8`, main text `#202D26`, muted `#5C6F62`.
- Semantic colors: success green/pale, pending amber, active/info blue, rejected/error red, cancelled/history neutral. State labels remain visible; color alone never conveys a state. Namespaced registration/work-shift labels preserve actual backend states.
- Contrast: primary/white5.85:1, primary/pale5.18:1, muted/white5.38:1. Decorative pale borders are not sufficient as the sole input boundary; controls use a stronger border.
- Android touch targets minimum48dp with8dp separation. Use4/8dp spacing rhythm,16sp body/24sp line height,13sp compact metadata. Preserve system text scaling; grow navigation height with font scale and bottom inset.
- Content gutters16dp on phone,24dp on wider screens; readable max width720dp. Round cards20dp, actions12–14dp. Keep elevation subtle and consistent.
- Feather is the established icon family. Decorative icons are hidden from accessibility; icon controls have labels and correct disabled/busy/selected states. No new icon/font dependency.

## Information and interaction

- Keep four labeled bottom tabs: Today, Assigned visits, Work schedule and Profile. Work schedule integrates Day agenda, Register and Time off; do not restore a separate Work shifts tab. Requests, retained deposits, certificates and signed-in devices remain secondary destinations.
- Work schedule: one compact three-way segmented bar; no separate Time off button by reload. Show week ranges as day/month without year. Visit summaries contain patient name, address, date/time and status with View details; availability summaries have only the domain label, date/time and status. Keep notes inside detail screens. Registration uses a compact three-step explanation, Open/Pending/Approved/History filters, server counts and a calendar illustration for genuine empty results. Preserve all form/uncertain-write locks when switching sections.
- Home: greeting/date → compact green photo banner → Today/Completed metrics → daily visit list. Remove the response-needed request card and separate focus card. Preserve View details text on visit cards. A confirmed empty day shows the sun icon, explanatory copy and Register/Upcoming actions; loading or failed reads must not appear as an empty day. Banner photography stays on the right and live bilingual text on the left.
- Banner images override bundled intrinsic dimensions with numeric width/height measured from the banner. The container has an explicit compact height (152–184dp normally, growing only for larger/wrapped text); image dimensions must never drive its height. Avoid percentage image heights inside auto-height/minHeight containers on Android.
- Cards: date/time first, actual status, supporting area/service/capacity/deadline, one emphasized next action. Keep text View details. Separate customer request decisions from assigned-visit acknowledgment.
- Forms: visible labels, persistent hints, inline errors with polite announcements, native keyboards and password-manager support. Keep text on failure. Destructive/submission actions require explicit confirmation; dirty dismissal requires confirmation.
- Sign-in: logo/name and VIE/ENG share the top row, language controls aligned right. The password eye control sits inside the input outline at the right edge with a48dp hit area.
- Profile: circular avatar/camera, actual verification and name/center, then a six-item completeness summary; personal information, About and assigned-service cards follow. Use17sp body/26sp line height,20sp section titles and24sp name, wrapping labels/values on narrow screens. Place Retained deposits immediately below assigned services, then Certificates/Security, separate logout and language controls at the very bottom. Security expands to password and signed-in-device actions. Avatar preview remains unsaved until the user confirms upload.
- Compact bottom navigation:76dp base height plus Android bottom inset, with additional height for larger system fonts. Keep all four destinations and48dp+ touch targets; preserve readable12sp labels rather than reducing type to save space.
- Apply16dp rounding and ripple clipping to the actual tab button, including its active pale-green background. Work schedule uses the existing Feather calendar outline with a native day grid: muted outline/dots when inactive, green fill with white dots when selected. Preserve the navigator's press/long-press handlers and selected accessibility state.
- Extend the outlined/inactive and filled-green/selected treatment to Home, Assigned visits and Profile using the existing Feather outline with native fill shapes. Keep icon bounds stable between states. Header and sign-in share BrandMark with the user's supplied hand-and-heart CareConnect logo; retain its proportions and clip screenshot margins in layout without changing the source image.
- Signed-in devices: one card with divided rows, device/browser and OS, actual IP and relative last-active time, current-device badge, individual sign-out on other rows and a confirmed sign-out-others action. Show five initially, expand to all with the actual count. Keep18sp device names and16sp metadata; do not display raw user-agent strings or technical device IDs as the title.
- Notifications: retain only the centered navigation title; no duplicate bell/logo hero. All/unread segments precede one compact continuous list with semantic circular icons, timestamps and checkboxes. Do not add date-group headings; keep the timestamp on each card and 8dp spacing between cards. Selection uses a pale green contextual toolbar with read/unread/delete and clear-selection actions. Select-all applies to the visible page; global mark-all-read remains separate. On small screens the toolbar wraps without shrinking touch targets. Secondary clear-read is under More actions; deleting still requires confirmation.
- Pending writes lock controls. Uncertain/conflicting writes require a successful explicit server reconciliation. A success message comes from a parsed server result, never a simulated transition.
- Motion follows the Android reduced-motion preference; use opacity feedback and avoid layout-shifting decoration. Headerless sign-in respects top safe area; content remains scrollable with the keyboard.

## Appearance and QA

The current supported palette is light. Do not imply system-dark support until all surfaces and semantic pairs have native QA. Readability and safe behavior take priority over adding a second unverified theme.

The user owns mobile visual testing and requested no further automatic checks. Suggested manual cases: small/large phones, portrait/landscape, Vietnamese/English, largest system text, keyboard-visible forms, system bars, TalkBack, reduced motion and loading/error/uncertainty states. No emulator launch or installation is part of this handoff.
