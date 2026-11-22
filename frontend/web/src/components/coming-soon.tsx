interface ComingSoonProps {
  title: string;
  description?: string;
}

/** Placeholder of a section that the functional thread has not built yet. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <section className="px-8 py-10">
      <h1 className="font-heading text-[2.75rem] font-semibold">{title}</h1>
      {description ? <p className="mt-4 max-w-prose">{description}</p> : null}
      <p className="mt-4 max-w-prose">Ta część aplikacji jest w przygotowaniu.</p>
    </section>
  );
}
