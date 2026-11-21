import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Deklaracja dostępności' };

export default function AccessibilityStatementPage() {
  return (
    <article className="px-8 py-10">
      <h1 className="font-heading text-[2.75rem] font-semibold">Deklaracja dostępności</h1>
      <div className="mt-6 max-w-prose space-y-4">
        <p>
          Aplikacja Sarmata ma spełniać wymagania WCAG 2.1 na poziomie AA. Dotyczy to nawigacji
          klawiaturą, kontrastu, czytników ekranu i powiększania tekstu.
        </p>
        <p>Deklarację sporządzono 21.11.2026.</p>
        <h2 className="font-heading pt-2 text-[1.875rem] font-semibold">Znane ograniczenia</h2>
        <p>Część ekranów jest w przygotowaniu i jeszcze nie przeszła przeglądu dostępności.</p>
        <h2 className="font-heading pt-2 text-[1.875rem] font-semibold">Kontakt</h2>
        <p>
          Jeśli napotkasz barierę, napisz do komórki kadr w swoim urzędzie. Pomoże ona w
          skorzystaniu z aplikacji w inny sposób.
        </p>
      </div>
    </article>
  );
}
