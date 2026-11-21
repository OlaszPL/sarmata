-- access.can with the ai_run branch, on top of the note version from 20261122150300_access_can_notes_settings.sql
-- (copied unchanged). Still one expression without table lookups: row lookups for AI runs live in
-- access.ai_run_rule. For ai_fragment_decisions the resource_id passed is run_id.
create or replace function access.can(action access.action, resource access.resource, office_id uuid, resource_id uuid)
returns boolean
language sql
stable
as $$
  select case
    when resource = 'regulation_version' then
      (office_id is null and action = 'read' and access.current_office_id() is not null)
      or (office_id = access.current_office_id()
          and (action = 'read' or access.current_office_role() = 'admin'))
    when resource in ('evaluation', 'evaluation_sheet', 'evaluation_event', 'evaluation_deadline') then
      office_id = access.current_office_id() and access.evaluation_rule(action, resource, resource_id)
    when resource = 'archived_evaluation' then
      office_id = access.current_office_id()
      and (action = 'read'
           or (action = 'create' and coalesce(access.current_office_role() in ('hr', 'evaluator'), false)))
    when resource in ('office', 'office_settings') then
      office_id = access.current_office_id()
      and (action = 'read'
           or (action = 'update' and coalesce(access.current_office_role() = 'admin', false)))
    when resource = 'note' then
      office_id = access.current_office_id() and access.note_rule(action, resource_id)
    when resource = 'ai_run' then
      office_id = access.current_office_id() and access.ai_run_rule(action, resource_id)
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;
