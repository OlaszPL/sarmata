import { type EvaluationEventKind } from '@sarmata/services';

/** Polish names of the journal entries of an evaluation, without grammatical gender. */
export const eventLabels: Record<EvaluationEventKind, string> = {
  created: 'Ocena rozpoczęta',
  part_one_approved: 'Część I zatwierdzona',
  part_one_signed: 'Podpis części I odnotowany',
  evaluation_interview_held: 'Rozmowa oceniająca odnotowana',
  sheet_approved: 'Arkusz zatwierdzony',
  acquainted: 'Zapoznanie z oceną odnotowane',
  signature_refused: 'Odmowa podpisu odnotowana',
  closed: 'Ocena zamknięta',
  objection_filed: 'Sprzeciw wniesiony',
  objection_outcome: 'Sprzeciw rozpatrzony',
  absence: 'Nieobecność odnotowana',
  term_changed: 'Termin oceny zmieniony',
  evaluator_changed: 'Osoba oceniająca zmieniona',
  position_changed: 'Zmiana stanowiska odnotowana',
  correction: 'Arkusz skorygowany',
  interrupted: 'Ocena przerwana',
  labour_court_appeal: 'Odwołanie do sądu pracy odnotowane',
};

export function eventLabel(kind: EvaluationEventKind): string {
  return eventLabels[kind];
}
