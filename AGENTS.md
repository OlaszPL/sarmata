NEVER use em-dashes, slop words, semicolons etc.

## Language

Code is in English: identifiers, file names, comments, SQL tables, columns, enums, policies, JWT claims, developer-facing messages, test names. Only the application UI (user-facing strings) and docs (`docs/`, README) are in Polish. Domain terms keep their Polish name in `GLOSSARY.md` next to the English code name.

## Searching the repo: semble first

Gather context with semble, a semantic search over this repo:

- MCP: `mcp__semble__search` (query in plain language or code), then `mcp__semble__find_related` for similar code. Pass `content="docs"` for Markdown and legal texts, `content="all"` for everything.
- CLI (subagents without MCP): `semble search "ocena negatywna sprzeciw" . --content docs`. If `semble` is not on `$PATH`: `uvx --from "semble[mcp]==0.6.1" semble`.

Open the file and line semble returns. Use grep only for an exhaustive sweep of one literal string.

## Shell commands: rtk

Prefix every shell command with `rtk` (`rtk git status`, `rtk grep`, `rtk ls`, `rtk curl`). In a chain, prefix each command. In a pipe, prefix the producing command. rtk filters output to save tokens and is lossy (truncated lines, capped results). Use `rtk proxy <cmd>` when exact bytes matter: copying text into an edit, whitespace-sensitive files, exhaustive counts, full diffs.

## Domain context

Entry point: `docs/wymagania-i-kontekst.md` (requirements, appraisal process, rules with legal basis). Legal acts as clean Markdown in `docs/legal/` (`ustawa-o-sluzbie-cywilnej-tj-2026.md`, `rozporzadzenie-oceny-okresowe-2016.md`, `zarzadzenie-6-szefa-sc-2020-standardy-zzl.md`) and machine-readable rules in `docs/legal/oceny-okresowe-dane.yaml`. Research notes per topic: `docs/sources/*/FINDINGS.md`. Bulk downloads live in `archive/docs/<same path>/raw|text/` (gitignored, deduplicated, map in `archive/DUPLIKATY.tsv`), reach them only to verify a quote. KPRM challenge resources (BPMN, use cases, form schemas, 13 filled examples): `docs/zasoby-kprm/`.

## Ustalenia z organizatorami (KPRM)

- Analiza sentymentu i sygnałów wypalenia przez AI (np. Bielik-One) jest dozwolona. Organizatorzy jawnie zgodzili się na to narzędzie pod warunkiem, że wynik jest tylko sugestią dla przełożonego, a decyzję podejmuje człowiek. Nie blokuj tej funkcji argumentem z AI Act art. 5 ust. 1 lit. f.

Python runs through `uv` (`uv run --no-project --with <pkg> ...`). Behind this network's proxy add `--with truststore` and call `truststore.inject_into_ssl()`.
