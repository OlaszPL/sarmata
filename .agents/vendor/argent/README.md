# Argent's skills, vendored

Unmodified copies of the agent skills and rules that ship inside
[`@swmansion/argent`](https://github.com/software-mansion/argent) **0.31.1**.
Apache License 2.0, see [`LICENSE`](LICENSE).

They live here, outside `.agents/skills/`, so they load only when explicitly
needed: any skills folder, nested ones included, would put them in every
session's skill list.

Kept: `argent-device-interact`, `argent-ios-simulator-setup`,
`argent-android-emulator-setup`, `argent-test-ui-flow`, `argent-screenshot-diff`,
`argent-screen-recording`, `argent-settings-permissions`, `argent-create-e2e`,
`argent-qa-e2e`, and `rules/argent.md` (inert here: it is not in a rules folder).
Left out: the React Native, Metro, TV, profiler, Lens and physical-iPhone skills.

To bump Argent, replace these folders with the
ones under `package/skills/` and `package/rules/` of the same published version,
unedited:

```bash
curl -sL "$(pnpm view @swmansion/argent@<version> dist.tarball)" | tar -xz -C "$TMPDIR"
```
