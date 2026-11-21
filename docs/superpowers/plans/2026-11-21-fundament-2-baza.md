# Fundament 2: baza danych. Plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** lokalne Supabase `sarmata` na portach 554xx z migracjami bazowymi (`offices`, `memberships`, `employees`), hookiem JWT dokładającym `office_id` i rolę, RLS izolującym urzędy, testami pgTAP, kontami demo i wygenerowanymi typami.

**Architektura:** workspace `database/` (pakiet `@sarmata/database`) z katalogiem `database/supabase/` dla Supabase CLI. Wszystkie polityki RLS pytają jedną funkcję `access.can(action, resource, office_id)` (ustalenie wątku funkcjonalnego), a ta bierze urząd konta z `access.current_office_id()`. Cała logika dostępu żyje w schemacie `access`. Hook `public.custom_access_token_hook` kopiuje członkostwo do JWT, więc polityki nie robią joinów. Pakiet eksportuje tylko typ `Database`.

**Stack:** Supabase CLI 3.2.0 (z brew lokalnie, `supabase/setup-cli@v3` w CI), Postgres 17, pg_cron, pgmq, pgTAP.

**Kontekst dla wykonawcy:**
- Decyzje: `docs/adr/0001-office-id-od-poczatku.md`, `docs/adr/0002-uklad-repo-i-runtime.md`, `docs/adr/0004-repozytoria-supabase-js.md`, `docs/architektura.md`. Pojęcia: `GLOSSARY.md` (Urząd, Konto, Pracownik, Członkostwo).
- Na maszynie działa inny stack Supabase (`trainage`) na portach 54321 do 54323. Nie dotykaj go. Nasz stack ma `project_id = "sarmata"` i porty 554xx.
- Jedna instancja `sarmata` jest wspólna dla wszystkich worktree (ADR 0002). `supabase status` z dowolnego worktree ją widzi.
- Polecenia powłoki z prefiksem `rtk`. Proza bez półpauz i bez średników (`AGENTS.md`).
- Model dostępu w ramach urzędu (kto co widzi) ustala wątek funkcjonalny. Tu tylko izolacja urzędów i minimum ról.

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `database/package.json`, `database/tsconfig.json` | pakiet `@sarmata/database`, skrypty CLI |
| `database/supabase/config.toml` | konfiguracja lokalnego stacka (porty, hook, wyłączone usługi) |
| `database/supabase/migrations/20261121120000_extensions.sql` | pg_cron, pgmq, pg_trgm |
| `database/supabase/migrations/20261121120100_offices_memberships_employees.sql` | tabele bazowe |
| `database/supabase/migrations/20261121120200_jwt_and_rls.sql` | hook JWT, schemat `access` (`current_office_id`, `can`), RLS, granty |
| `database/supabase/seed.sql` | fikcyjny urząd i konta demo |
| `database/supabase/tests/001_office_isolation.test.sql` | pgTAP: hook i izolacja |
| `database/src/types.ts` | typy wygenerowane przez CLI (nie edytować ręcznie) |
| `database/src/index.ts` | jedyny interfejs pakietu: typ `Database` |
| `package.json` (korzeń) | skrypty `db:*` |
| `scripts/termic-setup.sh` | start wspólnej instancji przy nowym tasku |
| `.github/workflows/ci.yml` | job `baza`: pgTAP i zgodność typów |

---

### Task 1: Pakiet `@sarmata/database` i konfiguracja Supabase

**Files:**
- Create: `database/package.json`, `database/tsconfig.json`, `database/supabase/config.toml`
- Modify: `.gitignore`, `package.json`

- [ ] **Step 1: Utwórz `database/package.json`**

```json
{
  "name": "@sarmata/database",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "start": "supabase start",
    "stop": "supabase stop",
    "status": "supabase status",
    "reset": "supabase db reset",
    "types": "supabase gen types typescript --schema public > src/types.ts",
    "test:db": "supabase test db",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

Supabase CLI nie jest zależnością npm (paczka wymaga zgody na skrypt instalacyjny i pobiera binarkę). Lokalnie używamy CLI z brew, w CI akcji `supabase/setup-cli`.

- [ ] **Step 2: Utwórz `database/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Wygeneruj szablon konfiguracji**

Run: `cd database && supabase init --force < /dev/null && cd ..`
Expected: powstaje `database/supabase/config.toml`.

- [ ] **Step 4: Ustaw nasze wartości w `config.toml`**

Run (z korzenia repo):

```bash
python3 - <<'EOF'
import re
p = 'database/supabase/config.toml'
s = open(p).read()

def zamien(stare, nowe):
    global s
    assert stare in s, f'brak w config.toml: {stare!r}'
    s = s.replace(stare, nowe, 1)

s = re.sub(r'^project_id = ".*"$', 'project_id = "sarmata"', s, count=1, flags=re.M)
for stary, nowy in [('54321', '55421'), ('54322', '55422'), ('54320', '55420'), ('54329', '55429'),
                    ('54323', '55423'), ('54324', '55424'), ('54327', '55427'), ('8083', '55483')]:
    s = re.sub(rf'^(\w*port = ){stary}$', rf'\g<1>{nowy}', s, count=1, flags=re.M)

zamien('[realtime]\nenabled = true', '[realtime]\nenabled = false')
zamien('[edge_runtime]\nenabled = true', '[edge_runtime]\nenabled = false')
zamien('[analytics]\nenabled = true', '[analytics]\nenabled = false')
zamien('site_url = "http://127.0.0.1:3000"', 'site_url = "http://localhost:3000"')
zamien('additional_redirect_urls = ["https://127.0.0.1:3000"]',
       'additional_redirect_urls = ["http://localhost:*/**", "http://127.0.0.1:*/**"]')
zamien('# [auth.hook.custom_access_token]\n# enabled = true\n# uri = "pg-functions://<database>/<schema>/<hook_name>"',
       '[auth.hook.custom_access_token]\nenabled = true\nuri = "pg-functions://postgres/public/custom_access_token_hook"')
open(p, 'w').write(s)
EOF
rtk proxy grep -n -E '^project_id|port = 55|^\[realtime\]|^\[edge_runtime\]|^\[analytics\]|custom_access_token|site_url' database/supabase/config.toml
```

Expected: `project_id = "sarmata"`, osiem portów `554xx`, sekcja hooka bez komentarzy. Realtime, edge runtime i analityka są wyłączone, bo fundament ich nie używa (ADR 0003: lżejszy stack).

- [ ] **Step 5: Dopisz do `.gitignore`**

```gitignore
database/supabase/.temp/
database/supabase/.branches/
```

- [ ] **Step 6: Dodaj skrypty do korzenia `package.json`**

```json
    "db:start": "pnpm --filter @sarmata/database start",
    "db:stop": "pnpm --filter @sarmata/database stop",
    "db:status": "pnpm --filter @sarmata/database status",
    "db:reset": "pnpm --filter @sarmata/database reset",
    "db:types": "pnpm --filter @sarmata/database types",
    "db:test": "pnpm --filter @sarmata/database test:db"
```

- [ ] **Step 7: Commit**

```bash
rtk pnpm install
rtk git add database .gitignore package.json pnpm-lock.yaml
rtk git commit -m "chore(db): supabase project sarmata on ports 554xx"
```

---

### Task 2: Migracje bazowe

**Files:**
- Create: `database/supabase/migrations/20261121120000_extensions.sql`, `database/supabase/migrations/20261121120100_offices_memberships_employees.sql`, `database/supabase/migrations/20261121120200_jwt_and_rls.sql`

- [ ] **Step 1: `20261121120000_extensions.sql`**

```sql
-- BPMN scheduler (reminders, deadline recalculation) and background job queue (ADR 0002).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pgmq;
-- Fuzzy matching of a typed-in employee to an existing one (docs/funkcjonalnosci.md).
create extension if not exists pg_trgm with schema extensions;
```

- [ ] **Step 2: `20261121120100_offices_memberships_employees.sql`**

```sql
-- Domain terms: GLOSSARY.md. Every domain table has office_id (ADR 0001).

-- The evaluated employee has no account. Evaluator is an account role, who they evaluate comes from the evaluation (docs/funkcjonalnosci.md).
create type public.office_role as enum ('admin', 'hr', 'evaluator');

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
comment on table public.offices is 'Office (urząd): employer of evaluated staff, owner of all domain data.';

-- One account belongs to one office, so the JWT carries an unambiguous office_id.
create table public.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  office_id uuid not null references public.offices (id) on delete cascade,
  role public.office_role not null,
  created_at timestamptz not null default now()
);
create index memberships_office_id_idx on public.memberships (office_id);
comment on table public.memberships is 'Membership (członkostwo): an account assigned to an office with a role.';

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (office_id, email)
);
create index employees_office_id_idx on public.employees (office_id);
comment on table public.employees is 'Employee (pracownik): a person from HR records, may exist without an account.';
```

- [ ] **Step 3: `20261121120200_jwt_and_rls.sql`**

```sql
-- Supabase Auth hook: adds office_id and role from the membership to the JWT (ADR 0004).
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb := event -> 'claims';
  membership record;
begin
  select c.office_id, c.role
    into membership
    from public.memberships c
   where c.user_id = (event ->> 'user_id')::uuid;

  if found then
    claims := claims || jsonb_build_object('office_id', membership.office_id, 'office_role', membership.role);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on table public.memberships to supabase_auth_admin;

-- Single access decision point: every RLS policy asks access.can(action, resource, office_id).
-- For now it only enforces office isolation. Per role and per resource rules (e.g. notes: author and HR)
-- belong here, not in policies. The row's office_id comes from the policy, so there is no lookup.
create schema access;
grant usage on schema access to authenticated;

-- The only place that knows where the signed-in account's office comes from (claim set by the hook).
create function access.current_office_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'office_id', '')::uuid
$$;

create function access.can(action text, resource text, office_id uuid)
returns boolean
language sql
stable
as $$
  select office_id is not null and office_id = access.current_office_id()
$$;
grant execute on function access.can(text, text, uuid) to authenticated;

alter table public.offices enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;

revoke all on public.offices, public.memberships, public.employees from anon;
grant select on public.offices, public.memberships to authenticated;
grant select, insert, update, delete on public.employees to authenticated;

create policy "auth hook reads memberships" on public.memberships
  for select to supabase_auth_admin
  using (true);

create policy "read office" on public.offices
  for select to authenticated
  using (access.can('read', 'office', id));

create policy "read memberships" on public.memberships
  for select to authenticated
  using (access.can('read', 'membership', office_id));

create policy "read employees" on public.employees
  for select to authenticated
  using (access.can('read', 'employee', office_id));

create policy "create employees" on public.employees
  for insert to authenticated
  with check (access.can('create', 'employee', office_id));

create policy "update employees" on public.employees
  for update to authenticated
  using (access.can('update', 'employee', office_id))
  with check (access.can('update', 'employee', office_id));

create policy "delete employees" on public.employees
  for delete to authenticated
  using (access.can('delete', 'employee', office_id));
```

`access.can` to prosta funkcja SQL `stable`, więc planer może ją wstawić w treść polityki. Każda nowa tabela dostaje polityki wyłącznie przez `access.can`, a nowe reguły dostępu zmieniają tylko tę funkcję.

- [ ] **Step 4: Commit**

```bash
rtk git add database/supabase/migrations
rtk git commit -m "feat(db): offices, memberships, employees with jwt hook and office isolation"
```

---

### Task 3: Dane demo

Fikcyjny urząd z przykładowych arkuszy KPRM i trzy konta demo. Hasło wszystkich kont: `Haslo-Demo-2026`. Domena `.test` jest zarezerwowana, a maile i tak łapie Mailpit.

**Files:**
- Create: `database/supabase/seed.sql`

- [ ] **Step 1: Utwórz `database/supabase/seed.sql`**

```sql
-- Demo data (fictional). Password for all accounts: Haslo-Demo-2026
insert into public.offices (id, name) values
  ('11111111-1111-4111-8111-111111111111', 'Urząd Ministerstwa Testowego w Kropce Wielkopolskiej');

do $$
declare
  account record;
begin
  for account in
    select * from (values
      ('22222222-2222-4222-8222-000000000001'::uuid, 'admin@kropka.test', 'admin'::public.office_role, 'Anna', 'Administracyjna'),
      ('22222222-2222-4222-8222-000000000002'::uuid, 'kadry@kropka.test', 'hr'::public.office_role, 'Karol', 'Kadrowy'),
      ('22222222-2222-4222-8222-000000000003'::uuid, 'oceniajacy@kropka.test', 'evaluator'::public.office_role, 'Olga', 'Oceniająca')
    ) as t(id, email, role, first_name, last_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', account.id, 'authenticated', 'authenticated', account.email,
      extensions.crypt('Haslo-Demo-2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), account.id, account.id::text,
      jsonb_build_object('sub', account.id::text, 'email', account.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    insert into public.memberships (user_id, office_id, role)
    values (account.id, '11111111-1111-4111-8111-111111111111', account.role);

    insert into public.employees (office_id, first_name, last_name, email, user_id)
    values ('11111111-1111-4111-8111-111111111111', account.first_name, account.last_name, account.email, account.id);
  end loop;
end $$;

-- Employees without accounts: evaluated employees do not use the app.
insert into public.employees (office_id, first_name, last_name, email) values
  ('11111111-1111-4111-8111-111111111111', 'Ewa', 'Ewidencyjna', 'ewa.ewidencyjna@kropka.test'),
  ('11111111-1111-4111-8111-111111111111', 'Marek', 'Merytoryczny', 'marek.merytoryczny@kropka.test');
```

Puste stringi w kolumnach tokenów są celowe: GoTrue nie akceptuje w nich `NULL` przy logowaniu.

- [ ] **Step 2: Commit**

```bash
rtk git add database/supabase/seed.sql
rtk git commit -m "feat(db): demo office and accounts seed"
```

---

### Task 4: Testy pgTAP

Testy przechodzą przez ten sam interfejs co aplikacja: hook wołany jak przez Auth, zapytania jako rola `authenticated` z claimami JWT i `access.can` wołane wprost.

**Files:**
- Create: `database/supabase/tests/001_office_isolation.test.sql`

- [ ] **Step 1: Utwórz test**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'a@a.test'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'b@b.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hr'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'hr');
insert into public.employees (office_id, first_name, last_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Jan', 'Z-A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Ewa', 'Z-B');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-1111-4000-8000-000000000001', 'claims', '{}'::jsonb
  )) -> 'claims' ->> 'office_id',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'hook adds office_id from the membership'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'cccccccc-1111-4000-8000-000000000003', 'claims', '{"sub":"x"}'::jsonb
  )) -> 'claims',
  '{"sub":"x"}'::jsonb,
  'hook leaves claims unchanged without a membership'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001"}';

select results_eq(
  'select last_name from public.employees',
  $$values ('Z-A')$$,
  'account sees only employees of its office'
);

select results_eq(
  'select name from public.offices',
  $$values ('Urząd A')$$,
  'account sees only its own office'
);

select ok(
  not access.can('read', 'employee', 'bbbbbbbb-0000-4000-8000-000000000002'),
  'access.can denies another office'
);

select throws_ok(
  $$insert into public.employees (office_id, first_name, last_name) values ('bbbbbbbb-0000-4000-8000-000000000002', 'X', 'Y')$$,
  '42501',
  null,
  'cannot create an employee in another office'
);

set local request.jwt.claims = '{"sub":"cccccccc-1111-4000-8000-000000000003","role":"authenticated"}';

select is_empty(
  'select 1 from public.employees',
  'without office_id in the JWT nothing is visible'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Commit**

```bash
rtk git add database/supabase/tests
rtk git commit -m "test(db): pgtap for jwt hook and office isolation"
```

---

### Task 5: Typy i interfejs pakietu

**Files:**
- Create: `database/src/types.ts` (generowany), `database/src/index.ts`
- Modify: `.prettierignore`, `eslint.config.mjs`

- [ ] **Step 1: Uruchom stack i wygeneruj typy**

Run: `rtk pnpm db:start && rtk pnpm db:reset && rtk pnpm db:types`
Expected: stack `sarmata` działa na 554xx, `database/src/types.ts` zawiera typ `Database` z tabelami `offices`, `memberships`, `employees`.

Ten krok jest wyjątkiem od zasady „bez sprawdzeń po drodze”, bo bez działającej bazy nie da się wygenerować typów.

- [ ] **Step 2: Utwórz `database/src/index.ts` (jedyny interfejs pakietu)**

```ts
export type { Database } from './types';
```

- [ ] **Step 3: Wyłącz plik generowany z formatowania i lintu**

Dopisz do `.prettierignore`:

```
database/src/types.ts
```

W `eslint.config.mjs` dodaj `'database/src/types.ts'` do listy w `globalIgnores([...])`.

- [ ] **Step 4: Commit**

```bash
rtk git add database/src .prettierignore eslint.config.mjs
rtk git commit -m "feat(db): generated types exposed as @sarmata/database"
```

---

### Task 6: Termic, CI i README

**Files:**
- Modify: `scripts/termic-setup.sh`, `.github/workflows/ci.yml`, `README.md`

- [ ] **Step 1: Dopisz na końcu `scripts/termic-setup.sh`**

```bash

# Shared Supabase instance "sarmata" for all worktrees (ADR 0002).
if docker info >/dev/null 2>&1; then
  (cd database && { supabase status >/dev/null 2>&1 || supabase start; })
else
  echo "Docker is not running, skipping Supabase start"
fi
```

- [ ] **Step 2: Dodaj `workflow_dispatch` i job `baza` w `.github/workflows/ci.yml`**

W sekcji `on:` dopisz `workflow_dispatch:`, tak żeby wyglądała tak:

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
```

Na końcu sekcji `jobs:` dodaj:

```yaml
  baza:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: database
    steps:
      - uses: actions/checkout@v7
      - uses: supabase/setup-cli@v3
        with:
          version: 3.2.0
      - run: supabase start -x realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
      - run: supabase test db
      - name: Typy zgodne z migracjami
        run: |
          supabase gen types typescript --schema public > /tmp/types.ts
          diff -u src/types.ts /tmp/types.ts
```

Job działa na main i ręcznie, PR-y zostają szybkie (ADR 0002, narzędzia).

- [ ] **Step 3: W `README.md` dopisz sekcję przed „## Termic”**

```markdown
## Baza danych

Wymagania: Docker i Supabase CLI 3.2.0 (`brew install supabase/tap/supabase`).

| Skrypt | Co robi |
|---|---|
| `pnpm db:start` / `db:stop` / `db:status` | wspólna instancja `sarmata` (API 55421, DB 55422, Studio 55423, Mailpit 55424) |
| `pnpm db:reset` | migracje od zera i dane demo |
| `pnpm db:test` | testy pgTAP |
| `pnpm db:types` | typy do `database/src/types.ts` po każdej migracji |

Konta demo (hasło `Haslo-Demo-2026`): `admin@kropka.test`, `kadry@kropka.test`, `oceniajacy@kropka.test`.
```

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/termic-setup.sh .github/workflows/ci.yml README.md
rtk git commit -m "chore(db): termic setup starts shared supabase, ci job for pgtap and types"
```

---

## Walidacja końcowa (raz, po wszystkich zadaniach)

1. `rtk pnpm db:reset && rtk pnpm db:test`: 7 testów pgTAP PASS.
2. `rtk pnpm db:types && rtk git diff --exit-code database/src/types.ts`: brak różnic.
3. `rtk pnpm check`: PASS (typecheck obejmuje `@sarmata/database`).
4. Logowanie kontem demo i claim w JWT:

```bash
cd database && KEY=$(supabase status -o json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("PUBLISHABLE_KEY") or d["ANON_KEY"])') && cd ..
curl -s "http://127.0.0.1:55421/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H 'Content-Type: application/json' \
  -d '{"email":"kadry@kropka.test","password":"Haslo-Demo-2026"}' \
  | python3 -c 'import json,sys,base64; t=json.load(sys.stdin)["access_token"].split(".")[1]; c=json.loads(base64.urlsafe_b64decode(t+"="*(-len(t)%4))); print(c["office_id"], c["office_role"])'
```

Expected: `11111111-1111-4111-8111-111111111111 hr`.

5. `docker ps --format '{{.Names}}' | grep -c _sarmata` większe od zera, a kontenery `_trainage` nietknięte.

Następny plan: `2026-11-21-fundament-3-backend.md` (domain: wersje przepisów i strategie terminów, repositories, services, worker, klient AI).
