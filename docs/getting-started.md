# Getting started

Run Terrace locally, confirm the installation owner and record your first tenancy. You need Git and Node.js 22 or newer; the project command selects its pinned Node runtime.

## Get Terrace and start it

One line installs the RER command, clones the source and runs it:

```sh
npx -y @runeditrun/rer dev just-every/run-terrace
```

Without Node, `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-terrace` does the same. To start it again later, run `cd run-terrace && rer dev`.

The first launch can take several minutes. `rer dev` installs dependencies, prepares the local database and development owner, applies migrations and starts the app. It prints the local address as `RER_READY` and a private sign-in link as `RER_OPEN`.

Open `RER_OPEN` on this computer. It is a credential: keep it private. On **Finish setup**, confirm the owner and finish setup to enter Terrace. Local sign-in and invitations use the development outbox; they send no external email.

For a new installation using your real owner mailbox, run `npx -y @runeditrun/rer install just-every/run-terrace`, then `rer setup` from the checkout before its first `rer dev`, and enter the mailbox at the prompt. Preserve the owner identity in an existing installation. The repository's [operating instructions](../README.md) cover deployment and provider configuration.

## Add the first tenancy

1. Open **Tenancies**, then **Add a tenancy**.
2. Enter the address, property owner's name and email, and tenant's name and email.
3. Enter the lease start and end dates, rent in AUD and rent cadence: weekly, fortnightly or monthly.
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
