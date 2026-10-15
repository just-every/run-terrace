# Verification

One GitHub Verify runs per main commit. It installs the locked dependencies and Chromium, checks the first-party RER contract, builds, typechecks, runs seven public-door product integration tests and the emitted runtime and email-link checks, then runs RER's hosted-output checks. Build and deploy do not run tests. Run Base's publication scan on the exact tree before pushing.
