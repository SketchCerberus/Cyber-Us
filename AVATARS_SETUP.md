# Profile pictures and account navigation

Every page has a bilingual account entry in its header, including mobile. It points to `comunidade.html` (login/profile), which links to registration.

Signed-in members can choose a ready-made emoji avatar or upload a JPEG, PNG or WebP up to 5 MB. The browser shows the centered square crop and encodes a 256×256 JPEG before upload. The source file is not uploaded. Save picture persists the choice; Remove picture clears it and deletes the stored photo. Avatars appear beside episode comments and in the moderation list.

## Storage and permissions

Applied migration: `community_profile_avatars` in project `znenamrszhjsiztllcit`. SQL is recorded in `supabase/avatar-setup.sql`; do not reapply it to the configured project.

- `profiles.avatar` contains a preset identifier or an upload version. Arbitrary remote URLs are not accepted.
- Existing profile RLS permits only the owner to update; banned users cannot change their profile.
- Public bucket `community-avatars` accepts JPEG only, at most 262144 bytes per object. Public visibility is intentional for comment avatars and is stated next to the upload field.
- Storage writes require authentication, an unbanned account and the exact path `<auth.uid()>/avatar.jpg`. At most one object can be stored per account under these policies. Replacement uses upsert with SELECT/INSERT/UPDATE policies; removal uses the matching DELETE policy.
- Changing to a preset/removing the avatar also requests deletion of old uploads. Cleanup failures are displayed; use Remove picture again to retry. CDN/browser caches may retain an earlier photo briefly.
- Existing Supabase service is used; no paid plan or external service was provisioned. Normal project storage/traffic quotas still apply.

## Checks

`node --test tests/*.test.mjs`

Automated checks cover safe avatar URLs, format/size rejection, preset save, JPEG upload preparation, removal, banned users and failure ordering with mocked Storage/Auth. Profile RLS was additionally exercised inside a rolled-back database transaction: own update succeeds, other-account updates affect zero rows. Bucket constraints, four storage policies and column grants were inspected after migration. Mobile navigation and editor layout were checked at 390 px. No real user photo was uploaded during verification; manually verify upload/replace/remove from a normal browser while signed in.

Security Advisor returned only previously recorded notices: [private tables with no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [moderation SECURITY DEFINER wrapper](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No new avatar finding was returned. Moderation of inappropriate profile photos is not provided by the existing comment-moderation controls; bans prevent further profile edits.
