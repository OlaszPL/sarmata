-- Retention for the streaming columns of 20261122235000_ai_runs_progress.sql. A finished run has them
-- nulled already. A run stuck in `running` keeps raw model text until its content is deleted, so the
-- moment content_deleted_at is set (anonymization of the employee, the retention steps) the partial
-- columns go too. A trigger covers every path that deletes content, with no copy of the purge functions.
create function public.ai_runs_clear_partial_with_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content_deleted_at is not null and old.content_deleted_at is null then
    new.partial_text := null;
    new.partial_output := null;
  end if;
  return new;
end;
$$;

create trigger ai_runs_clear_partial_with_content
  before update of content_deleted_at on public.ai_runs
  for each row execute function public.ai_runs_clear_partial_with_content();
