import { z } from 'zod';
import { deadlineEventSchema, deadlineRuleSchema } from '../deadlines/deadline-rule';
import { type RegulationDocument } from './regulation-document';

export interface GraphNode {
  id: string;
  kind: 'slot' | 'strategy' | 'event' | 'parameter';
  basis: string | null;
  value: unknown;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: 'countedFrom' | 'uses' | 'references';
}

export interface RegulationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const SECTIONS = [
  'partialScale',
  'overallLevel',
  'outcome',
  'justification',
  'criteria',
  'additionalCriteria',
  'termChange',
  'gradeByLaw',
  'feedback',
] as const;

/** Which section reads which: the referrer first, the referenced one second. */
const SECTION_REFERENCES: readonly (readonly [string, string])[] = [
  ['param:overallLevel', 'param:partialScale'],
  ['param:outcome', 'param:partialScale'],
  ['param:gradeByLaw', 'param:partialScale'],
  ['param:additionalCriteria', 'param:criteria'],
  ['param:termChange', 'slot:evaluationDeadline'],
  ['slot:gradeByLawGrant', 'param:gradeByLaw'],
];

/**
 * The slots and parameters of a version with their legal basis, plus every registered strategy and
 * event so an editor can offer them. A new strategy shows up here by itself (ADR 0006).
 */
export function regulationGraph(document: RegulationDocument): RegulationGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const option of deadlineRuleSchema.options) {
    nodes.push({
      id: `strategy:${option.shape.strategy.value}`,
      kind: 'strategy',
      basis: null,
      value: { paramsSchema: z.toJSONSchema(option) },
    });
  }
  for (const event of deadlineEventSchema.options) {
    nodes.push({ id: `event:${event}`, kind: 'event', basis: null, value: null });
  }
  for (const [slot, rule] of Object.entries(document.deadlines)) {
    nodes.push({ id: `slot:${slot}`, kind: 'slot', basis: rule.basis, value: rule });
    edges.push({ from: `event:${rule.event}`, to: `slot:${slot}`, kind: 'countedFrom' });
    edges.push({ from: `slot:${slot}`, to: `strategy:${rule.strategy}`, kind: 'uses' });
  }
  for (const section of SECTIONS) {
    nodes.push({
      id: `param:${section}`,
      kind: 'parameter',
      basis: document[section].basis,
      value: document[section],
    });
  }
  for (const sheet of document.sheets) {
    nodes.push({
      id: `param:sheet-${sheet.id}`,
      kind: 'parameter',
      basis: sheet.basis,
      value: sheet,
    });
    edges.push({ from: `param:sheet-${sheet.id}`, to: 'param:criteria', kind: 'references' });
  }

  const ids = new Set(nodes.map((node) => node.id));
  for (const [from, to] of SECTION_REFERENCES) {
    if (ids.has(from) && ids.has(to)) edges.push({ from, to, kind: 'references' });
  }
  return { nodes, edges };
}
