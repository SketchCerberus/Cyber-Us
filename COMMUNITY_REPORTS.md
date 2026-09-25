# Community reports

All six episode pages (including replies), fanart comments, gallery cards and expanded artwork share `fanarts-reports.js`. Public target IDs are the only IDs passed by the form. Forms support Portuguese/English, explicit labels, keyboard focus/escape, cancellation, status announcements and small screens.

## Database and compatibility

Migration `20260925012948_community_reports.sql` was applied to Cyber-Us Community. The filename matches the version returned by Supabase's migration history. It adds a private RLS-protected ledger and invoker API wrappers around narrowly authorized private functions. It does not change comment editing, submission approval, authentication settings or upload storage policies.

- Verified, non-anonymous, non-banned accounts can report another person's public content.
- Guests, owners, hidden/deleted targets and pending artwork are rejected on the server.
- A unique target/account key prevents duplicates, including after resolution or content deletion. A transaction advisory lock enforces 20 reports in a rolling 24-hour window across all three target types and the legacy endpoint.
- Existing fanart reports are backfilled; legacy inserts and dismissals mirror into the ledger. New resolutions synchronize the legacy queue. Cached clients remain usable.
- The staff queue returns no reporter, author-account or moderator-account IDs. Staff hierarchy applies on reads and writes; only the creator handles reports targeting staff.
- Evidence is a snapshot at submission time. Decisions require a reason, are terminal and stamp actor/time on the server. Evidence and decisions survive content deletion; the ledger has no cascading content/user foreign keys. Reporter UUIDs are retained only in the private ledger for deduplication/audit.
- Artwork moderation requires a private Storage backup before removing its gallery row. It uses the existing two-month trash retention and daily public-file cleanup retry. It never auto-approves or exposes pending artwork. A failed/uncertain request retains its private backup for safe retry.

## Verification

`tests/community-reports-permissions.sql` runs against Supabase inside a transaction and rolls everything back. It creates its own temporary accounts/content and verifies guests, owners, regular users, unverified/anonymous/banned accounts, moderators and the creator; duplicate and global quota enforcement through both endpoints; private queue and identity protection; staff restrictions; required decisions; audit; safe artwork removal and evidence retention. It passed on the connected project. No test accounts, reports or Storage metadata remain committed.

`tests/community-reports.browser.mjs` uses Playwright with mocked network responses and real DOM/browser execution for PT/EN, keyboard focus, escape, all target types, duplicate/rate-limit feedback, artwork switching, staff actions, private-backup failure, sign-out clearing, XSS-safe evidence and widths 320/375/1280. This is UI verification; real authorization is exercised separately by the SQL test. Run with `node --test tests/community-reports.browser.mjs` after installing pinned Playwright 1.62.1 and Chromium. `PLAYWRIGHT_MODULE` and `BROWSER_CHANNEL` can select an existing local installation.

The new Community reports checks workflow runs syntax checks, contract/reply tests and browser tests. Existing Fanarts checks also runs. A full baseline run of main (7f8dace) had five failures from stale test assumptions: reader mock, three old tag-search tests, and reply mock missing the language helper. The reply mock was updated here; the four unrelated baseline failures remain. Focused suites for this change pass.

## Existing advisor findings

The pre-change database already reports public SECURITY DEFINER functions, pg_net in public, and disabled leaked-password protection. This change uses private definers/public invoker wrappers. Private RLS tables intentionally have no client policies or table grants: access is only through validated functions.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private tables without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [existing public extension](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [existing password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
