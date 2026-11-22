import { Notice } from '@sarmata/ui';

type SearchParams = Record<string, string | string[] | undefined>;

/** Values of `sprawdzono` that `saveNote` adds after a check without the AI model. */
const checkedTexts: Partial<Record<string, string>> = {
  slownik: 'Sprawdzono tylko słownikiem, bo model AI nie odpowiedział.',
  'ai-wylaczone': 'AI jest wyłączone w ustawieniach urzędu. Sprawdzono tylko słownikiem.',
};

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** "Zapisano notatkę." after `saveNote` redirected with `?zapisano=1`, nothing otherwise. */
export function NoteSavedNotice({ searchParams }: { searchParams: SearchParams }) {
  if (single(searchParams.zapisano) !== '1') return null;
  const checked = checkedTexts[single(searchParams.sprawdzono) ?? ''];
  return (
    <Notice tone="success" role="status" title="Zapisano notatkę.">
      {checked ? <p className="max-w-[70ch]">{checked}</p> : null}
    </Notice>
  );
}
