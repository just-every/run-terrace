# Terrace contract

[ACCEPTANCE.md](ACCEPTANCE.md) defines this first release. [API.md](API.md) defines its authenticated commands and role boundaries. [README.md](README.md) defines local operations, backup and deployment. Trust money and external delivery remain outside Terrace.

## Terrace presentation and run site

The installed `/` remains the shared Lobby. `/app` lists linked tenancies; a tenancy detail keeps renewal and arrears decisions with their existing approval boundaries. Rent, work, move-in and data/access forms keep their existing command paths. The phone ledger stacks each charge with its date, reference, amount and unpaid balance.

`rer build --site` builds the public homepage, `/run`, `/docs` and the guides from repository Markdown, plus a not-found document. The site reads no installation records and links no instance-only routes. `deploy-site.json` declares the site; the run-site workflow is guarded by `RUN_SITE_DEPLOY` and remains disabled until its run-site gate.
