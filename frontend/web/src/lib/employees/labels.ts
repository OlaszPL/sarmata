import {
  type EmploymentBasis,
  type EvaluationStatus,
  type NoteKind,
  type NoteSign,
  type PositionKind,
  type ServiceStatus,
} from '@sarmata/services';

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

/** Short stage names, the same as the strip of the case screens (`caseStages`). */
export const evaluationStatusLabels: Record<EvaluationStatus, string> = {
  criteria: 'Kryteria',
  criteria_awaiting_signature: 'Podpis części I',
  period: 'Okres oceny',
  interview: 'Część II',
  drafted: 'Zapoznanie',
  delivered: 'Czas na sprzeciw',
  objection: 'Sprzeciw',
  closed: 'Zamknięta',
  interrupted: 'Przerwana',
};

export const actionFrameworkLabels: Record<'jd_r' | 'hse', string> = {
  jd_r: 'Model JD-R',
  hse: 'Standardy HSE',
};
