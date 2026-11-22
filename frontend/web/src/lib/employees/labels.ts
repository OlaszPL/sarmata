// Type only: the note form (a client component) reads these labels.
import type {
  EmploymentBasis,
  MemberAccount,
  NoteKind,
  NoteSign,
  PositionKind,
  ServiceStatus,
} from '@sarmata/services';

/** Title of the employee list and the crumb back to it. */
export function employeeListTitle(role: MemberAccount['role']): string {
  return role === 'evaluator' ? 'Moi pracownicy' : 'Pracownicy urzędu';
}

export const positionKindLabels: Record<PositionKind, string> = {
  office_head: 'Kierownik urzędu (arkusz A)',
  manages_people: 'Kieruje ludźmi (arkusz B)',
  other: 'Pozostałe stanowiska (arkusz C)',
};

export const serviceStatusLabels: Record<ServiceStatus, string> = {
  civil_servant: 'Urzędnik służby cywilnej',
  employee: 'Pracownik służby cywilnej',
};

export const employmentBasisLabels: Record<EmploymentBasis, string> = {
  indefinite: 'Umowa na czas nieokreślony',
  appointment: 'Mianowanie',
  fixed_term: 'Umowa na czas określony',
};

export const noteKindLabels: Record<NoteKind, string> = {
  observation: 'Obserwacja',
  ongoing_conversation: 'Rozmowa bieżąca',
  appreciation: 'Docenienie',
  workload_fact: 'Fakt obciążenia',
};

export const noteSignLabels: Record<NoteSign, string> = {
  plus: 'Plus',
  minus: 'Minus',
};

export const hrSignalLabels: Record<
  'sentiment' | 'overload' | 'engagement_drop' | 'burnout_risk',
  string
> = {
  sentiment: 'Negatywny wydźwięk notatek',
  overload: 'Możliwe przeciążenie',
  engagement_drop: 'Spadek zaangażowania',
  burnout_risk: 'Ryzyko wypalenia',
};

export const actionFrameworkLabels: Record<'jd_r' | 'hse', string> = {
  jd_r: 'Model JD-R',
  hse: 'Standardy HSE',
};
