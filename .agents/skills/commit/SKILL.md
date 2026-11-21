---
name: commit
description: Commit the current changes as one or more Conventional Commits.
argument-hint: "[optional: what to commit, or a hint for the message]"
disable-model-invocation: true
---

Turn the working tree into **atomic** commits: each commit is one logical change with one type and one scope, and its message follows the format below. `$ARGUMENTS`, when given, narrows what to commit or hints at the message.

## Steps

1. **Read the changes.** Run `git status`, `git diff --staged` and `git diff`. Read the diffs themselves, not just the file list. Done when you can say in one sentence what each changed file does.
2. **Group them.** Sort the changes into atomic groups. Already staged changes form a group the user chose, so keep it intact. Unrelated changes (a refactor next to a feature, a dependency bump next to a fix) go in separate groups. Leave out files that look like secrets or local state (`.env*`, keys, credentials, editor and OS files) and tell the user you skipped them. Done when every changed file sits in exactly one group or on the skipped list.
3. **Branch if needed.** On the default branch (`main`), create a branch first: `git switch -c <type>/<short-kebab-slug>`, named after the first group.
4. **Commit each group.** Stage exactly that group's files (`git add <paths>`, or `git add -p` for a file that mixes groups), then commit with the message passed as a file: write it to a temp file and run `git commit -F <file>`. When a hook fails, fix the cause, re-stage and commit again as a new commit. Hooks always run.
5. **Verify.** Run `git log --oneline -n <count>` and `git status`. Done when every group has its commit, each message matches the format, and the only changes left are the skipped files.

Report the commits you created (hash and subject) and the files you skipped.

## Message format

[Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[(<scope>)][!]: <subject>

<body>

<footer>
```

**Type**, one of:

| Type | Use for |
| --- | --- |
| `feat` | new user-facing behaviour |
| `fix` | a bug fix |
| `refactor` | code change with no behaviour change |
| `perf` | a performance improvement |
| `test` | adding or fixing tests only |
| `docs` | documentation only |
| `style` | formatting only, no code meaning changes |
| `build` | build system, dependencies, package manager |
| `ci` | CI configuration and scripts |
| `chore` | maintenance that fits nothing above (tooling, agent config) |
| `revert` | reverting an earlier commit |

**Scope** is optional: the area touched, in lowercase kebab-case (`auth`, `api`, `ui`, `db`, `skills`). Reuse scopes already in `git log` before inventing new ones. Leave it out when the change spans the whole repo.

**`!`** after the type or scope marks a breaking change. Pair it with a `BREAKING CHANGE:` footer that says what breaks and how to migrate.

**Subject**: imperative mood ("add", "fix", "remove"), lowercase first word, no trailing period, at most 72 characters for the whole first line. It says what the commit does, for example `feat(auth): add magic link sign-in`.

**Body**: optional for a trivial change, expected otherwise. Explain *why* the change was made and anything a reviewer would not see in the diff. Wrap at 72 characters. Write plain prose that follows the style rules in `AGENTS.md`.

**Footer**: one per line, `Token: value`. Use `Closes #123` or `Refs #123` for issues and `BREAKING CHANGE: <description>` for breaking changes.

A full example:

```
fix(api): retry deadline sync after a 429 response

The upstream calendar API rate limits bursts of more than 10
requests. Sync now backs off and retries up to 3 times before
marking the deadline as stale.

Closes #42
```
