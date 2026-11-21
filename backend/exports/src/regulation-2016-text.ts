import { type TermChangeReason } from '@sarmata/domain';
import { type EvaluationEventKind } from '@sarmata/repositories';

/**
 * Texts of the evaluation sheet forms (zalaczniki 2 do 4) and of the notice (§ 8) as printed in the
 * regulation of 4 April 2016. Copied from `docs/legal/rozporzadzenie-oceny-okresowe-2016.md`.
 * This is the look of the form, not a rule, so it stays out of `rules.json` (ADR 0006). The key is the
 * regulation document id. Another regulation version needs its own entry or the export refuses it.
 */

export type SheetLetter = 'A' | 'B' | 'C';

export type FootnoteKey =
  | 'scope'
  | 'positionTitle'
  | 'additionalCriteria'
  | 'introTalk'
  | 'interviewTalk'
  | 'periodFrom'
  | 'periodTo'
  | 'markX'
  | 'positive'
  | 'negative'
  | 'justification'
  | 'developmentProgram'
  | 'previousOutcome'
  | 'previousLevel'
  | 'objectionAddressee'
  | 'partThree';

export interface FormLabels {
  readonly partOne: string;
  readonly partTwo: string;
  readonly partThree: string;
  readonly office: string;
  readonly evaluatedData: string;
  readonly evaluatorData: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly orgUnit: string;
  readonly position: string;
  readonly criteriaAndDue: string;
  readonly mandatoryCriteria: string;
  readonly additionalCriteria: string;
  readonly dueOn: string;
  readonly noAdditionalCriteria: string;
  readonly confirmation: string;
  readonly placeAndDate: string;
  readonly evaluatorSignature: string;
  readonly evaluatedSignature: string;
  readonly interviewOn: string;
  readonly period: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly criteriaRatings: string;
  readonly criterion: string;
  readonly partialRating: string;
  readonly mean: string;
  readonly overallLevel: string;
  readonly periodicEvaluation: string;
  readonly positive: string;
  readonly negative: string;
  readonly justification: string;
  readonly developmentConclusions: string;
  readonly previousEvaluation: string;
  readonly previousOutcome: string;
  readonly previousLevel: string;
  readonly previousDate: string;
  readonly gradeRequestQuestion: string;
  readonly yes: string;
  readonly no: string;
  readonly notApplicable: string;
  readonly evaluatedAcknowledgement: string;
  readonly instruction: string;
  readonly approvalsHeading: string;
  readonly approvalsIntro: string;
  readonly approvalColumns: readonly [string, string, string, string, string, string];
  readonly attachmentsHeading: string;
  readonly draftMark: string;
  readonly versionLabel: string;
  readonly refusalNote: string;
  readonly witnesses: string;
  readonly civilServantData: string;
  readonly appointmentYear: string;
  readonly currentGrade: string;
  readonly gradeGrantedOn: string;
  readonly gradeRequestHeading: string;
  readonly gradeRequestMotivation: string;
  readonly partThreeIntro: string;
  readonly signatureBoxNote: string;
  readonly approvedInSystem: string;
  readonly noApproval: string;
  readonly noApprovals: string;
  readonly reasonLabel: string;
}

export interface NoticeLabels {
  readonly title: string;
  readonly legalBasis: string;
  readonly addressee: string;
  readonly newDueOn: string;
  readonly reason: string;
  readonly approvalHeading: string;
  readonly copyNote: string;
  readonly signature: string;
}

export interface RegulationText {
  readonly sheetTitle: (sheetId: string) => string;
  readonly labels: FormLabels;
  readonly notice: NoticeLabels;
  /** Footnote texts per sheet letter, only the ones the sheet prints. */
  readonly footnotes: (sheetId: string) => Partial<Record<FootnoteKey, string>>;
  /** Objection notice (pouczenie). Sheet A names the addressee, B and C print the text of the form. */
  readonly objectionNotice: (sheetId: string, addressee: string | null) => string;
  readonly termReasons: Record<TermChangeReason, string>;
  readonly eventLabels: Record<EvaluationEventKind, string>;
}

const SCOPE_A =
  'Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku kierownika urzędu, które jest stanowiskiem pracy w służbie cywilnej.';
// The regulation file quotes only a fragment of the B text, the rest follows the wording of A and C.
const SCOPE_B =
  'Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku, na którym praca polega na bezpośrednim kierowaniu pracownikami, innym niż stanowisko kierownika urzędu.';
const SCOPE_C =
  'Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku, które nie jest: stanowiskiem kierownika urzędu, będącym stanowiskiem pracy w służbie cywilnej, ani stanowiskiem, na którym praca polega na bezpośrednim kierowaniu pracownikami.';

const sharedFootnotes: Partial<Record<FootnoteKey, string>> = {
  additionalCriteria:
    'Należy wpisać nazwy wybranych kryteriów, korzystając z załącznika nr 1 do rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej.',
  introTalk:
    'W trakcie rozmowy omawiane są: 1) główne obowiązki wynikające z opisu stanowiska pracy zajmowanego przez ocenianego, 2) kryteria obowiązkowe i kryteria dodatkowe, jeżeli są wybierane przez oceniającego, 3) oczekiwania oceniającego co do sposobu spełniania kryteriów oceny przez ocenianego, 4) cele do osiągnięcia w okresie, w którym oceniany podlega ocenie, jeżeli ich określenie jest uzasadnione ze względu na charakter obowiązków wynikających z opisu stanowiska pracy zajmowanego przez ocenianego, a także sposób realizacji wyznaczonych celów.',
  interviewTalk:
    'W trakcie rozmowy oceniającej omawia się: 1) główne obowiązki wykonywane przez ocenianego w okresie, w którym podlegał ocenie, oraz sposób ich realizacji, z uwzględnieniem spełniania przez ocenianego ustalonych kryteriów oceny, 2) sposób realizowania przez ocenianego celów do osiągnięcia w okresie, w którym oceniany podlegał ocenie, jeżeli cele te zostały wyznaczone, 3) kierunki dalszego rozwoju zawodowego i potrzeby ocenianego w zakresie podnoszenia kwalifikacji i doskonalenia umiejętności.',
  periodFrom:
    'Data „od” oznacza datę zapoznania ocenianego z kryteriami oceny – z części I arkusza oceny.',
  periodTo:
    'Data „do” oznacza datę sporządzenia oceny na piśmie. Jeżeli ocena okresowa jest sporządzana w związku z zastosowaniem art. 81 ust. 6 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej i nie została sporządzona przed zmianą stanowiska pracy, należy w tym polu wpisać ostatni dzień pracy na zajmowanym stanowisku pracy.',
  markX: 'Należy wstawić znak „X” w odpowiednie pole.',
  positive:
    'POZYTYWNA – w przypadku ustalenia ogólnego poziomu spełniania kryteriów oceny na poziomie „znacznie powyżej oczekiwań”, „powyżej oczekiwań” albo „na poziomie oczekiwań”, pod warunkiem nieuzyskania przez ocenianego żadnej z ocen cząstkowych na poziomie „znacznie poniżej oczekiwań”.',
  negative:
    'NEGATYWNA – w przypadku ustalenia ogólnego poziomu spełniania kryteriów oceny na poziomie „poniżej oczekiwań” albo „znacznie poniżej oczekiwań”, a także w przypadku uzyskania przez ocenianego co najmniej jednej oceny cząstkowej na poziomie „znacznie poniżej oczekiwań”.',
  justification:
    'Uzasadnienie jest obligatoryjne w przypadku otrzymania przez ocenianego negatywnej oceny okresowej. W przypadku przyznania oceny pozytywnej uzasadnienie jest fakultatywne. Sporządzenie uzasadnienia oceny może polegać na ogólnym omówieniu oceny lub na szczegółowym odniesieniu się do wszystkich ocen cząstkowych albo tylko do niektórych z nich.',
  developmentProgram:
    'Uwzględniając sporządzoną ocenę, realizowane i przyszłe zadania oraz oczekiwania ocenianego, należy określić kierunki rozwoju zawodowego ocenianego, biorąc pod uwagę obszary wiedzy i umiejętności wymagające doskonalenia, oraz zaproponować optymalne formy i metody ich realizacji.',
  previousOutcome: 'Należy wpisać „pozytywna” lub „negatywna”.',
  previousLevel:
    'Należy wpisać, na jakim poziomie była przyznana poprzednia ocena okresowa (np. „na poziomie oczekiwań”).',
  partThree:
    'Części III nie drukuje się i nie dołącza do arkusza oceny okresowej w przypadku ocenianego będącego pracownikiem służby cywilnej oraz w razie nieskładania wniosku o przyznanie urzędnikowi służby cywilnej kolejnego stopnia służbowego.',
};

const positionTitleFootnote =
  'Należy wskazać pełną nazwę stanowiska pracy wraz z jego rozszerzeniem określającym, do jakich spraw jest to stanowisko (jeżeli zostało to określone w opisie stanowiska pracy).';
const objectionFootnote =
  'W urzędzie, w którym przepisy nie przewidują tworzenia stanowiska dyrektora generalnego urzędu, sprzeciw składa się do kierownika tego urzędu.';

export const regulation2016Text: RegulationText = {
  sheetTitle: (sheetId) =>
    `ARKUSZ ${sheetId}. OCENA OKRESOWA URZĘDNIKA SŁUŻBY CYWILNEJ LUB PRACOWNIKA SŁUŻBY CYWILNEJ`,
  labels: {
    partOne: 'CZĘŚĆ I',
    partTwo: 'CZĘŚĆ II',
    partThree: 'CZĘŚĆ III',
    office: 'NAZWA URZĘDU',
    evaluatedData: 'DANE OCENIANEGO',
    evaluatorData: 'DANE OCENIAJĄCEGO',
    firstName: 'Imię',
    lastName: 'Nazwisko',
    orgUnit: 'Komórka organizacyjna',
    position: 'Stanowisko pracy',
    criteriaAndDue: 'KRYTERIA OCENY I TERMIN SPORZĄDZENIA OCENY',
    mandatoryCriteria: 'Kryteria obowiązkowe',
    additionalCriteria: 'Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3)',
    dueOn: 'Termin sporządzenia oceny',
    noAdditionalCriteria: 'brak',
    confirmation:
      'Potwierdzamy: przeprowadzenie rozmowy, o której mowa w § 5 ust. 1 rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej, i omówienie w trakcie tej rozmowy wszystkich wymaganych zagadnień oraz zapoznanie ocenianego z kryteriami oceny oraz terminem sporządzenia oceny.',
    placeAndDate: 'Miejscowość, data',
    evaluatorSignature: 'podpis oceniającego',
    evaluatedSignature: 'podpis ocenianego',
    interviewOn: 'DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ',
    period: 'OKRES, W KTÓRYM OCENIANY PODLEGAŁ OCENIE',
    periodFrom: 'od',
    periodTo: 'do',
    criteriaRatings: 'KRYTERIA OBOWIĄZKOWE I KRYTERIA DODATKOWE WYBRANE PRZEZ OCENIAJĄCEGO',
    criterion: 'Kryterium',
    partialRating: 'OCENA CZĄSTKOWA',
    mean: 'Średnia arytmetyczna z ocen cząstkowych przyznanych za poszczególne kryteria oceny',
    overallLevel: 'PRZYZNANIE OCENY',
    periodicEvaluation: 'OCENA OKRESOWA W SŁUŻBIE CYWILNEJ',
    positive: 'POZYTYWNA',
    negative: 'NEGATYWNA',
    justification: 'UZASADNIENIE PRZYZNANEJ OCENY OKRESOWEJ',
    developmentConclusions: 'WNIOSKI DOTYCZĄCE INDYWIDUALNEGO PROGRAMU ROZWOJU ZAWODOWEGO',
    previousEvaluation: 'DANE DOTYCZĄCE POPRZEDNIEJ OCENY OKRESOWEJ URZĘDNIKA SŁUŻBY CYWILNEJ',
    previousOutcome: 'Ocena',
    previousLevel: 'Poziom',
    previousDate: 'Data sporządzenia',
    gradeRequestQuestion:
      'CZY DO OCENY OKRESOWEJ DOŁĄCZONO WNIOSEK O PRZYZNANIE KOLEJNEGO STOPNIA SŁUŻBOWEGO?',
    yes: 'TAK',
    no: 'NIE',
    notApplicable: 'NIE DOTYCZY',
    evaluatedAcknowledgement:
      'Przeprowadzono ze mną rozmowę oceniającą oraz zapoznałem(-łam) się z oceną okresową i wnioskami dotyczącymi indywidualnego programu rozwoju zawodowego.',
    instruction: 'Pouczenie',
    approvalsHeading: 'Zatwierdzenia w systemie',
    approvalsIntro:
      'Zamiast podpisu odręcznego dokument pokazuje zatwierdzenia zapisane w dzienniku zdarzeń systemu. Każdy wpis ma konto, czas zapisu, wersję arkusza i skrót SHA-256 jej treści. Dziennik jest dopisywany i nie podlega zmianom (ADR 0007).',
    approvalColumns: ['Czynność', 'Data zdarzenia', 'Czas wpisu', 'Konto', 'Wersja', 'SHA-256'],
    attachmentsHeading: 'Załączniki: zawiadomienia o zmianie terminu',
    draftMark: 'PROJEKT',
    versionLabel: 'Wersja arkusza',
    refusalNote: 'Notatka o odmowie podpisu',
    witnesses: 'Świadkowie',
    civilServantData: 'DANE URZĘDNIKA SŁUŻBY CYWILNEJ',
    appointmentYear: 'Rok mianowania',
    currentGrade: 'Posiadany stopień służbowy',
    gradeGrantedOn: 'Data przyznania stopnia służbowego',
    gradeRequestHeading:
      'WNIOSEK O PRZYZNANIE URZĘDNIKOWI SŁUŻBY CYWILNEJ KOLEJNEGO STOPNIA SŁUŻBOWEGO',
    gradeRequestMotivation: 'Umotywowanie wniosku',
    partThreeIntro:
      'Wniosek jest wypełniany i dołączany do arkusza oceny okresowej ocenianego tylko w sytuacji skorzystania przez oceniającego z możliwości przewidzianej w art. 89 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej.',
    signatureBoxNote: 'Podpis odręczny (dla urzędów, które drukują dokument)',
    approvedInSystem: 'zatwierdzono w systemie',
    noApproval: 'brak zatwierdzenia',
    noApprovals: 'Brak zatwierdzeń dla tej wersji arkusza.',
    reasonLabel: 'Powód',
  },
  notice: {
    title: 'Zawiadomienie o zmianie terminu sporządzenia oceny okresowej',
    legalBasis:
      'Podstawa prawna: art. 81 ust. 8 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej oraz § 8 rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej.',
    addressee: 'Adresat',
    newDueOn: 'Nowy termin sporządzenia oceny na piśmie',
    reason: 'Przyczyna zmiany terminu',
    approvalHeading: 'Zatwierdzenie w systemie',
    copyNote: 'Kopię zawiadomienia dołącza się do arkusza.',
    signature: 'podpis oceniającego',
  },
  footnotes: (sheetId) => {
    const scope = sheetId === 'A' ? SCOPE_A : sheetId === 'B' ? SCOPE_B : SCOPE_C;
    return {
      ...sharedFootnotes,
      scope,
      ...(sheetId === 'A' ? {} : { positionTitle: positionTitleFootnote }),
      ...(sheetId === 'A' ? {} : { objectionAddressee: objectionFootnote }),
    };
  },
  objectionNotice: (sheetId, addressee) =>
    sheetId === 'A'
      ? `Na podstawie art. 83 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do: ${addressee ?? '......'}.`
      : 'Zgodnie z art. 83 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do dyrektora generalnego urzędu.',
  termReasons: {
    evaluatorChange: 'zmiana oceniającego',
    expectedAbsenceOfEvaluated: 'przewidywana nieobecność ocenianego',
    expectedAbsenceOfEvaluator: 'przewidywana nieobecność oceniającego',
    requestOfEvaluated: 'wniosek ocenianego',
  },
  eventLabels: {
    created: 'Rozpoczęcie oceny',
    part_one_approved: 'Zatwierdzenie części I przez oceniającego',
    part_one_signed: 'Potwierdzenie części I przez ocenianego',
    evaluation_interview_held: 'Rozmowa oceniająca',
    sheet_approved: 'Zatwierdzenie oceny przez oceniającego',
    acquainted: 'Zapoznanie ocenianego z oceną',
    signature_refused: 'Odmowa podpisu przy zapoznaniu z oceną',
    closed: 'Zamknięcie oceny',
    objection_filed: 'Wniesienie sprzeciwu',
    objection_outcome: 'Rozstrzygnięcie sprzeciwu',
    absence: 'Nieobecność',
    term_changed: 'Zmiana terminu sporządzenia oceny',
    evaluator_changed: 'Zmiana oceniającego',
    position_changed: 'Zmiana stanowiska',
    correction: 'Korekta arkusza',
    interrupted: 'Przerwanie oceny',
    labour_court_appeal: 'Odwołanie do sądu pracy',
  },
};

/** Form texts per regulation document id. */
export const regulationTexts: Readonly<Record<string, RegulationText>> = {
  'regulation-2016': regulation2016Text,
};
