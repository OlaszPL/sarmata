-- access.can with the note and office settings branches, on top of the archived_evaluation version from
-- 20261122140000_staffing_events.sql (copied unchanged). Still one expression without table lookups:
-- row lookups for notes live in access.note_rule.
--
-- office and office_settings: every member of the office reads, only the admin updates. Nobody creates
-- or deletes them through the Data API.
-- note: the office check here, the per role and per row rules in access.note_rule. For note_versions the
-- resource_id passed is note_id.
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
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;
