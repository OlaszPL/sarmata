import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AiSuggestion,
  AppShell,
  Button,
  Checkbox,
  DataTable,
  DateInput,
  EmptyState,
  ErrorSummary,
  Field,
  Notice,
  PageHero,
  RadioGroup,
  ScaleChoice,
  Section,
  Select,
  SideTabs,
  StageStrip,
  SummaryList,
  Tag,
  TextInput,
  Textarea,
} from '@sarmata/ui';
import { SiteFooter } from '@/components/shell/site-footer';
import { product } from '@/lib/product';

export const metadata: Metadata = { title: 'Katalog komponentów' };

// Sample content of the catalog only. Real screens take every value from @sarmata/services.
const scale = [
  { value: 1, label: 'Znacznie poniżej' },
  { value: 3, label: 'Poniżej' },
  { value: 5, label: 'Na poziomie' },
  { value: 7, label: 'Powyżej' },
  { value: 9, label: 'Znacznie powyżej' },
];

const rows = [
  { id: '1', name: 'Pracownik A', sheet: 'C', stage: 'Część II' },
  { id: '2', name: 'Pracownik B', sheet: 'B', stage: 'Zapoznanie' },
];

function Sample({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section title={title} titleLevel={2}>
      <div className="flex flex-col gap-6">{children}</div>
    </Section>
  );
}

/** Dev-only catalog of the shared components, so parallel streams see them. 404 in production. */
export default function ComponentCatalogPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <AppShell product={product} footer={<SiteFooter publicOnly />}>
      <div className="border-rule border-b px-6 py-10 sm:px-8">
        <h1 className="text-[2.75rem] leading-[normal] font-semibold">Katalog komponentów</h1>
        <p className="mt-3">
          Komponenty z pakietu <code>@sarmata/ui</code> w stylu Sarmaty. Strona działa tylko w
          trybie deweloperskim.
        </p>
      </div>

      <Sample title="ErrorSummary">
        <ErrorSummary
          title="Zanim zatwierdzisz ocenę, uzupełnij 1 pole"
          errors={[{ fieldId: 'demo-conclusions', message: 'Wpisz wnioski do IPRZ.' }]}
        />
      </Sample>

      <PageHero
        linkAs={Link}
        crumbs={[{ href: '/', label: 'Oceny' }, { label: 'Ocena 2024 do 2026' }]}
        title="Imię Nazwisko"
        meta="Stanowisko, komórka. Status, stopień. Oceniający: imię i nazwisko."
        tags={['Arkusz C', 'Wersja przepisów 2016']}
        stats={[
          { label: 'Wynik na żywo', value: '6,33', hint: 'Powyżej oczekiwań' },
          { label: 'Termin', value: '04.12', hint: 'za 13 dni' },
          { label: 'Etap', value: 'II', hint: 'Część II w trakcie' },
        ]}
      />
      <StageStrip
        stages={[
          { label: 'Kryteria', date: '05.12.2024', state: 'done' },
          { label: 'Podpis części I', date: '12.12.2024', state: 'done' },
          { label: 'Okres oceny', date: 'do 18.11.2026', state: 'done' },
          { label: 'Część II', date: 'w trakcie', state: 'current' },
          { label: 'Zapoznanie', date: 'Jeszcze niedostępne', state: 'next' },
          { label: 'Czas na sprzeciw', date: '7 dni po zapoznaniu', state: 'next' },
          { label: 'Zamknięta', date: 'Jeszcze niedostępne', state: 'next' },
        ]}
        className="border-rule border-b"
      />

      <div className="flex flex-col lg:flex-row">
        <SideTabs
          linkAs={Link}
          className="border-rule border-b lg:w-[13.0625rem] lg:shrink-0 lg:border-r lg:border-b-0"
          items={[
            { href: '#przeglad', label: 'Przegląd sprawy', current: false },
            {
              href: '#czesc-1',
              label: 'Część I',
              hint: 'Kryteria i termin',
              done: true,
              current: false,
            },
            { href: '#czesc-2', label: 'Część II', hint: 'Ocena', current: true },
            { href: '#dziennik', label: 'Dziennik', hint: '14 wpisów', current: false },
          ]}
        />
        <div className="min-w-0 flex-1">
          <Sample title="Button">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Zapisz zmiany</Button>
              <Button variant="secondary">Przejrzyj propozycje</Button>
              <Button variant="danger">Przerwij ocenę</Button>
              <Button variant="link">Wróć do pulpitu</Button>
              <Button size="lg">Sprawdź i zatwierdź ocenę</Button>
            </div>
          </Sample>
          <Sample title="Pola formularza">
            <Field id="demo-name" label="Miejscowość" hint="Pojawi się w nagłówku arkusza.">
              <TextInput name="place" />
            </Field>
            <Field id="demo-date" label="Data rozmowy oceniającej" error="Wpisz datę rozmowy.">
              <DateInput name="date" />
            </Field>
            <Field id="demo-conclusions" label="Wnioski do IPRZ" optional>
              <Textarea name="conclusions" maxLength={2000} showCount />
            </Field>
            <Field id="demo-select" label="Kryterium">
              <Select name="criterion" defaultValue="">
                <option value="">Wybierz kryterium</option>
                <option value="a">Komunikacja</option>
              </Select>
            </Field>
            <RadioGroup
              name="demo-change"
              legend="Czy zmiana stanowiska jest istotna?"
              inline
              options={[
                { value: 'yes', label: 'Tak' },
                { value: 'no', label: 'Nie' },
              ]}
            />
            <Checkbox id="demo-told" name="told" label="Przekazano pracownikowi" />
          </Sample>
          <Sample title="ScaleChoice">
            <ScaleChoice
              name="demo-scale"
              label="Komunikacja"
              options={scale}
              defaultValue={5}
              suggested={7}
            />
          </Sample>
          <Sample title="AiSuggestion">
            <AiSuggestion
              actions={
                <>
                  <Button>Przyjmij 7</Button>
                  <Button variant="secondary">Zostaw 5</Button>
                </>
              }
              sources="Na podstawie 3 notatek."
            >
              AI proponuje 7, powyżej oczekiwań.
            </AiSuggestion>
          </Sample>
          <Sample title="SummaryList">
            <SummaryList
              linkAs={Link}
              rows={[
                { key: 'Data rozmowy', value: '18.11.2026', changeHref: '#demo-date' },
                { key: 'Wnioski do IPRZ', value: 'Brak' },
              ]}
            />
          </Sample>
          <Sample title="DataTable">
            <DataTable
              caption="Oceny w toku"
              rows={rows}
              rowKey={(row) => row.id}
              columns={[
                { key: 'name', header: 'Pracownik', cell: (row) => row.name, rowHeader: true },
                { key: 'sheet', header: 'Arkusz', cell: (row) => row.sheet, className: 'w-24' },
                { key: 'stage', header: 'Etap', cell: (row) => row.stage },
              ]}
            />
          </Sample>
          <Sample title="Tag i Notice">
            <div className="flex flex-wrap gap-2">
              <Tag tone="todo">Do zrobienia</Tag>
              <Tag tone="progress">W toku</Tag>
              <Tag tone="attention">Po terminie</Tag>
              <Tag tone="waiting">Czeka</Tag>
              <Tag tone="done">Zamknięta</Tag>
              <Tag tone="neutral">Arkusz C</Tag>
            </div>
            <Notice tone="info" title="AI jest wyłączone w ustawieniach urzędu">
              Możesz pracować bez sugestii.
            </Notice>
            <Notice tone="warning">Stopień należy się z mocy prawa.</Notice>
            <Notice tone="success" title="Zapisano">
              Zmiany są zapisane.
            </Notice>
            <Notice tone="error" title="Nie udało się zapisać">
              Spróbuj ponownie.
            </Notice>
          </Sample>
          <Section title="EmptyState" flush>
            <EmptyState title="Brak ocen" action={<Button>Rozpocznij ocenę</Button>}>
              Ten pracownik nie ma jeszcze ocen. Zacznij od nowej oceny.
            </EmptyState>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
