-- Baseline schema (from schema.sql). Required for invitation token hashing and secure random bytes.
-- Supabase installs pgcrypto under the extensions schema.
create extension if not exists pgcrypto with schema extensions;
