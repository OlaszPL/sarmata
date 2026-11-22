/** Search params of a page as Next.js passes them. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a search param, trimmed, empty when it is absent. */
export function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}
