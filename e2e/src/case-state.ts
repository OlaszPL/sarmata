import { readFileSync } from 'node:fs';
import { DEMO_PASSWORD, demoAccount } from './demo-accounts';

interface SupabaseSettings {
  readonly url: string;
  readonly key: string;
}

/** Address and publishable key of the local Supabase, from the shell or from `frontend/web/.env.local`. */
function supabaseSettings(): SupabaseSettings {
  const fromEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
  if (fromEnv.url && fromEnv.key) return { url: fromEnv.url, key: fromEnv.key };
  const file = readFileSync(new URL('../../frontend/web/.env.local', import.meta.url), 'utf8');
  const value = (name: string): string => {
    const line = file.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
    if (line === undefined) throw new Error(`${name} is missing, run "pnpm web:env"`);
    return line.slice(name.length + 1).trim();
  };
  return { url: value('SUPABASE_URL'), key: value('SUPABASE_PUBLISHABLE_KEY') };
}

/** The date of today in Warsaw shifted by `days`, as `YYYY-MM-DD`. */
export function isoDaysFromToday(days: number): string {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

interface Rest {
  get<T>(path: string): Promise<T>;
  patch(path: string, body: unknown): Promise<void>;
  rpc(name: string, body: unknown): Promise<void>;
}

async function ensureOk(response: Response, what: string): Promise<void> {
  if (!response.ok)
    throw new Error(`${what} failed (${String(response.status)}): ${await response.text()}`);
}

/** REST client of the local Supabase signed in with a demo account, so RLS applies. */
async function restAs(email: string): Promise<Rest> {
  const { url, key } = supabaseSettings();
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  await ensureOk(login, `Sign in as ${email}`);
  const { access_token: token } = (await login.json()) as { access_token?: string };
  if (token === undefined) throw new Error(`Cannot sign in as ${email}`);
  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  return {
    async get<T>(path: string): Promise<T> {
      const response = await fetch(`${url}/rest/v1/${path}`, { headers });
      await ensureOk(response, `GET ${path}`);
      return (await response.json()) as T;
    },
    async patch(path: string, body: unknown): Promise<void> {
      const response = await fetch(`${url}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });
      await ensureOk(response, `PATCH ${path}`);
    },
    async rpc(name: string, body: unknown): Promise<void> {
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await ensureOk(response, `RPC ${name}`);
    },
  };
}

interface SheetRow {
  id: string;
  content: { partTwo?: Record<string, unknown> } & Record<string, unknown>;
}

/**
 * The evaluation of the employee in the `drafted` status. An evaluation still in `interview` gets its
 * IPRZ conclusions and the sheet is approved first, as the evaluator would do it. An evaluation that
 * is already `drafted` is only returned.
 */
export async function draftedEvaluationOf(employeeEmail: string): Promise<string> {
  const rest = await restAs(demoAccount('evaluator').email);
  const [employee] = await rest.get<{ id: string }[]>(
    `employees?select=id&email=eq.${encodeURIComponent(employeeEmail)}`,
  );
  if (employee === undefined) throw new Error(`No employee ${employeeEmail}`);
  const [evaluation] = await rest.get<{ id: string; status: string }[]>(
    `evaluations?select=id,status&employee_id=eq.${employee.id}&status=in.(interview,drafted)`,
  );
  if (evaluation === undefined) {
    throw new Error(`${employeeEmail} has no evaluation in interview or drafted`);
  }
  if (evaluation.status === 'drafted') return evaluation.id;

  const [sheet] = await rest.get<SheetRow[]>(
    `evaluation_sheets?select=id,content&evaluation_id=eq.${evaluation.id}&state=eq.draft`,
  );
  if (sheet === undefined) throw new Error(`No draft sheet for evaluation ${evaluation.id}`);
  const content = {
    ...sheet.content,
    partTwo: {
      ...sheet.content.partTwo,
      developmentConclusions: 'Szkolenie z zarządzania projektami w ciągu roku.',
    },
  };
  await rest.patch(`evaluation_sheets?id=eq.${sheet.id}`, { content });
  await rest.rpc('apply_evaluation_transition', {
    p_evaluation_id: evaluation.id,
    p_expected_status: 'interview',
    p_next_status: 'drafted',
    p_event_kind: 'sheet_approved',
    p_occurred_on: isoDaysFromToday(0),
    p_payload: {},
    p_lock_sheet: true,
  });
  return evaluation.id;
}
