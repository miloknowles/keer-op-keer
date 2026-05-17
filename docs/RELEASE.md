# Release Guide

## Branch Strategy

- **`develop`** — active development branch; all feature branches merge here
- **`main`** — production branch; only receives merges from `develop` at release time

## Release Steps

### 1. Merge `develop` → `main`

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

Resolve any conflicts before pushing.

### 2. Tag the release

Use semantic versioning (`vMAJOR.MINOR.PATCH`):

```bash
git tag v1.2.0
git push origin v1.2.0
```

### 3. Write release notes via GitHub CLI

```bash
gh release create v1.2.0 --title "v1.2.0" --notes "$(cat <<'EOF'
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
gh release create v1.2.0 --title "v1.2.0" --generate-notes
```

To open an editor instead of writing inline:

```bash
gh release create v1.2.0 --title "v1.2.0" --notes-file release-notes.md
```

### 4. Return to `develop`

```bash
git checkout develop
```

## Versioning Convention

| Change type | Example | Version bump |
|---|---|---|
| New game feature / major UI change | New scoring mechanic | MINOR |
| Bug fix or small improvement | Fix adjacency bug | PATCH |
| Breaking DB migration / full rewrite | Schema overhaul | MAJOR |
