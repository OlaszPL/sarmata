declare const marka: unique symbol;

/** Data bez czasu i strefy w formacie `RRRR-MM-DD`. Tworzy ją tylko `dataKalendarzowa`, więc zawsze istnieje. */
export type DataKalendarzowa = string & { readonly [marka]: 'DataKalendarzowa' };

const MIN_ROK = 1000;
const MAX_ROK = 9999;

const FORMAT_DATY = /^(\d{4})-(\d{2})-(\d{2})$/;

const dwieCyfry = (n: number): string => String(n).padStart(2, '0');

export const ostatniDzienMiesiaca = (rok: number, miesiac: number): number =>
  new Date(Date.UTC(rok, miesiac, 0)).getUTCDate();

/** Waliduje format i istnienie dnia. Rzuca `RangeError` dla złej daty. */
export function dataKalendarzowa(iso: string): DataKalendarzowa {
  const dopasowanie = FORMAT_DATY.exec(iso);
  if (!dopasowanie) throw new RangeError(`Niepoprawny format daty: ${iso}`);
  return zeSkladowych(Number(dopasowanie[1]), Number(dopasowanie[2]), Number(dopasowanie[3]));
}

/** Wewnętrzne: rok, miesiąc (1 do 12) i dzień z poprawnej daty. */
export function skladowe(data: DataKalendarzowa): { rok: number; miesiac: number; dzien: number } {
  return {
    rok: Number(data.slice(0, 4)),
    miesiac: Number(data.slice(5, 7)),
    dzien: Number(data.slice(8, 10)),
  };
}

/** Wewnętrzne: buduje datę ze składowych, rzuca `RangeError`, gdy dzień nie istnieje albo rok jest poza zakresem 1000 do 9999. */
export function zeSkladowych(rok: number, miesiac: number, dzien: number): DataKalendarzowa {
  if (
    !Number.isInteger(rok) ||
    !Number.isInteger(miesiac) ||
    !Number.isInteger(dzien) ||
    rok < MIN_ROK ||
    rok > MAX_ROK ||
    miesiac < 1 ||
    miesiac > 12 ||
    dzien < 1 ||
    dzien > ostatniDzienMiesiaca(rok, miesiac)
  ) {
    throw new RangeError(`Data nie istnieje: ${rok}-${dwieCyfry(miesiac)}-${dwieCyfry(dzien)}`);
  }
  return `${rok}-${dwieCyfry(miesiac)}-${dwieCyfry(dzien)}` as DataKalendarzowa;
}
