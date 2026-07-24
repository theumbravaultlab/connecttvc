-- ============================================================
-- Connect TVC — lock down for a fully-private (login-only) app.
-- Run this AFTER schema.sql once you've switched to the gated,
-- password-auth setup. Removes the public finder view so nothing
-- is reachable without an authenticated leader session.
-- ============================================================

-- The app no longer uses a public view; drop it (also removes the anon grant).
drop view if exists public.public_groups;

-- Belt-and-suspenders: ensure anon has no table access. RLS policies already
-- require is_leader(), so anon selects return nothing, but revoke base grants too.
revoke all on public.groups        from anon;
revoke all on public.people        from anon;
revoke all on public.join_requests from anon;

-- Reminder: prevent self-signup in the dashboard —
--   Authentication -> Sign In / Providers -> Email -> turn OFF
--   "Allow new users to sign up". Create authorized users manually
--   (Authentication -> Users -> Add user, with a password + Auto Confirm).
