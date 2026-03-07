Run the full ClaimFlow test suite and report results.

Steps:
1. `cd /c/projets/claims/claimflow && npm run test`
2. Report:
   - Number of test files: passing / failing
   - Total tests: passed / failed
   - Coverage summary: Statements %, Branches %, Functions %, Lines %
   - Coverage threshold: must be ≥ 60% on all metrics
3. If any tests fail, diagnose the root cause and propose a fix
4. If coverage is below threshold, identify which files need more tests

Note: E2E tests (Playwright) run separately with `npm run test:e2e` — requires the dev server running on http://localhost:3000.
