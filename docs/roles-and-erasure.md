# People, roles and erasure

Each operator signs in with their own identity. Permissions come from the authenticated session and current operator record.

## Choose a role

The owner holds every action: access and people, integrations, money authorities such as the one-time currency confirmation, and data custody (move-in, backup, restore and erasure). Everyone else holds one role:

| Role | Access |
| --- | --- |
| Portfolio manager | Tenancies, households, renewals and their approval, rent, charge terms and runs, statements, the rent roll, properties and units, inspections, vendors and schedules; approves maintenance within the owner's per-property limit and budget. No access changes. |
| Leasing | Tenancies, households, move-out, transfers, turnovers and renewal proposals. No ledger, receipts, statements, collections, rent-roll money, bank accounts or EINs. |
| Bookkeeper | Rent charges, receipts, corrections, the charge run, arrears follow-ups, statements, collections, the rent roll, legal entities and operating accounts. No people or access. |
| Accountant | Reads every ledger and downloads every statement, rent roll and collections report. Posts nothing. |
| Maintenance coordinator | Inspections, maintenance preparation, quotes, reassignment and handoff, completion records, assets, vendors, schedules and turnovers. Never approves spend, sets owner limits or posts money. |
| Member | Reads their portfolios and prepares renewal, arrears and maintenance proposals for a person to review. |

Each role covers either all portfolios or only the portfolios you assign. Staff reach only tenancies on units in their portfolios: other records answer "not found" on every page, API call and download, and an action outside the role is refused. A tenancy without a unit, and changes to the company, legal entities, operating accounts or the portfolio list, need all portfolios.

Agents should use a member account. A person's own account reviews and approves prepared work. Preparing a proposal never confers approval authority. See the [command API](../API.md) for each command's roles.

## Invite an operator

As owner, open **Data & access**. Under **Invite an operator**, enter the name and email, choose the role and tick **All portfolios** or the portfolios they work in, then select **Send invitation**. The invitee follows their sign-in link to confirm access.

To change someone's role or portfolios later, open **Change role or portfolios** on their row and save. The change applies to their next request and appears under **Role changes**. Moving someone between portfolio manager and any other role also signs them out, because it changes their sign-in tier.

When Terrace was upgraded to these roles, existing admins became portfolio managers over all portfolios and existing members stayed members over all portfolios.

During local development, invitations arrive only in the development outbox. A deployed installation needs working mail provider configuration to deliver invitations; see the repository's [operating instructions](../README.md).

## Two-step sign-in

Open **Data & access**, then **Set up or manage two-step sign-in**. Select **Set up an authenticator**, add the key to an authenticator app (Google Authenticator, 1Password, Authy or similar), enter the 6-digit code it shows, and save the ten recovery codes: each works once and they are not shown again. From then on each new sign-in asks for a code (or one recovery code) before anything else. Five wrong codes in 15 minutes pause attempts for 15 minutes.

As owner, after passing your own authenticator, you can require a second factor for everyone who signs in with an email link; people without one set it up at their next request. People who sign in through your organisation's identity provider follow that provider's MFA instead. If someone loses their device and recovery codes, **Reset authenticator** next to their name lets them set up a new one.

Changing bank references, legal entities, invitations, roles, deactivation, the requirement or a reset also asks you to confirm by email: Terrace sends a link to your address, and the change works for 10 minutes after you open it in the same browser. Signing in by email link counts for its first 10 minutes.

## Remove access

Under **Operators**, select **Deactivate operator** for the person whose access should stop. Their sessions are invalidated. **Activate operator** allows an inactive operator to regain access. Only the owner invites, deactivates or changes roles. Each person should use their own sign-in identity; do not share the owner's sign-in link or credentials.

## Erase a tenancy

Erasure permanently deletes a tenancy and its dependent rent ledger, inspections, photographs, approvals and affected import custody. Other tenancies remain. A minimal audit and hashed email suppression record are retained. Terrace will refuse to reintroduce the erased tenant email through native intake or imports.

1. As owner, open **Data & access** and find **Erase a tenancy**.
2. Expand the exact address and tenant you intend to erase.
3. Type the tenant's exact saved email and select **Permanently erase tenancy**.
4. Download a new backup immediately afterwards to retain the restore fence.

This is a data deletion tool, not an assessment of your record-retention obligations. Decide what you must retain before erasing.

If a retained import CSV contains the erased tenancy alongside others, that original file is withdrawn in full. Other tenancies and their remaining import plans continue to work. See [Move in](move-in.md#authority-archive-restore-and-erasure) for the custody details.

When [restoring an older backup](backup-and-restore.md#keep-erasure-decisions-with-your-backups), provide the later archive as the erasure journal. Offline copies do not learn about erasures automatically.

## History

**Data & access** links to **History** for the owner, portfolio managers and accountants. It lists every change, with who made it, their role and its version at the time, the tenancy, the source they gave (a lease reference, receipt reference or reason) and the outcome, plus sensitive reads (statements, rent rolls, collections, photo and packet downloads) and exports (backups, readable exports, history exports). Portfolio managers and accountants see history about tenancies in their portfolios; the owner and accountants can export it as CSV, and each export is itself recorded. History, rent charges, receipts and corrections cannot be edited or deleted; only erasing a tenancy or undoing a move-in removes that tenancy's money records.

