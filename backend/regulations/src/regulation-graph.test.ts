import { regulationGraph } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');
const graph = regulationGraph(regulation);

describe('regulationGraph', () => {
  it('graph links cycleStart to evaluationDeadline and monthsFromEvent', () => {
    expect(graph.edges).toContainEqual({
      from: 'event:cycleStart',
      to: 'slot:evaluationDeadline',
      kind: 'countedFrom',
    });
    expect(graph.edges).toContainEqual({
      from: 'slot:evaluationDeadline',
      to: 'strategy:monthsFromEvent',
      kind: 'uses',
    });
  });

  it('graph lists every registered strategy with a params schema', () => {
    const strategies = graph.nodes.filter((node) => node.kind === 'strategy');
    expect(strategies.map((node) => node.id).sort()).toEqual([
      'strategy:daysFromEvent',
      'strategy:monthsFromEvent',
      'strategy:windowAroundEvent',
    ]);
    for (const node of strategies) {
      expect(node.value).toMatchObject({ paramsSchema: { type: 'object' } });
    }
  });

  it('every graph parameter node has a basis', () => {
    const parameters = graph.nodes.filter((node) => node.kind === 'parameter');
    expect(parameters.length).toBeGreaterThan(9);
    for (const node of parameters) expect(node.basis).toBeTruthy();
  });

  it('every edge connects existing nodes', () => {
    const ids = new Set(graph.nodes.map((node) => node.id));
    for (const edge of graph.edges) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    }
  });
});
