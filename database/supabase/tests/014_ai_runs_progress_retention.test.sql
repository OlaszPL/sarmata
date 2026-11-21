begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.offices (id, name) values ('a1414141-0000-4000-8000-000000000001', 'Urząd 14');
insert into auth.users (id, email) values ('a1414141-1111-4000-8000-000000000001', 'ev@a14.test');
insert into public.memberships (user_id, office_id, role)
  values ('a1414141-1111-4000-8000-000000000001', 'a1414141-0000-4000-8000-000000000001', 'evaluator');
insert into public.employees (id, office_id, first_name, last_name)
  values ('a1414141-2222-4000-8000-0000000000a1', 'a1414141-0000-4000-8000-000000000001', 'Ala', 'Ucząca');
insert into public.ai_runs (id, office_id, kind, requested_by, employee_id, input, input_refs, status, started_at,
                            partial_text, partial_output, output_tokens, progress_updated_at, prompt_version)
values ('a1414141-4444-4000-8000-000000000001', 'a1414141-0000-4000-8000-000000000001', 'hr_signals',
        'a1414141-1111-4000-8000-000000000001', 'a1414141-2222-4000-8000-0000000000a1',
        '{"notes":[],"pastRatings":[]}', '{"noteIds":[],"droppedNoteIds":[]}', 'running', now(),
        '{"signals":[', '{"signals":[]}', 12, now(), 'hr-signals.v1');

select is((select partial_text from public.ai_runs where id = 'a1414141-4444-4000-8000-000000000001'),
          '{"signals":[', 'a running run keeps its partial text');

update public.ai_runs set content_deleted_at = now() where id = 'a1414141-4444-4000-8000-000000000001';

select is((select partial_text from public.ai_runs where id = 'a1414141-4444-4000-8000-000000000001'),
          null, 'partial text goes with the deleted content');
select is((select partial_output from public.ai_runs where id = 'a1414141-4444-4000-8000-000000000001'),
          null, 'partial output goes with the deleted content');

select * from finish();
rollback;
