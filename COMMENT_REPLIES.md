# Comment conversations

All episode panels use the shared community.js implementation. Top-level comments
are paginated in groups of 20, newest first. Each conversation loads its replies
separately in groups of 20, oldest first. Use Responder on the original comment to
join its conversation; replies have one visual level to keep mobile layouts readable.

Owners can remove their own comments or replies after confirmation. This erases
the body and displays a removed-by-author marker, preserving other people's replies
and the rate limit history. Moderation cannot recover the erased text. Banned
accounts may retract their own text, but cannot publish comments or replies.

Database change: supabase/comment-replies-setup.sql, applied as
community_comment_replies. Parent validation requires a visible, undeleted root
in the same episode. Existing RLS, moderation and comment limits remain in force.
No general UPDATE/DELETE grant was added. The public removal function invokes a
private, owner-checked operation with a fixed search_path.

Validation: 22 Node tests; tests/replies-permissions.sql checks real database roles,
ownership, invalid parents, reply retention, rate limits, ban enforcement and anon
denial, and rolls back all fixtures. The reader test mock was updated for the
existing header-scroll asset loader; reader code and original images are unchanged.

Security advisors reported only existing notices: private tables deliberately
have no public policies, the existing staff-checked ban list wrapper is definer,
and leaked-password protection is disabled. References:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
