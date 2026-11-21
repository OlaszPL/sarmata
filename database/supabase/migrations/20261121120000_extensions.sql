-- BPMN scheduler (reminders, deadline recalculation) and background job queue (ADR 0002).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pgmq;
-- Fuzzy matching of a typed-in employee to an existing one (docs/funkcjonalnosci.md).
create extension if not exists pg_trgm with schema extensions;
-- Supabase Vault: encrypted secrets such as per-office SMTP passwords.
create extension if not exists supabase_vault with schema vault;
