# Backup and restore

Only the installation owner can export or restore a backup. Archives contain personal tenancy and property records: keep them private and store them somewhere separate from the running installation.

## Download a backup

Open **Data & access**, then select **Download installation backup (.rer)**. The archive includes product tables, rent records, photographs, approvals, original import bytes and import journals.

Sign-in sessions, credentials, private configuration and development outbox messages are excluded. A backup does not replace preserving your installation's source and deployment configuration securely.

For a command-line export, run from the installation checkout:

```sh
rer export --output exports/terrace.rer
```

## Restore in the browser

1. Start a separate empty installation with the same product schema and finish its owner setup.
2. Open **Data & access**, then **Restore an archive into this empty installation**.
3. Choose the **Backup archive**. Browser uploads accept archives up to 20 MB.
4. If restoring an archive made before an erasure, choose a later backup from the same source as **Later backup / erasure journal**.
5. Type `RESTORE` and select **Restore archive**.
6. Check the restored tenancies, rent entries, photographs and import journals.

Restore preserves the destination owner and current sign-in. It refuses a nonempty product destination, corrupt archives and data blocked by a supplied later erasure journal. The archive does not bring the source installation's sessions or credentials into the destination.

## Restore with the command line

Use the CLI for archives larger than the browser limit. In an empty destination with the same schema:

```sh
rer import --input /absolute/path/terrace.rer --yes
```

When the source has since erased a tenancy, provide its later archive:

```sh
rer import --input /absolute/path/old.rer --journal /absolute/path/later.rer --yes
```

## Keep erasure decisions with your backups

After [erasing a tenancy](roles-and-erasure.md#erase-a-tenancy), download a new backup. Use that newer backup when restoring. If an older archive is being considered, supply the later archive as the erasure journal. When its fence blocks the old data, restore a backup made after the erasure.

An offline old archive cannot know that a tenancy was erased later. Supplying the later journal carries that decision to the new installation. Erasure in Terrace does not delete copies of archives you have stored elsewhere; manage those copies under your own retention process.

`rer reset --yes` removes local data and settings. Export anything you need to keep before a deliberate reset. Do not reset an existing installation merely to make it an empty restore destination.
