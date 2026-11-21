import { type RegulationDocument, parseRegulationDocument } from '@sarmata/domain';
import regulation2016 from '../regulation-2016/rules.json';

/**
 * Official regulation versions, oldest first. A new version is a new `regulation-<year>/` directory
 * added here. Parsing at import makes an invalid catalog fail every test and every process start.
 */
export const officialRegulations: readonly RegulationDocument[] = [
  parseRegulationDocument(regulation2016),
];
