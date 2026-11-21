-- The system path for deleting what is protected from deleting (data lifecycle, B9).
--
-- The append-only trigger of the event log holds for everyone including the owner, so no role can step
-- around it. The one exception is a transaction that carries a marker: anonymize_employee writes the
-- transaction id of its own transaction to lifecycle.purge_marker, the trigger lets a delete through only
-- when that row exists for the current transaction, and the function removes the marker before it returns.
-- A client cannot write the marker (schema without grants), a marker of another transaction does not match,
-- and nothing of it outlives the transaction. An update of an event stays forbidden always.
create schema lifecycle;
revoke all on schema lifecycle from public, anon, authenticated;

create table lifecycle.purge_marker (
  txid bigint primary key,
  set_at timestamptz not null default now()
);
revoke all on lifecycle.purge_marker from public, anon, authenticated;
comment on table lifecycle.purge_marker is
  'Transaction ids that may delete from append-only tables. Written and removed by anonymize_employee only.';

-- evaluation_events_append_only as in 20261122110100_evaluations.sql, with one change: a delete in a
-- transaction with a marker passes. Security definer: it reads the schema without grants.
create or replace function public.evaluation_events_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and exists (select 1 from lifecycle.purge_marker m where m.txid = txid_current()) then
    return old;
  end if;
  raise exception 'evaluation events are append-only';
end;
$$;
