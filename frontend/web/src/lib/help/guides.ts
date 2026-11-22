import { type OfficeRole } from '@sarmata/services';
import { routes } from '@/lib/routes';

export interface GuideStep {
  title: string;
  body: string;
  link?: { href: string; label: string };
}

export interface Guide {
  id: 'oceniajacy' | 'kadry';
  title: 'Dla oceniającego' | 'Dla kadr';
  intro: string;
  steps: GuideStep[];
}

/**
 * Step by step guides of the evaluation process (docs/funkcjonalnosci.md, "Stany oceny"). The text is
 * documentation, not data of the office, so it lives here.
 */
export const guides: readonly Guide[] = [
  {
    id: 'oceniajacy',
    title: 'Dla oceniającego',
    intro: 'Tak prowadzisz ocenę okresową od pierwszej rozmowy do zamknięcia.',
    steps: [
      {
        title: 'Rozpocznij ocenę',
        body: 'Wybierz osobę, którą oceniasz. Aplikacja ustawi okres oceny i terminy kolejnych kroków.',
        link: { href: routes.newEvaluation, label: 'Rozpocznij ocenę' },
      },
      {
        title: 'Ustal kryteria w części I i odnotuj rozmowę rozpoczynającą',
        body: 'Dobierz kryteria dodatkowe i zatwierdź część I po rozmowie rozpoczynającej. Masz na to 30 dni, a po ocenie negatywnej 7.',
      },
      {
        title: 'Zapisuj notatki przez cały okres',
        body: 'Zapisuj obserwacje, rozmowy bieżące i docenienia od razu po zdarzeniu. Notatki są podstawą uzasadnienia oceny i szkicu AI.',
        link: { href: routes.notes, label: 'Przejdź do notatek' },
      },
      {
        title: 'Wypełnij część II, możesz poprosić o szkic AI',
        body: 'Po odnotowaniu rozmowy oceniającej oceń każde kryterium i wpisz uzasadnienie oraz wnioski. Każdą sugestię AI przyjmujesz albo odrzucasz osobno.',
      },
      {
        title: 'Sprawdź arkusz i zatwierdź do zapoznania',
        body: 'Aplikacja pokaże wynik i braki, które blokują zatwierdzenie. Po zatwierdzeniu część II się blokuje, a ocena czeka na zapoznanie osoby ocenianej.',
      },
      {
        title: 'Odnotuj zapoznanie albo odmowę podpisu',
        body: 'Wpisz datę, w której osoba oceniana zapoznała się z oceną. Przy odmowie podpisu dodaj notatkę i świadków.',
      },
      {
        title: 'Poczekaj na koniec czasu na sprzeciw',
        body: 'Osoba oceniana ma 7 dni od zapoznania na sprzeciw. Bez sprzeciwu ocena zamyka się po tym terminie i staje się ostateczna.',
      },
    ],
  },
  {
    id: 'kadry',
    title: 'Dla kadr',
    intro: 'Tak wspierasz oceny w urzędzie i pilnujesz terminów po stronie kadr.',
    steps: [
      {
        title: 'Pilnuj terminów w powiadomieniach',
        body: 'Aplikacja codziennie zbiera terminy: oceny po terminie, sprzeciwy do rozpatrzenia i stopnie z mocy prawa.',
        link: { href: routes.notifications, label: 'Otwórz powiadomienia' },
      },
      {
        title: 'Zmieniaj oceniającego i odnotowuj nieobecności w zdarzeniach sprawy',
        body: 'Zmianę osoby oceniającej i długotrwałą nieobecność wpisz w zakładce Zdarzenia sprawy. Nieobecność wstrzymuje albo przesuwa termin.',
      },
      {
        title: 'Rozpatrz sprzeciw w 14 dni',
        body: 'Wpisz sprzeciw z datą, wniesiony w 7 dni od zapoznania. Dyrektor generalny ma 14 dni, wynik to nieuwzględnienie, zmiana oceny albo ponowne sporządzenie.',
      },
      {
        title: 'Przyznaj stopień z mocy prawa',
        body: 'Po dwóch kolejnych ocenach na dwóch najwyższych poziomach masz 30 dni na przyznanie wyższego stopnia. Zadanie zamyka się po wpisie przyznania.',
      },
      {
        title: 'Przy ustaniu zatrudnienia pobierz archiwum teczek na karcie pracownika',
        body: 'Po wpisaniu daty ustania zatrudnienia karta pracownika daje archiwum ZIP z teczkami wszystkich ocen tej osoby.',
        link: { href: routes.employees, label: 'Przejdź do pracowników' },
      },
    ],
  },
];

/** Guides of the role, its own first. The admin sees both in the default order. */
export function guidesFor(role: OfficeRole): readonly Guide[] {
  if (role === 'admin') return guides;
  const own = role === 'hr' ? 'kadry' : 'oceniajacy';
  return [...guides].sort((a, b) => Number(b.id === own) - Number(a.id === own));
}
