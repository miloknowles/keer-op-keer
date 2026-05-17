# Release Guide

## Branch Strategy

- **`develop`** — active development branch; all feature branches merge here
- **`main`** — production branch; only receives merges from `develop` at release time

## Release Steps

### 1. Build and fix errors/warnings

From the `app/` directory, stop the dev server if running, then:

```bash
yarn build
```

Fix any TypeScript errors, lint warnings, or build failures before proceeding. Do not merge to `main` with a broken build.

### 2. Merge `develop` → `main`

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

Resolve any conflicts before pushing.

### 3. Tag the release

Use date-based versioning: `YYYY-MM-DDa`. If releasing more than once on the same day, increment the letter (`a`, `b`, `c`, …).

```bash
git tag 2026-05-16a
git push origin 2026-05-16a
```

### 4. Write release notes via GitHub CLI

```bash
gh release create 2026-05-16a --title "2026-05-16a" --notes "$(cat <<'EOF'
## What's new

- Feature A
- Feature B

## Bug fixes

- Fix X
- Fix Y
EOF
)"
```

Or use `--generate-notes` to auto-generate notes from merged PRs:

```bash
gh release create 2026-05-16a --title "2026-05-16a" --generate-notes
```

To open an editor instead of writing inline:

```bash
gh release create 2026-05-16a --title "2026-05-16a" --notes-file release-notes.md
```

### 5. Return to `develop`

```bash
git checkout develop
```

## Versioning Convention

Tags use the format `YYYY-MM-DDa`. The date is the release date; the letter distinguishes multiple releases on the same day (`a` for first, `b` for second, etc.).
