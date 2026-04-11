-- =============================================================================
-- Target DB: remove migration_staging after a successful apply (optional)
-- =============================================================================

drop schema if exists migration_staging cascade;
