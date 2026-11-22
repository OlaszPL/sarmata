import { describe, expect, it } from 'vitest';
import type { RegulationGraph } from './labels';
import { graphConnections } from './graph-connections';

const graph: RegulationGraph = {
  nodes: [
    { id: 'strategy:daysFromEvent', kind: 'strategy', basis: null, value: null },
    { id: 'event:acquaintance', kind: 'event', basis: null, value: null },
    { id: 'slot:objection', kind: 'slot', basis: 'art. 83 ust. 1 ustawy', value: null },
    { id: 'param:partialScale', kind: 'parameter', basis: '§ 11 ust. 1 pkt 1', value: null },
    { id: 'param:outcome', kind: 'parameter', basis: '§ 11 ust. 1 pkt 3', value: null },
  ],
  edges: [
    { from: 'event:acquaintance', to: 'slot:objection', kind: 'countedFrom' },
    { from: 'slot:objection', to: 'strategy:daysFromEvent', kind: 'uses' },
    { from: 'param:outcome', to: 'param:partialScale', kind: 'references' },
  ],
};

describe('graphConnections', () => {
  it('lists the slot connections first, then the references, with Polish labels', () => {
    expect(graphConnections(graph)).toEqual([
      {
        from: 'Termin na sprzeciw',
        relation: 'liczony od',
        to: 'Zapoznanie z oceną',
        basis: 'art. 83 ust. 1 ustawy',
      },
      {
        from: 'Termin na sprzeciw',
        relation: 'korzysta ze strategii',
        to: 'Dni od zdarzenia',
        basis: 'art. 83 ust. 1 ustawy',
      },
      {
        from: 'Wynik oceny',
        relation: 'odwołuje się do',
        to: 'Skala ocen cząstkowych',
        basis: '§ 11 ust. 1 pkt 3',
      },
    ]);
  });

  it('falls back to the raw key for an unknown node', () => {
    const odd: RegulationGraph = {
      nodes: [{ id: 'slot:newSlot', kind: 'slot', basis: null, value: null }],
      edges: [{ from: 'slot:newSlot', to: 'strategy:newStrategy', kind: 'uses' }],
    };
    expect(graphConnections(odd)).toEqual([
      { from: 'newSlot', relation: 'korzysta ze strategii', to: 'newStrategy', basis: null },
    ]);
  });
});
