-- access.can with the notification branch, on top of the version from 20261122150300 (copied unchanged).
-- Still one expression without table lookups.
--
-- notification: the inbox belongs to one account. For this resource resource_id is the account of the
-- recipient (notifications.account_id), not the row id, so the rule needs no table read.
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
    when resource = 'notification' then
      office_id = access.current_office_id() and resource_id = auth.uid() and action in ('read', 'update')
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;
