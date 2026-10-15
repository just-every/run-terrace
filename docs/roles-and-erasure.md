# People, roles and erasure

Each operator signs in with their own identity. Permissions come from the authenticated session and current operator record.

## Choose a role

| Role | Access |
| --- | --- |
| Owner | All property operations, approvals, imports, backups, restore, erasure and operator management. |
| Admin · property manager | Add tenancies, record rent, complete inspections, approve proposals and maintenance, record external handoffs and download owner statements. |
| Member · preparer | Read the portfolio and prepare renewal, arrears and maintenance proposals for a person to review. |

Agents should use a member account. A person's owner or admin account reviews and approves prepared work. Preparing a proposal never confers approval authority. See the [command API](../API.md) for integration details.

## Invite an operator

As owner, open **Data & access**. Under **Invite an operator**, enter the name and email, choose member or admin, then select **Send invitation**. The invitee follows their sign-in link to confirm access.

During local development, invitations arrive only in the development outbox. A deployed installation needs working mail provider configuration to deliver invitations; see the repository's [operating instructions](../README.md).

## Remove access

Under **Operators**, select **Deactivate operator** for the person whose access should stop. Their sessions are invalidated. **Activate operator** allows an inactive operator to regain access. Each person should use their own sign-in identity; do not share the owner's sign-in link or credentials.

## Erase a tenancy

Erasure permanently deletes a tenancy and its dependent rent ledger, inspections, photographs, approvals and affected import custody. Other tenancies remain. A minimal audit and hashed email suppression record are retained. Terrace will refuse to reintroduce the erased tenant email through native intake or imports.

1. As owner, open **Data & access** and find **Erase a tenancy**.
2. Expand the exact address and tenant you intend to erase.
3. Type the tenant's exact saved email and select **Permanently erase tenancy**.
4. Download a new backup immediately afterwards to retain the restore fence.

This is a data deletion tool, not an assessment of your record-retention obligations. Decide what you must retain before erasing.

If a retained import CSV contains the erased tenancy alongside others, that original file is withdrawn in full. Other tenancies and their remaining import plans continue to work. See [Move in](move-in.md#authority-archive-restore-and-erasure) for the custody details.

When [restoring an older backup](backup-and-restore.md#keep-erasure-decisions-with-your-backups), provide the later archive as the erasure journal. Offline copies do not learn about erasures automatically.
