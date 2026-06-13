-- =============================================================================
-- 0005_avatar_grant.sql — Spalten-Grant für Profilbild
--
-- 0002_rls.sql beschränkt UPDATE auf profiles bewusst auf display_name
-- (Schutz gegen Selbst-Setzen von is_admin/paid). Die neue Spalte avatar_url
-- muss ebenfalls vom User selbst gesetzt werden dürfen.
-- Die RLS-Policy profiles_update_own (id = auth.uid()) gilt weiterhin —
-- jeder ändert nur seine eigene Zeile.
-- =============================================================================

GRANT UPDATE (avatar_url) ON profiles TO authenticated;
