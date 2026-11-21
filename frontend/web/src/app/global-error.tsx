'use client';

/** Last resort when the root layout itself fails, so it carries its own html and body. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pl">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1>Coś poszło nie tak</h1>
        <p>Nie udało się wyświetlić aplikacji. Spróbuj ponownie.</p>
        <button type="button" onClick={reset} style={{ minHeight: '2.75rem', fontSize: '1rem' }}>
          Spróbuj ponownie
        </button>
      </body>
    </html>
  );
}
