import { Notice } from '@sarmata/ui';
import { aiNoteTextOfParam } from '@/lib/employees/notes';
import { type SearchParams, single } from '@/lib/search-params';

/** "Zapisano notatkę." after `saveNote` redirected with `?zapisano=1`, nothing otherwise. */
export function NoteSavedNotice({ searchParams }: { searchParams: SearchParams }) {
  if (single(searchParams.zapisano) !== '1') return null;
  // `sprawdzono` tells how `saveNote` checked the note without the AI model.
  const checked = aiNoteTextOfParam(single(searchParams.sprawdzono));
  return (
    <Notice tone="success" role="status" title="Zapisano notatkę.">
      {checked ? <p className="max-w-[70ch]">{checked}</p> : null}
    </Notice>
  );
}
