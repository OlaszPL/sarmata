import { graphConnections, groupConnections } from '@/lib/regulations/graph-connections';
import type { RegulationGraph } from '@/lib/regulations/labels';

/** The connections of a version as a plain list, one line each, with the legal basis under it. */
export function RegulationGraphList({ graph }: { graph: RegulationGraph }) {
  const connections = groupConnections(graphConnections(graph));
  if (connections.length === 0) {
    return <p className="max-w-[70ch]">Ta wersja nie ma powiązań między przepisami.</p>;
  }
  return (
    <ul className="border-rule border-t">
      {connections.map((connection, index) => (
        <li key={`${index}:${connection.from}`} className="border-rule grid gap-1 border-b py-3.5">
          <p className="max-w-[70ch] leading-[1.5]">
            <span className="font-heading font-semibold">{connection.from}</span>{' '}
            {connection.parts.map((part, partIndex) => (
              <span key={`${part.relation}:${part.to}`}>
                {partIndex > 0 ? ', ' : null}
                {part.relation} <span className="font-heading font-semibold">{part.to}</span>
              </span>
            ))}
          </p>
          {connection.basis ? (
            <p className="text-ink-muted max-w-[70ch] text-[0.9375rem] leading-[1.4]">
              Podstawa prawna: {connection.basis}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
