import {
  type DataKalendarzowa,
  ostatniDzienMiesiaca,
  skladowe,
  zeSkladowych,
} from './data-kalendarzowa';

/**
 * Koniec terminu liczonego w miesiącach (art. 112 Kc): dzień odpowiadający datą dniowi
 * początkowemu, a gdy go nie ma, ostatni dzień miesiąca.
 */
export function dodajMiesiace(od: DataKalendarzowa, miesiace: number): DataKalendarzowa {
  if (!Number.isInteger(miesiace) || miesiace < 0) {
    throw new RangeError(`Liczba miesięcy musi być nieujemną liczbą całkowitą: ${miesiace}`);
  }
  const { rok, miesiac, dzien } = skladowe(od);
  const indeks = rok * 12 + (miesiac - 1) + miesiace;
  const nowyRok = Math.floor(indeks / 12);
  const nowyMiesiac = (indeks % 12) + 1;
  return zeSkladowych(nowyRok, nowyMiesiac, Math.min(dzien, ostatniDzienMiesiaca(nowyRok, nowyMiesiac)));
}
