# Known Issues

## Room code exhaustion

Room codes are 4 random uppercase letters (e.g. `XKQZ`), giving 26⁴ = 456,976 possible codes. If rooms are not cleaned up promptly after games end, the pool will eventually fill up and new rooms cannot be created.

**Fix options:**
- Periodically expire and free codes from finished/abandoned rooms
- Expand to 5-letter codes (26⁵ ≈ 11.8M) or add digits (36⁴ ≈ 1.7M)

## No automated CI testing

There is no GitHub Actions workflow to run the test suite on pull requests or pushes. Tests must be run manually (`npm test` from `app/`).

**Fix options:**
- Add a `.github/workflows/ci.yml` that runs `npm ci && npm test` in the `app/` directory on push/PR
- Optionally add type-checking (`npm run type-check`) and linting (`npm run lint`) as separate steps
