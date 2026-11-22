import { type RegulationGraph, graphNodeLabel } from './labels';

/** One line of the connections list: `{from} {relation} {to}`, with the legal basis under it. */
export interface GraphConnection {
  from: string;
  to: string;
  relation: string;
  basis: string | null;
}

/**
 * The regulation graph as readable sentences: every slot in document order with the event it is
 * counted from and the strategy it uses, then the references between parameter sections.
 */
export function graphConnections(graph: RegulationGraph): GraphConnection[] {
  const basisOf = new Map(graph.nodes.map((node) => [node.id, node.basis]));
  const slotIds = new Set(
    graph.nodes.filter((node) => node.kind === 'slot').map((node) => node.id),
  );
  for (const edge of graph.edges) {
    if (edge.kind === 'uses') slotIds.add(edge.from);
    if (edge.kind === 'countedFrom') slotIds.add(edge.to);
  }

  const connections: GraphConnection[] = [];
  for (const slot of slotIds) {
    const basis = basisOf.get(slot) ?? null;
    for (const edge of graph.edges) {
      if (edge.kind === 'countedFrom' && edge.to === slot) {
        connections.push({
          from: graphNodeLabel(slot),
          relation: 'liczony od',
          to: graphNodeLabel(edge.from),
          basis,
        });
      }
    }
    for (const edge of graph.edges) {
      if (edge.kind === 'uses' && edge.from === slot) {
        connections.push({
          from: graphNodeLabel(slot),
          relation: 'korzysta ze strategii',
          to: graphNodeLabel(edge.to),
          basis,
        });
      }
    }
  }
  for (const edge of graph.edges) {
    if (edge.kind !== 'references') continue;
    connections.push({
      from: graphNodeLabel(edge.from),
      relation: 'odwołuje się do',
      to: graphNodeLabel(edge.to),
      basis: basisOf.get(edge.from) ?? null,
    });
  }
  return connections;
}
