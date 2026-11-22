import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageHero, Section } from '@sarmata/ui';

const linkClasses = 'font-heading text-link leading-[normal] font-medium underline';
const RPO_URL = 'https://bip.brpo.gov.pl/';

/** Dates of the statement as `rrrr-mm-dd`, the format the technical conditions require. */
const dates = {
  published: '2026-11-21',
  updated: '2026-11-22',
  prepared: '2026-11-21',
  reviewed: '2026-11-22',
} as const;

function IsoDate({ id, value }: { id: string; value: string }) {
  return (
    <span id={id}>
      <time dateTime={value}>{value}</time>
    </span>
  );
}

function Prose({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="max-w-[70ch]">
      {children}
    </p>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="font-heading mt-6 mb-2 text-xl font-semibold">{children}</h3>;
}

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="mt-2 mb-4 max-w-[70ch] list-disc space-y-2 pl-6 last:mb-0">{children}</ul>;
}

/**
 * Accessibility statement after the Ministry of Digital Affairs template (art. 10 of the digital
 * accessibility act), with the `a11y-*` ids of the technical conditions v2.0.
 */
export function Statement({ officeName }: { officeName: string | null }) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHero title="Deklaracja dostępności" />
      <div className="space-y-0 [&_p+p]:mt-4">
        <Section title="Wstęp">
          <Prose id="a11y-wstep">
            <span id="a11y-podmiot">{officeName ?? 'Urząd korzystający z aplikacji'}</span>{' '}
            zobowiązuje się zapewnić dostępność cyfrową aplikacji Sarmata zgodnie z ustawą z dnia 4
            kwietnia 2019 r. o dostępności cyfrowej stron internetowych i aplikacji mobilnych
            podmiotów publicznych.
          </Prose>
          <Prose>
            Adres aplikacji:{' '}
            <Link id="a11y-url" href="/" className={linkClasses}>
              Sarmata, cyfrowy asystent ocen okresowych
            </Link>
            .
          </Prose>
        </Section>

        <Section title="Daty">
          <Prose>
            Data publikacji aplikacji: <IsoDate id="a11y-data-publikacja" value={dates.published} />
          </Prose>
          <Prose>
            Data ostatniej istotnej aktualizacji:{' '}
            <IsoDate id="a11y-data-aktualizacja" value={dates.updated} />
          </Prose>
        </Section>

        <Section title="Stan dostępności cyfrowej">
          <Prose id="a11y-status">
            Aplikacja jest częściowo zgodna z ustawą o dostępności cyfrowej stron internetowych i
            aplikacji mobilnych podmiotów publicznych z powodu niezgodności lub wyłączeń
            wymienionych poniżej.
          </Prose>
          <SubHeading>Treści niedostępne</SubHeading>
          <BulletList>
            <li>Pliki PDF i DOCX arkusza nie przeszły jeszcze pełnego przeglądu dostępności.</li>
            <li>Odpowiedzi AI powstają automatycznie i mogą mieć niejasną strukturę.</li>
          </BulletList>
          <SubHeading>Wyłączenia</SubHeading>
          <Prose>Brak.</Prose>
        </Section>

        <Section title="Przygotowanie deklaracji">
          <Prose>
            Data sporządzenia deklaracji:{' '}
            <IsoDate id="a11y-data-sporzadzenie" value={dates.prepared} />
          </Prose>
          <Prose>
            Data ostatniego przeglądu deklaracji:{' '}
            <IsoDate id="a11y-data-przeglad" value={dates.reviewed} />
          </Prose>
          <Prose id="a11y-ocena">
            Deklarację sporządzono na podstawie samooceny przeprowadzonej przez zespół, który tworzy
            aplikację. Każdy ekran sprawdzamy automatycznie narzędziem axe pod kątem WCAG 2.1 AA i
            ręcznie z klawiaturą.
          </Prose>
        </Section>

        <Section title="Skróty klawiaturowe">
          <Prose>
            Aplikacja nie ma własnych skrótów klawiaturowych. Działają standardowe skróty
            przeglądarki. Pierwszy klawisz Tab pokazuje link „Przejdź do treści”.
          </Prose>
        </Section>

        <Section title="Udogodnienia">
          <BulletList>
            <li>
              W nagłówku jest przycisk powiększenia tekstu (A+) i przełącznik wysokiego kontrastu.
            </li>
            <li>Szerokość treści jest ograniczona, więc wiersze tekstu pozostają czytelne.</li>
            <li>
              Błędy formularza zbiera podsumowanie na górze strony, z odnośnikami do pól, których
              dotyczą.
            </li>
          </BulletList>
        </Section>

        <Section
          title={<span id="a11y-kontakt">Informacje zwrotne i dane kontaktowe</span>}
          id="kontakt"
        >
          <Prose>
            Jeśli napotkasz barierę, napisz do osoby, która koordynuje sprawy dostępności w twoim
            urzędzie. Jej dane kontaktowe są w deklaracji dostępności urzędu, opublikowanej w jego
            BIP.
          </Prose>
          <Prose>
            Masz prawo zgłosić brak dostępności cyfrowej aplikacji lub jej elementu. Sposób
            postępowania opisuje następna sekcja.
          </Prose>
        </Section>

        <Section
          title={<span id="a11y-procedura">Procedura wnioskowo-skargowa</span>}
          id="procedura"
        >
          <Prose>
            Możesz zażądać zapewnienia dostępności cyfrowej aplikacji Sarmata lub jej elementu.
            Jeśli urząd nie może zapewnić dostępności elementu, możesz zażądać udostępnienia go w
            alternatywny sposób.
          </Prose>
          <Prose>Żądanie zawiera:</Prose>
          <BulletList>
            <li>dane kontaktowe osoby, która występuje z żądaniem,</li>
            <li>wskazanie aplikacji lub jej elementu, który ma być dostępny cyfrowo,</li>
            <li>wskazanie sposobu kontaktu z Tobą,</li>
            <li>wskazanie alternatywnego sposobu dostępu, jeśli dotyczy.</li>
          </BulletList>
          <Prose>
            Urząd zapewnia dostępność bez zbędnej zwłoki, najpóźniej w ciągu 7 dni od dnia
            wystąpienia z żądaniem.
          </Prose>
          <Prose>
            Jeśli nie może tego zrobić w tym terminie, niezwłocznie powiadamia Cię o przyczynach
            opóźnienia i o terminie, w którym zapewni dostępność. Ten termin nie może być dłuższy
            niż dwa miesiące od dnia wystąpienia z żądaniem.
          </Prose>
          <Prose>
            Urząd odmawia zapewnienia dostępności, jeśli groziłoby to naruszeniem integralności lub
            wiarygodności przekazywanych informacji. Gdy urząd nie może zapewnić dostępności
            elementu, niezwłocznie powiadamia Cię o przyczynach i wskazuje alternatywny sposób
            dostępu do niego.
          </Prose>
          <Prose>
            Jeśli urząd odmówi zapewnienia dostępności albo odmówisz skorzystania z alternatywnego
            sposobu dostępu, możesz złożyć skargę do urzędu. Skargi rozpatruje się według przepisów
            działu VIII Kodeksu postępowania administracyjnego.
          </Prose>
          <Prose>
            Gdy skarga nie przyniesie rozstrzygnięcia, możesz złożyć wniosek do{' '}
            <a id="a11y-rpo" href={RPO_URL} className={linkClasses}>
              Rzecznika Praw Obywatelskich
            </a>
            .
          </Prose>
        </Section>

        <Section
          title={<span id="a11y-architektura">Dostępność architektoniczna</span>}
          id="architektura"
        >
          <Prose>
            Aplikacja działa w sieci urzędu. Opis dostępności architektonicznej budynków jest w
            deklaracji dostępności urzędu.
          </Prose>
        </Section>

        <Section
          title={<span id="a11y-komunikacja">Tłumacz języka migowego</span>}
          id="komunikacja"
        >
          <Prose>
            Aplikacja nie ma tłumacza języka migowego online. Informację o tłumaczu przy kontakcie z
            urzędem podaje deklaracja urzędu.
          </Prose>
        </Section>

        <Section title="Aplikacje mobilne">
          <Prose>Sarmata nie ma aplikacji mobilnej.</Prose>
        </Section>
      </div>
    </div>
  );
}
