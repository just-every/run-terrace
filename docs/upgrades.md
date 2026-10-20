# Review an installation upgrade

Your checkout, source edits and Cloudflare resources belong to you. An upgrade
is a reviewed Git merge into that checkout, never a replacement clone over the
live installation. Keep the Worker, D1 and project identifiers unchanged.

1. Download **Data & access → Download installation backup (.rer)** and keep
   that private archive outside the checkout. Also run
   `rer export --output /absolute/private/path/before-upgrade.rer` for an
   offline copy. Keep private setup, deployment configuration and credentials
   separately; archives deliberately exclude them.
2. Commit your intentional source changes, including custom modules and theme
   edits. Leave local settings and credentials ignored. Record the installed
   commit with `git rev-parse HEAD`.
3. Create a separate review checkout of your fork. Install it with `rer dev`,
   finish setup and restore the backup there using **Data & access**. This
   review installation has its own owner and sessions; a backup cannot sign
   someone in. Stop the foreground command with Ctrl-C before merging.
4. Add the upstream repository if needed:
   `git remote add upstream https://github.com/just-every/run-terrace.git`.
   Run `git fetch upstream`, choose the exact commit to review, and read
   `git diff HEAD...upstream/main -- CONTRACT.md ACCEPTANCE.md package.json
   pnpm-lock.yaml migrations src scripts`. Inspect all new migrations and
   dependency/provider changes. Merge that chosen commit with
   `git merge --no-edit COMMIT`. Resolve conflicts individually; do not discard
   your installed edits or overwrite private configuration.
5. Run `rer dev` in the review checkout. It installs the declared lockfile and
   applies forward migrations without resetting data. Sign in with that
   installation's private `RER_OPEN` link, check the restored tenancy, ledger,
   original files and customisations, and export a new backup. Run
   `rer doctor --json` for local-input diagnostics and
   `rer check --profile first-party` for the declared command contract.
6. After the review succeeds, stop the live foreground app with Ctrl-C, take
   another backup, and merge the same reviewed commit into the live fork.
   Follow [deployment](../README.md#deploy-to-your-cloudflare-account) for an
   owned Cloudflare installation. Validate with `rer deploy --dry-run` before
   deploying. Never rename or recreate live resources to repair an upgrade.

A failure is a reason to keep the old installation running while correcting
the review checkout. Do not reset a live store or remove an applied migration.
If recovery needs an older version, restore its pre-upgrade backup into a
separate matching installation; reversing a migration is not implied.

## Diagnostics and provider setup

`GET /health` reports runtime/deployment identity, not successful provider
delivery. `rer doctor --json` reports missing input names, their documentation,
runtime requirements and local state problems. It does not validate a bank,
mail sender or provider account. A permission refusal identifies the missing
authority; use the installation owner to review roles rather than granting
access merely to clear an error. Share a redacted error and the commit, never
an archive, `.dev.vars`, `.env`, sign-in link or `RER_OPEN` credential.

Current outbound mail uses Resend, configured under the README deployment
steps; [Resend pricing](https://resend.com/pricing) and your Cloudflare usage
are billed by those providers. Local development suppresses mail. Provider
acceptance is not delivery. The app has no telemetry or remote license check;
Git, package installation, browser downloads and an explicit deployment still
contact the services required for those commands. Future payment, messaging,
screening and other integrations must document their own provider setup and
operational diagnostics before shipping.
