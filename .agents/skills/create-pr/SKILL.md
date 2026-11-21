---
name: create-pr
description: Push the current branch and open a GitHub pull request with a standardized title and body.
argument-hint: "[optional: draft, base branch, issue number, or notes for the description]"
disable-model-invocation: true
---

Open a pull request whose title is a Conventional Commit subject and whose body follows the template below. `$ARGUMENTS` may ask for a draft, name a base branch or an issue, or add notes for the description.

## Steps

1. **Commit leftovers.** If `git status` shows uncommitted changes, commit them first by following [`../commit/SKILL.md`](../commit/SKILL.md). On the default branch, that step also moves you to a new branch. Done when the working tree is clean, apart from files the commit step skipped.
2. **Find the base.** Use the base from `$ARGUMENTS`, otherwise `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`. Run `git fetch origin <base>`. Done when `git log --oneline origin/<base>..HEAD` lists at least one commit. If it lists none, stop and tell the user there is nothing to open a PR for.
3. **Read the whole range.** Read `git log origin/<base>..HEAD` and `git diff origin/<base>...HEAD`. The PR describes every commit in the range, not only the latest. Done when you can name the user-facing effect and the reason for each commit.
4. **Check for an existing PR.** Run `gh pr view --json url,state`. When an open PR already exists for this branch, you will update it in step 6 instead of creating one.
5. **Write the title and body.**
   - **Title**: one Conventional Commit subject covering the whole range, in the format from [`../commit/SKILL.md`](../commit/SKILL.md#message-format). Use `!` if any commit in the range is breaking.
   - **Body**: if the repo has `.github/pull_request_template.md`, fill that in. Otherwise use the template below. Write it to a temp file (`mktemp`).
6. **Push and publish.** Run `git push -u origin HEAD`. Then:
   - new PR: `gh pr create --base <base> --title "<title>" --body-file <file>`, adding `--draft` when `$ARGUMENTS` asks for a draft
   - existing PR: `gh pr edit --title "<title>" --body-file <file>`

   Always pass the body as a real file path. Some `gh` wrappers drop a body piped through stdin (`--body-file -`) and still exit 0.
7. **Verify.** Run `gh pr view --json url,title,body`. Done when the title matches and the body is the full text you wrote. If the body came back empty, run `gh pr edit --body-file <file>` and check again.

Report the PR URL.

## Body template

```markdown
## Summary

<1 to 3 sentences: what this PR changes and why>

## Changes

- <one bullet per logical change, grouped by area>

## Testing

- <commands you ran and their result, or the manual steps you checked>

## Notes

<breaking changes and how to migrate, follow-ups, risks. Delete this section when empty>

Closes #<issue>
```

Rules for the body:

- **Testing** reports only what was actually run. When nothing was run, write `Not tested` and say why.
- Keep the `Closes #<issue>` line only when an issue is known from `$ARGUMENTS`, the branch name or the commit footers.
- Write plain prose that follows the style rules in `AGENTS.md`.
