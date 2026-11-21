import {
  type RegulationCase,
  type RegulationDocument,
  parseRegulationDocument,
  regulationCasesSchema,
  type TrainingItem,
  trainingCatalogSchema,
} from '@sarmata/domain';
import trainingCatalogData from '../development/training-catalog.json';
import cases2016 from '../regulation-2016/cases.json';
import regulation2016 from '../regulation-2016/rules.json';

/**
 * Official regulation versions, oldest first. A new version is a new `regulation-<year>/` directory
 * added here. Parsing at import makes an invalid catalog fail every test and every process start.
 */
export const officialRegulations: readonly RegulationDocument[] = [
  parseRegulationDocument(regulation2016),
];

/** Worked examples of each official version, keyed by its id. They feed Vitest and the rule editor. */
export const officialCases: Readonly<Record<string, readonly RegulationCase[]>> = {
  'regulation-2016': regulationCasesSchema.parse(cases2016),
};

/** Training and development offers of the Civil Service (249 items), generated from the research CSV. */
export const trainingCatalog: readonly TrainingItem[] =
  trainingCatalogSchema.parse(trainingCatalogData);
