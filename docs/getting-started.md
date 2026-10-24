# Getting started

Run Terrace locally, confirm the installation owner and record your first tenancy. You need Git and Node.js 22 or newer; the project command selects its pinned Node runtime.

## Residential rentals only

Terrace manages residential rentals only: it has no commercial leases, CAM reconciliation or homeowners’-association dues and association accounting. Keep commercial leases, CAM recoveries and association books in a specialist system. A residential owner’s own HOA dues are an ordinary bill the owner pays, not association accounting. The Move in kit holds any row marked as a non-residential lease as an exception rather than importing it.

## Get Terrace and start it

One line installs the RER command, clones the source into `run-terrace` and runs it:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-terrace
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-terrace` does the same. If the installer prints a line that puts `rer` on your PATH, run that line too. To start it again later, run the same line from the same folder, or `cd run-terrace && rer dev`.

The first launch can take several minutes. `rer dev` installs dependencies, prepares the local database and development owner, applies migrations and starts the app. It prints the local address as `RER_READY` and a private sign-in link as `RER_OPEN`.

Open `RER_OPEN` on this computer. It is a credential: keep it private. On **Finish setup**, confirm the owner and finish setup to enter Terrace. Local development mail is suppressed and sends no external email.

For a new installation using your real owner mailbox, run `npx -y @runeditrun/rer install just-every/run-terrace`, then `rer setup` from the checkout before its first `rer dev`, and enter the mailbox at the prompt. Preserve the owner identity in an existing installation. The repository's [operating instructions](../README.md) cover deployment and provider configuration.

## Add the first tenancy

1. Open **Tenancies**, then **Add a tenancy**.
2. Enter the address, property owner's name and email, and tenant's name and email.
3. Enter the lease start and end dates, rent in USD, rent cadence (weekly, every two weeks or monthly) and the property's time zone.
4. Select **Add tenancy** and check the saved details.

If you already have records to bring across, use **Move in** and follow the [CSV guide](move-in.md). Terrace starts with your records; the repository's example CSV is an import fixture, not preloaded portfolio data.

## Make the first working cycle

Visit [Rent & arrears](rent-and-statements.md) to add a charge and record an amount received externally. Use [Inspections & maintenance](inspections-and-maintenance.md) to save dated notes, retain a photograph and prepare a job. Review prepared work using an owner or admin account before approving it.

In **Data & access**, [invite operators](roles-and-erasure.md) and [download a backup](backup-and-restore.md) when you have records to keep.

## Stop and return later

```sh
rer dev --stop
```

Run `rer dev` from the checkout again to return. It reuses a compatible running instance and keeps local records. If startup times out, run the same command again and follow its recovery message. Stop dev or preview before building or verifying. `rer reset --yes` removes local data and settings; it is not a startup repair step.
