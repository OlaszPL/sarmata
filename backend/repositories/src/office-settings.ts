import {
  type EvaluationVisibility,
  type EvaluatorFlagThresholds,
  type OfficeSettingsPatch,
} from '@sarmata/domain';
import { readAccountClaims } from './auth';
import { type Db } from './db';
import { RepositoryError } from './errors';

/** Ustawienia urzędu. The SMTP password is never part of it, only whether it is set. */
export interface OfficeSettings {
  readonly officeId: string;
  readonly aiEnabled: boolean;
  readonly notesRetentionMonths: number;
  readonly reminderLeadDays: number[];
  readonly evaluationVisibility: EvaluationVisibility;
  /** Default place (miejscowość) of evaluation events. */
  readonly defaultPlace: string | null;
  /** Office override of the objection addressee on sheet A, `null` means the rules text. */
  readonly objectionAddresseeSheetA: string | null;
  /** Thresholds of the evaluator flags in the statistics. */
  readonly evaluatorFlags: EvaluatorFlagThresholds;
  readonly smtp: {
    readonly host: string | null;
    readonly port: number | null;
    readonly user: string | null;
    readonly from: string | null;
    readonly passwordSet: boolean;
  };
}

export interface OfficeSettingsRepository {
  /** Settings of the signed-in office, every member reads them. */
  get(): Promise<OfficeSettings | null>;
  /** `null` when the client may not change them (admin only). The two tables are written one after another. */
  update(patch: OfficeSettingsPatch): Promise<OfficeSettings | null>;
  /** Admin only, the password goes to Supabase Vault. A denied call fails with code 42501. */
  setSmtpPassword(password: string): Promise<void>;
}

const COLUMNS =
  'office_id, ai_enabled, notes_retention_months, reminder_lead_days, smtp_host, smtp_port, smtp_user, smtp_from, smtp_password_set, default_place, objection_addressee_sheet_a, evaluator_flag_min_evaluations, evaluator_flag_central_share, evaluator_flag_leniency_points, offices(evaluation_visibility)' as const;

const asVisibility = (value: string | undefined): EvaluationVisibility =>
  value === 'tree' ? 'tree' : 'office';

interface SettingsRow {
  office_id: string;
  ai_enabled: boolean;
  notes_retention_months: number;
  reminder_lead_days: number[];
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_from: string | null;
  smtp_password_set: boolean | null;
  default_place: string | null;
  objection_addressee_sheet_a: string | null;
  evaluator_flag_min_evaluations: number;
  evaluator_flag_central_share: number;
  evaluator_flag_leniency_points: number;
  offices: { evaluation_visibility: string } | null;
}

const toSettings = (row: SettingsRow): OfficeSettings => ({
  officeId: row.office_id,
  aiEnabled: row.ai_enabled,
  notesRetentionMonths: row.notes_retention_months,
  reminderLeadDays: row.reminder_lead_days,
  evaluationVisibility: asVisibility(row.offices?.evaluation_visibility),
  defaultPlace: row.default_place,
  objectionAddresseeSheetA: row.objection_addressee_sheet_a,
  evaluatorFlags: {
    minEvaluations: row.evaluator_flag_min_evaluations,
    centralShare: row.evaluator_flag_central_share,
    leniencyPoints: row.evaluator_flag_leniency_points,
  },
  smtp: {
    host: row.smtp_host,
    port: row.smtp_port,
    user: row.smtp_user,
    from: row.smtp_from,
    passwordSet: row.smtp_password_set ?? false,
  },
});

interface SettingsColumns {
  ai_enabled?: boolean;
  notes_retention_months?: number;
  reminder_lead_days?: number[];
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_from?: string | null;
  default_place?: string | null;
  objection_addressee_sheet_a?: string | null;
  evaluator_flag_min_evaluations?: number;
  evaluator_flag_central_share?: number;
  evaluator_flag_leniency_points?: number;
}

function toColumns(patch: OfficeSettingsPatch): SettingsColumns {
  const columns: SettingsColumns = {};
  if (patch.aiEnabled !== undefined) columns.ai_enabled = patch.aiEnabled;
  if (patch.notesRetentionMonths !== undefined) {
    columns.notes_retention_months = patch.notesRetentionMonths;
  }
  if (patch.reminderLeadDays !== undefined) columns.reminder_lead_days = patch.reminderLeadDays;
  if (patch.smtp?.host !== undefined) columns.smtp_host = patch.smtp.host;
  if (patch.smtp?.port !== undefined) columns.smtp_port = patch.smtp.port;
  if (patch.smtp?.user !== undefined) columns.smtp_user = patch.smtp.user;
  if (patch.smtp?.from !== undefined) columns.smtp_from = patch.smtp.from;
  if (patch.defaultPlace !== undefined) columns.default_place = patch.defaultPlace;
  if (patch.objectionAddresseeSheetA !== undefined) {
    columns.objection_addressee_sheet_a = patch.objectionAddresseeSheetA;
  }
  const flags = patch.evaluatorFlags;
  if (flags?.minEvaluations !== undefined) {
    columns.evaluator_flag_min_evaluations = flags.minEvaluations;
  }
  if (flags?.centralShare !== undefined) columns.evaluator_flag_central_share = flags.centralShare;
  if (flags?.leniencyPoints !== undefined) {
    columns.evaluator_flag_leniency_points = flags.leniencyPoints;
  }
  return columns;
}

export function createOfficeSettingsRepository(db: Db): OfficeSettingsRepository {
  async function officeId(operation: string): Promise<string> {
    const id = (await readAccountClaims(db))?.office_id;
    if (typeof id !== 'string')
      throw new RepositoryError(operation, { message: 'No office in the session' });
    return id;
  }

  async function get(): Promise<OfficeSettings | null> {
    const office = await officeId('officeSettings.get');
    const { data, error } = await db
      .from('office_settings')
      .select(COLUMNS)
      .eq('office_id', office)
      .maybeSingle();
    if (error) throw new RepositoryError('officeSettings.get', error);
    return data === null ? null : toSettings(data);
  }

  return {
    get,

    async update(patch) {
      const office = await officeId('officeSettings.update');
      const columns = toColumns(patch);
      if (Object.keys(columns).length > 0) {
        const { data, error } = await db
          .from('office_settings')
          .update(columns)
          .eq('office_id', office)
          .select('office_id');
        if (error) throw new RepositoryError('officeSettings.update', error);
        if (data.length === 0) return null;
      }
      if (patch.evaluationVisibility !== undefined) {
        const { data, error } = await db
          .from('offices')
          .update({ evaluation_visibility: patch.evaluationVisibility })
          .eq('id', office)
          .select('id');
        if (error) throw new RepositoryError('officeSettings.update', error);
        if (data.length === 0) return null;
      }
      return get();
    },

    async setSmtpPassword(password) {
      const { error } = await db.rpc('set_smtp_password', { p_password: password });
      if (error) throw new RepositoryError('officeSettings.setSmtpPassword', error);
    },
  };
}
