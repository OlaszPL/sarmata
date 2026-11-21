---
name: sops-cli
description: Work with SOPS (Secrets OPerationS) encrypted config files. Decrypt, encrypt, edit, set, and unset values in SOPS-managed YAML/JSON files. Resolve git merge conflicts in SOPS-encrypted files. Use when the user mentions SOPS, encrypted configs, secrets management in config files, needs to modify values in SOPS-encrypted files, or has merge conflicts in SOPS-managed files.
---

# SOPS CLI

SOPS (v3.11+) encrypts/decrypts files using KMS (AWS, GCP, Azure), age, or PGP. It supports partial encryption via `encrypted_regex` so only sensitive keys are encrypted while the rest stays plaintext.

## Critical Rules

- **NEVER** read, decrypt, or output the contents of SOPS-encrypted files in chat. Treat them like `.env` files.
- **NEVER** use `sops -d` (decrypt) to display secrets to the user.
- **Key presence checks**: output key names or counts only, never values, e.g. `sops -d <file> | grep -c '  KEY_NAME:'`. To consume a value, pass it into the target command's environment (`sops exec-env`, or `export KEY=$(...)` consumed silently). Never pipe a decrypted stream through ad-hoc sed/grep "redaction": a non-matching pattern (macOS sed lacks `\s` and `/I`) prints the secret verbatim.
- **NEVER** directly edit a SOPS-managed file with an editor, a string-replacement tool, `sed`, or anything other than SOPS itself. This includes **both** encrypted sections (e.g. `secrets:`) **and** plaintext sections (e.g. `config:`). Any direct edit invalidates the MAC and corrupts the file for SOPS.
- **Always use `sops set`, `sops unset`, or `sops edit`** to modify any value in a SOPS-managed file.
- **Always run SOPS commands from the repo root** so `.sops.yaml` path rules match correctly.

## Configuration

SOPS uses `.sops.yaml` at the repo root for creation rules. Key fields:

| Field | Purpose |
|-------|---------|
| `path_regex` | Match files by path (e.g., `local`, `production`) |
| `encrypted_regex` | Only encrypt keys matching this regex (e.g., `^secrets$`) |
| `age` / `kms` / `gcp_kms` | Encryption key to use |

## Common Commands

### Decrypt to stdout

```bash
sops -d <file>
# or
sops decrypt <file>
```

### Decrypt in place

```bash
sops -d -i <file>
```

### Encrypt in place

```bash
sops -e -i <file>
# or
sops encrypt -i <file>
```

### Interactive edit (opens $EDITOR)

```bash
sops <file>
# or
sops edit <file>
```

### Set a specific key (in-place, handles encrypt/decrypt automatically)

The `sops set` command takes **3 separate positional arguments**: file, index, value.

```bash
sops set <file> '["key"]' '"value"'
```

**Nested keys** use chained bracket notation in the index argument:

```bash
sops set <file> '["secrets"]["DATABASE_URL"]' '"postgresql://user:pass@host:5432/db"'
sops set <file> '["config"]["APP_NAME"]' '"my-app"'
```

Every `sops set` rewrites the file's ciphertext — even setting a key back to its previous value leaves the file "modified" in git. That's expected; to undo a value round-trip cleanly, `git checkout -- <file>` instead of setting the old value back, or you'll commit no-op re-encryption noise.

**JSON values** (objects, arrays, booleans):

```bash
sops set <file> '["config"]["features"]' '{"enabled":true}'
sops set <file> '["config"]["ports"]' '[8080,8443]'
```

### Remove a key

```bash
sops unset <file> '["secrets"]["OLD_KEY"]'
```

### Extract a specific value (decrypt mode only)

```bash
sops -d --extract '["secrets"]["DATABASE_URL"]' <file>
```

### Check encryption status

```bash
sops filestatus <file>
```

### Rotate data encryption key

```bash
sops -r -i <file>
```

### Update master keys (re-reads .sops.yaml and applies current rules)

```bash
sops updatekeys <file>
```

## Tips

1. **Partial encryption**: With `encrypted_regex: "^secrets$"`, only the top-level `secrets:` key is encrypted. Everything else (like `config:`) stays plaintext and is safe to **read**, but you must still use `sops set` / `sops edit` to **modify** any part of the file. Direct edits break the MAC.

2. **New file bootstrap**: Create a plaintext YAML with the desired structure, then encrypt:
   ```bash
   sops -e -i configs/config.local.yaml
   ```

3. **Bulk set multiple values**: Chain commands or use `sops edit` to open in your editor:
   ```bash
   sops set <file> '["secrets"]["KEY1"]' '"val1"' && \
   sops set <file> '["secrets"]["KEY2"]' '"val2"'
   ```

4. **Convert output format**: Decrypt YAML as JSON (useful for piping to `jq`):
   ```bash
   sops -d --output-type json <file>
   ```

5. **Avoid leaking secrets in process list**: Use `--value-file` or `--value-stdin`:
   ```bash
   echo '"my-secret-value"' | sops set --value-stdin <file> '["secrets"]["API_KEY"]'
   sops set --value-file <file> '["secrets"]["API_KEY"]' secret.txt
   ```

6. **Idempotent set** (no-op if value already matches):
   ```bash
   sops set --idempotent <file> '["config"]["PORT"]' '"8080"'
   ```

7. **MAC errors**: If you get MAC mismatch errors, the file was modified outside SOPS. Fix by reverting to a known-good state (e.g. `git checkout <file>`) and re-applying changes with `sops set`. As a last resort:
   ```bash
   sops -d --ignore-mac <file> | sops -e /dev/stdin > <file>.fixed
   mv <file>.fixed <file>
   ```

8. **Run commands with decrypted env vars** (without writing to disk):
   ```bash
   sops exec-env <file> 'printenv DATABASE_URL'
   ```

## Merge Conflict Resolution

SOPS-encrypted files require special handling during git merges. Conflict markers (`<<<<<<<`) corrupt the YAML structure and invalidate the MAC, making the file unusable by SOPS. **Never attempt to manually resolve conflicts in a SOPS file.**

### Resolution Workflow

```
Merge Conflict Resolution:
- [ ] Step 1: Identify conflicted SOPS files
- [ ] Step 2: Extract both clean versions
- [ ] Step 3: Diff decrypted content (internal only — never show to user)
- [ ] Step 4: Choose base and apply delta with sops set
- [ ] Step 5: Verify integrity
- [ ] Step 6: Clean up and complete the merge
```

**Step 1: Identify conflicted SOPS files**

```bash
git diff --name-only --diff-filter=U | grep 'config\.'
```

**Step 2: Extract both clean versions**

Git merge stages: `:1:` = common ancestor, `:2:` = ours (current branch), `:3:` = theirs (incoming branch).

```bash
git show :2:path/to/config.env.yaml > /tmp/sops-ours.yaml
git show :3:path/to/config.env.yaml > /tmp/sops-theirs.yaml
git show :1:path/to/config.env.yaml > /tmp/sops-base.yaml
```

**Step 3: Diff decrypted content**

IMPORTANT: Do NOT output decrypted content to the user. Diff internally to identify what changed.

```bash
diff <(sops -d /tmp/sops-ours.yaml) <(sops -d /tmp/sops-theirs.yaml) > /tmp/sops-diff.txt
```

Read `/tmp/sops-diff.txt` internally. For `config:` changes (plaintext with `encrypted_regex`), you can diff the encrypted files directly since config values are not encrypted.

**Step 4: Choose base and apply delta**

Take one side as starting point, then apply missing changes from the other:

```bash
git checkout --ours path/to/config.env.yaml
git add path/to/config.env.yaml

# Apply changes from "theirs" that should be kept
sops set path/to/config.env.yaml '["config"]["NEW_KEY"]' '"value-from-theirs"'
sops set path/to/config.env.yaml '["secrets"]["NEW_SECRET"]' '"secret-from-theirs"'
```

If "theirs" has more relevant changes, start from that side instead:

```bash
git checkout --theirs path/to/config.env.yaml
git add path/to/config.env.yaml

sops set path/to/config.env.yaml '["config"]["KEY"]' '"value-from-ours"'
```

**Step 5: Verify integrity**

```bash
sops filestatus path/to/config.env.yaml
```

Should return `encrypted: true` with no errors. If it fails, the file is still corrupt — re-extract and retry from Step 2.

**Step 6: Clean up and complete the merge**

```bash
rm -f /tmp/sops-ours.yaml /tmp/sops-theirs.yaml /tmp/sops-base.yaml /tmp/sops-diff.txt
git add path/to/config.env.yaml
git merge --continue   # or: git rebase --continue
```

### Quick Shortcuts

**Take one side entirely** (no blending needed):

```bash
git checkout --ours path/to/file.yaml && git add path/to/file.yaml
# or
git checkout --theirs path/to/file.yaml && git add path/to/file.yaml
```

**Multiple conflicted SOPS files:** Process each file independently — each has its own MAC and data key.

**`.sops.yaml` rules changed during merge:** After resolving, sync master keys:

```bash
sops updatekeys path/to/config.env.yaml
```

### Prevention

1. **Coordinate changes** — avoid concurrent modifications to the same SOPS config file across branches.
2. **Separate concerns** — keep environment-specific configs in separate files (`config.local.yaml`, `config.production.yaml`) to reduce conflict surface.
3. **Prefer `sops set`** — atomic key-level changes are easier to reason about than bulk `sops edit` sessions.
4. **Git diff integration** — configure git to show cleartext diffs for SOPS files to catch conflicts early:
   ```bash
   # .gitattributes
   *.yaml diff=sopsdiffer
   # then:
   git config diff.sopsdiffer.textconv "sops decrypt"
   ```

## Typical file structure

A common layout is one SOPS file per environment:

```
configs/
  config.local.yaml         # local development
  config.staging.yaml       # deployed staging environment
  config.production.yaml    # production environment
```

Each file has two top-level keys:

- `secrets:` — encrypted values (API keys, `DATABASE_URL`, tokens)
- `config:` — plaintext values (app URL, feature flags, log level)

Only `secrets:` is encrypted, so `config:` is readable in a plain `git diff`. That does **not**
make it hand-editable: a direct write to any part of the file breaks the MAC.
