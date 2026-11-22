/** Paths of the HR area that `routes.ts` does not hold. */
export const hrPaths = {
  dscOckCsv: (year: number): string => `/api/kadry/dsc-ock?rok=${year}`,
};
