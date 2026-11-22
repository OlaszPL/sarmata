-- Demo data (fictional). Password for all accounts: Haslo-Demo-2026
insert into public.offices (id, name) values
  ('11111111-1111-4111-8111-111111111111', 'Urząd Ministerstwa Testowego w Kropce Wielkopolskiej');

select access.create_account(
  email => 'admin@kropka.test', password => 'Haslo-Demo-2026',
  office_id => '11111111-1111-4111-8111-111111111111', role => 'admin',
  first_name => 'Anna', last_name => 'Administracyjna',
  account_id => '22222222-2222-4222-8222-000000000001'
);
select access.create_account(
  email => 'kadry@kropka.test', password => 'Haslo-Demo-2026',
  office_id => '11111111-1111-4111-8111-111111111111', role => 'hr',
  first_name => 'Karol', last_name => 'Kadrowy',
  account_id => '22222222-2222-4222-8222-000000000002'
);
select access.create_account(
  email => 'oceniajacy@kropka.test', password => 'Haslo-Demo-2026',
  office_id => '11111111-1111-4111-8111-111111111111', role => 'evaluator',
  first_name => 'Olga', last_name => 'Oceniająca',
  account_id => '22222222-2222-4222-8222-000000000003'
);

-- Account without membership and employee record: covers the "no office" path of the app.
select access.create_account(
  email => 'bezurzedu@kropka.test', password => 'Haslo-Demo-2026',
  account_id => '22222222-2222-4222-8222-000000000004'
);

-- Employees without accounts: evaluated employees do not use the app. Their supervisor is Olga Oceniająca.
insert into public.employees (
  office_id, first_name, last_name, email, position_kind, service_status, employment_basis,
  appointment_year, grade, grade_granted_on, supervisor_employee_id
) values
  ('11111111-1111-4111-8111-111111111111', 'Ewa', 'Ewidencyjna', 'ewa.ewidencyjna@kropka.test',
   'other', 'civil_servant', 'appointment', 2018, 4, null,
   (select id from public.employees where email = 'oceniajacy@kropka.test')),
  ('11111111-1111-4111-8111-111111111111', 'Marek', 'Merytoryczny', 'marek.merytoryczny@kropka.test',
   'other', 'employee', 'indefinite', null, null, null,
   (select id from public.employees where email = 'oceniajacy@kropka.test')),
  -- Grade III granted on 2021-03-01: two evaluations above expectations since then give the grade by law.
  ('11111111-1111-4111-8111-111111111111', 'Stefan', 'Sprzeciwny', 'stefan.sprzeciwny@kropka.test',
   'other', 'civil_servant', 'appointment', 2018, 3, '2021-03-01',
   (select id from public.employees where email = 'oceniajacy@kropka.test'));

-- Notes of Olga Oceniająca about Marek. The first one is edited once, so it has a kept earlier version.
insert into public.notes (id, office_id, employee_id, author_account_id, kind, occurred_on, criterion_id, sign, communicated, body) values
  ('33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-111111111111',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '22222222-2222-4222-8222-000000000003', 'observation', '2026-09-14', 'communication', 'plus', false,
   'Przekazał zespołowi ustalenia ze spotkania.'),
  ('33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-111111111111',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '22222222-2222-4222-8222-000000000003', 'ongoing_conversation', '2026-10-05', null, 'plus', true,
   'Rozmowa o planie na kwartał, uzgodnione priorytety.'),
  ('33333333-3333-4333-8333-000000000003', '11111111-1111-4111-8111-111111111111',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '22222222-2222-4222-8222-000000000003', 'workload_fact', '2026-10-20', null, null, false,
   'Przejął obsługę dwóch dodatkowych spraw na czas urlopu współpracownika.');
update public.notes
   set body = 'Przekazał zespołowi ustalenia ze spotkania i zadbał o notatkę z działań.'
 where id = '33333333-3333-4333-8333-000000000001';

-- A plus note of Olga Oceniająca about Ewa Ewidencyjna: the appreciation moment of the evaluator dashboard cites it.
insert into public.notes (id, office_id, employee_id, author_account_id, kind, occurred_on, criterion_id, sign, communicated, body) values
  ('33333333-3333-4333-8333-000000000004', '11111111-1111-4111-8111-111111111111',
   (select id from public.employees where email = 'ewa.ewidencyjna@kropka.test'),
   '22222222-2222-4222-8222-000000000003', 'appreciation', '2026-11-14', 'work-organization', 'plus', false,
   'Wdrożyła nowy rejestr pism bez przestojów w pracy wydziału.');

-- SMTP of the demo office: the Mailpit of the local Supabase (smtp_port in config.toml), no password needed.
update public.office_settings
   set smtp_host = '127.0.0.1', smtp_port = 55425, smtp_from = 'oceny@kropka.test'
 where office_id = '11111111-1111-4111-8111-111111111111';

-- Office data of the accessibility statement (art. 10 ust. 4 pkt 4, 6 and 7 of the digital accessibility act).
update public.office_settings
   set accessibility_office_address = 'ul. Testowa 1, 62-000 Kropka Wielkopolska',
       accessibility_contact_name = 'Wydział Kadr i Rozwoju, koordynator do spraw dostępności',
       accessibility_contact_email = 'dostepnosc@kropka.test',
       accessibility_contact_phone = '+48 61 000 00 00',
       accessibility_architecture = 'Do budynku prowadzi wejście bez progów od strony parkingu, z miejscem dla osoby z niepełnosprawnością. Winda obsługuje wszystkie piętra, toaleta dostosowana jest na parterze. Do budynku można wejść z psem asystującym.',
       accessibility_sign_language = 'Tłumacza polskiego języka migowego zapewniamy po zgłoszeniu co najmniej 3 dni robocze przed wizytą, mailem albo telefonicznie. Można też skorzystać z tłumacza online przez stronę urzędu.'
 where office_id = '11111111-1111-4111-8111-111111111111';

-- Statistics demo (B5): organisational units for the per unit distribution and Karol Kadrowy as a civil servant
-- (grade II since 2022), so a grade request and a grade decision exist among the closed evaluations.
update public.employees set org_unit = 'Biuro Dyrektora Generalnego' where email = 'admin@kropka.test';
update public.employees set org_unit = 'Wydział Kadr i Rozwoju' where email in ('kadry@kropka.test', 'marek.merytoryczny@kropka.test');
update public.employees set org_unit = 'Wydział Kontroli' where email in ('oceniajacy@kropka.test', 'ewa.ewidencyjna@kropka.test', 'stefan.sprzeciwny@kropka.test');
update public.employees
   set service_status = 'civil_servant', employment_basis = 'appointment', appointment_year = 2019,
       grade = 2, grade_granted_on = '2022-03-01'
 where email = 'kadry@kropka.test';

-- AI runs of Olga Oceniająca about Marek (ADR 0008). Inserted with their results, so the trigger
-- enqueues nothing. The sheet draft cites the notes above and has one edited fragment.
insert into public.ai_runs (id, office_id, kind, requested_by, employee_id, input, input_refs, status, output,
                            prompt_version, model, requested_at, started_at, finished_at) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-111111111111', 'sheet_draft',
   '22222222-2222-4222-8222-000000000003',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '{"sheetId":"C","criteria":[{"id":"communication","name":"komunikacja","indicators":[]},{"id":"work-organization","name":"organizacja pracy","indicators":[]},{"id":"reliability","name":"rzetelność","indicators":[]}],"scale":[{"points":1,"name":"znacznie poniżej oczekiwań"},{"points":3,"name":"poniżej oczekiwań"},{"points":5,"name":"na poziomie oczekiwań"},{"points":7,"name":"powyżej oczekiwań"},{"points":9,"name":"znacznie powyżej oczekiwań"}],"notes":[]}',
   '{"noteIds":[{"id":"33333333-3333-4333-8333-000000000001","version":2},{"id":"33333333-3333-4333-8333-000000000002","version":1},{"id":"33333333-3333-4333-8333-000000000003","version":1}],"droppedNoteIds":[],"regulationId":"regulation-2016"}',
   'done',
   '{"status":"draft","ratings":[
      {"criterionId":"communication","points":7,"sentences":[{"text":"14.09.2026 przekazał zespołowi ustalenia ze spotkania i przygotował notatkę z działań.","noteIds":["33333333-3333-4333-8333-000000000001"]}]},
      {"criterionId":"work-organization","points":5,"sentences":[{"text":"5.10.2026 uzgodnił z przełożoną priorytety na kwartał.","noteIds":["33333333-3333-4333-8333-000000000002"]}]},
      {"criterionId":"reliability","points":7,"sentences":[{"text":"Od 20.10.2026 przejął obsługę dwóch dodatkowych spraw na czas urlopu współpracownika.","noteIds":["33333333-3333-4333-8333-000000000003"]}]}],
    "justification":[{"text":"Pracownik rzetelnie przekazuje ustalenia i przejmuje dodatkowe zadania, co potwierdzają notatki z września i października 2026.","noteIds":["33333333-3333-4333-8333-000000000001","33333333-3333-4333-8333-000000000003"]}],
    "developmentConclusions":[{"text":"Warto rozwijać planowanie pracy przy zwiększonym obciążeniu zadaniami.","noteIds":["33333333-3333-4333-8333-000000000003"]}],
    "questions":["Jak wygląda obciążenie po przejęciu dodatkowych spraw?"]}',
   'sheet-draft.v1', 'bielik-4.5b-v3.0-instruct', '2026-11-02 09:00:00+01', '2026-11-02 09:00:05+01', '2026-11-02 09:02:40+01'),
  ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-111111111111', 'hr_signals',
   '22222222-2222-4222-8222-000000000003',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '{"notes":[],"pastRatings":[]}',
   '{"noteIds":[{"id":"33333333-3333-4333-8333-000000000003","version":1}],"droppedNoteIds":[]}',
   'done',
   '{"signals":[
      {"signal":"sentiment","present":false,"probability":0.12,"fragments":[]},
      {"signal":"overload","present":true,"probability":0.71,"fragments":[{"noteId":"33333333-3333-4333-8333-000000000003","quote":"Przejął obsługę dwóch dodatkowych spraw"}]},
      {"signal":"engagement_drop","present":false,"probability":0.08,"fragments":[]},
      {"signal":"burnout_risk","present":false,"probability":0.2,"fragments":[]}],
    "questions":["Które z przejętych spraw można przekazać dalej po powrocie współpracownika?"],
    "actions":[{"framework":"jd_r","signal":"overload","text":"Przegląd priorytetów i terminów spraw przejętych na czas urlopu."}]}',
   'hr-signals.v1', 'bielik-4.5b-v3.0-instruct', '2026-11-03 10:00:00+01', '2026-11-03 10:00:02+01', '2026-11-03 10:01:10+01');

-- Appreciation moments for Ewa (done, so nothing is enqueued). The last appreciation was 8 days before the demo
-- day 2026-11-22, the office threshold is 30 days, so the gap is not overdue.
insert into public.ai_runs (id, office_id, kind, requested_by, employee_id, input, input_refs, status, output,
                            prompt_version, model, requested_at, started_at, finished_at) values
  ('44444444-4444-4444-8444-000000000003', '11111111-1111-4111-8111-111111111111', 'appreciation_moments',
   '22222222-2222-4222-8222-000000000003',
   (select id from public.employees where email = 'ewa.ewidencyjna@kropka.test'),
   '{"today":"2026-11-22","gapDays":30,"notes":[{"id":"33333333-3333-4333-8333-000000000004","version":1,"kind":"appreciation","occurredOn":"2026-11-14","criterionId":"work-organization","sign":"plus","communicated":false,"body":"Wdrożyła nowy rejestr pism bez przestojów w pracy wydziału."}]}',
   '{"noteIds":[{"id":"33333333-3333-4333-8333-000000000004","version":1}],"droppedNoteIds":[]}',
   'done',
   '{"gap":{"lastAppreciationOn":"2026-11-14","daysSince":8,"thresholdDays":30,"overdue":false},
    "moments":[{"noteIds":["33333333-3333-4333-8333-000000000004"],
      "reason":"14.11.2026 wdrożyła nowy rejestr pism bez przestojów w pracy wydziału.",
      "sbi":{"situation":"14.11.2026 w wydziale zaczął działać nowy rejestr pism.",
             "behaviour":"Pracownica wdrożyła rejestr bez przestojów w pracy wydziału.",
             "impact":"Wydział pracował bez przerwy, a pisma były rejestrowane na bieżąco."}}]}',
   'appreciation-moments.v2', 'bielik-4.5b-v3.0-instruct', '2026-11-22 08:30:00+01', '2026-11-22 08:30:02+01', '2026-11-22 08:30:20+01');

-- A finished question of Olga Oceniająca to the procedure assistant, so the help page shows an answer with
-- citations without the worker (/pomoc?pytanie=44444444-4444-4444-8444-000000000004). General question,
-- no evaluation: the regulation version in force answers it. The fragments are the text of the act and the
-- regulation of regulation-2016 at the cited lines.
insert into public.ai_runs (id, office_id, kind, requested_by, employee_id, input, input_refs, status, output,
                            prompt_version, model, requested_at, started_at, finished_at) values
  ('44444444-4444-4444-8444-000000000004', '11111111-1111-4111-8111-111111111111', 'procedure_question',
   '22222222-2222-4222-8222-000000000003', null,
   '{"question": "Ile dni ma pracownik na sprzeciw od oceny okresowej i od kiedy liczy się ten termin?", "today": "2026-11-21", "regulationId": "regulation-2016", "corpus": [{"sourceId": "civil-service-act", "title": "Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej", "citation": "Dz.U. 2026 poz. 590 t.j.", "path": "backend/regulations/regulation-2016/sources/ustawa-o-sluzbie-cywilnej-tj-2026.md"}, {"sourceId": "periodic-evaluation-regulation", "title": "Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej", "citation": "Dz.U. 2016 poz. 470", "path": "backend/regulations/regulation-2016/sources/rozporzadzenie-oceny-okresowe-2016.md"}, {"sourceId": "hr-standards-order-6", "title": "Zarządzenie nr 6 Szefa Służby Cywilnej z dnia 12 marca 2020 r. w sprawie standardów zarządzania zasobami ludzkimi w służbie cywilnej", "citation": "publikacja na gov.pl/web/sluzbacywilna, zmienione zarządzeniem nr 7 z 16.12.2020 r.", "path": "backend/regulations/regulation-2016/sources/zarzadzenie-6-szefa-sc-2020-standardy-zzl.md"}]}',
   '{"noteIds":[],"droppedNoteIds":[],"regulationId":"regulation-2016"}',
   'done',
   '{"answer": "Pracownik może wnieść sprzeciw od oceny okresowej w terminie 7 dni od dnia zapoznania się z oceną. Sprzeciw kieruje do dyrektora generalnego urzędu [1].\n\nTermin liczy się od dnia, w którym oceniający zapoznał pracownika z oceną sporządzoną na piśmie. Oceniający robi to niezwłocznie po sporządzeniu oceny, a potem doręcza ocenianemu kopię arkusza [2].\n\nDyrektor generalny rozpatruje sprzeciw w terminie 14 dni od dnia wniesienia. Gdy sprzeciwu nie uwzględni albo nie rozpatrzy go w terminie, pracownik może w ciągu 14 dni odwołać się do sądu pracy [1].", "grounded": true, "citations": [{"fragmentId": 1, "reference": "art. 83 ust. 1, 3 i 5 ustawy o służbie cywilnej"}, {"fragmentId": 2, "reference": "§ 12 ust. 1 i 2 rozporządzenia w sprawie ocen okresowych"}], "fragments": [{"id": 1, "sourceId": "civil-service-act", "title": "Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej", "citation": "Dz.U. 2026 poz. 590 t.j.", "heading": "Art. 83", "text": "### Art. 83\n\n1. Od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do dyrektora generalnego urzędu.\n\n2. (uchylony)\n\n3. Sprzeciw rozpatruje się w terminie 14 dni od dnia wniesienia.\n\n4. W razie uwzględnienia sprzeciwu ocenę okresową zmienia się albo sporządza po raz drugi. Od oceny okresowej sporządzonej po raz drugi przysługuje sprzeciw na zasadach określonych w ust. 1 i 3.\n\n5. W razie nierozpatrzenia sprzeciwu w terminie albo nieuwzględnienia sprzeciwu od oceny okresowej, oceniany może, w terminie 14 dni od dnia doręczenia decyzji albo od dnia upływu terminu, o którym mowa w ust. 3, odwołać się do sądu pracy.", "path": "backend/regulations/regulation-2016/sources/ustawa-o-sluzbie-cywilnej-tj-2026.md", "startLine": 1438, "endLine": 1448}, {"id": 2, "sourceId": "periodic-evaluation-regulation", "title": "Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej", "citation": "Dz.U. 2016 poz. 470", "heading": "§ 12", "text": "### § 12\n\n1. Oceniający niezwłocznie zapoznaje ocenianego z oceną sporządzoną na piśmie.\n\n2. Po dokonaniu czynności, o której mowa w ust. 1, oryginał arkusza włącza się do akt osobowych ocenianego, a kopię arkusza oceniający doręcza ocenianemu.", "path": "backend/regulations/regulation-2016/sources/rozporzadzenie-oceny-okresowe-2016.md", "startLine": 169, "endLine": 173}]}',
   'procedure-question.v2', 'bielik-4.5b-v3.0-instruct', '2026-11-21 14:05:00+01', '2026-11-21 14:05:01+01', '2026-11-21 14:05:38+01');

insert into public.ai_fragment_decisions (run_id, office_id, fragment, decision, final_text, decided_by, decided_at) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-111111111111', 'rating.communication',
   'accepted', null, '22222222-2222-4222-8222-000000000003', '2026-11-02 09:10:00+01'),
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-111111111111', 'justification.0',
   'edited', 'Pracownik rzetelnie przekazuje ustalenia zespołowi (14.09.2026) i przejął dwie dodatkowe sprawy na czas urlopu współpracownika (20.10.2026).',
   '22222222-2222-4222-8222-000000000003', '2026-11-02 09:12:00+01');
