# Inspections and maintenance

Open **Inspections & maintenance** and choose the tenancy. Owners and admins record inspections and approve maintenance. Every operator can read the records and prepare maintenance for review.

## Complete a photographed inspection

1. Open **New inspection**, enter the inspection date and any initial notes, then select **Create inspection draft**.
2. In the draft, choose a JPEG or PNG up to 1.5 MB and select **Save photo evidence**. Repeat to retain further photos.
3. Check the saved photographs and enter the inspection notes.
4. Select **Complete inspection**.

Completion requires notes and at least one saved photo. The completed record retains the date, notes, photographs, completion time and actor. **Evidence details** shows each photo's filename, size, upload actor and time, and SHA-256 fingerprint. The filename link opens the saved image.

## Prepare maintenance

Under **Prepare maintenance**, enter the work required, vendor name and email, due date and estimate in USD. Select **Prepare for approval**.

The new job reads **Prepared · awaiting approval**. Preparing does not approve the work or contact the vendor. A member-account agent stops here and hands the job to a person for review.

## Approve and send the packet

1. An owner or portfolio manager reviews the scope, vendor details, date and estimate, then selects **Approve maintenance**. Whoever prepared the work, or last changed its terms (scope, estimate, quote or vendor), cannot approve it; another approver must. If nobody else could approve, Terrace keeps your own approval labelled “self-approved: no second person”.
2. Terrace saves an approval snapshot and changes the job to **Approved · awaiting external handoff**.
3. Select **Download approved email packet (.eml)**.
4. Open the packet in your own email client, check it and send it to the vendor.
5. After sending, enter an **Email or external handoff reference** and select **Record external handoff**.

Downloading an `.eml` file does not send it. The final state, **Sent · external handoff recorded**, means a person recorded the external handoff. Terrace does not deliver the maintenance email or confirm receipt by the trade.

## Dispatch and record technician replies

Local dev and demo suppress maintenance mail. Selecting **Dispatch approved work by email** there records a suppressed attempt, leaves the work awaiting dispatch and does not unlock technician replies or escalation. Every approval permits one dispatch attempt, including a suppressed attempt. Use the downloadable packet and record the external handoff to try that local path instead.

To try provider dispatch, use a deployed installation with working mail. For the declared Resend provider, configure `MAIL_PROVIDER=resend`, a verified sender in `MAIL_FROM`, and a private `MAIL_API_KEY`; follow the [deployment instructions](../README.md#deploy-to-your-cloudflare-account). This requires the account owner's provider configuration. Do not put credentials in Git.

1. Prepare and approve work in that installation, then choose **Dispatch approved work by email**. Check the recorded outcome. Provider acceptance does not establish delivery or completion.
2. After an accepted dispatch, open **Record technician progress**. Enter the **Technician state** and **Reply source and next action**, then select **Record technician reply**. Receive the reply outside Terrace and record its source; this flow does not automatically ingest inbound email. Completion also needs the approved checklist tasks.
3. If the due date or arrival window is missed, enter **Human escalation, contact evidence and next action** and select **Record human escalation**. Technician progress does not resolve the resident issue.

## Check the retained evidence

**Approval evidence** shows the reviewer, role, approval time, approved version, snapshot and snapshot fingerprint. The approved email packet remains downloadable, and the job retains the external handoff reference and recording actor and time.

Approvals and changes check the current version. If another action changed the record, reopen the current page and review it before acting. [Backups](backup-and-restore.md) include photographs and approval records.

## Recurring maintenance

Under **Recurring maintenance**, an owner, portfolio manager or maintenance coordinator adds a schedule: the work, trade, directory vendor, an optional asset or completed inspection it comes from, how many months between occurrences, the first due date, a budget per occurrence and how many days ahead orders are created.

Select **Run the scheduler** to create one order, awaiting approval, for each occurrence due within its lead days. Running it again never creates a second order for the same occurrence. Before an occurrence has an order you can defer it to a later date with a reason. An occurrence past its due date whose order has not been handed off appears under **Overdue occurrences**. When an asset is replaced, its schedules follow the replacement.

## Vendors

Under **Vendors**, an owner, portfolio manager or maintenance coordinator keeps the vendor directory: name and contact details, specialties (trades such as plumbing or hvac), service areas (ZIP codes or cities), W-9 status, insurance and license expiry, availability, hourly rate and standing (preferred, approved or blocked).

When preparing maintenance, choose a directory vendor and the trade. Terrace checks that the vendor has that specialty, serves the property, has a received W-9 and is insured (and licensed, when a license is recorded) through the due date. Work for a vendor that does not qualify, or for an unlisted vendor, is held: the job shows each issue, and approval and the recorded handoff are refused until an owner or admin records a documented exception for those issues. Qualification is checked again at approval and handoff, so a vendor whose insurance lapses after preparation is held too. Prepared work can be reassigned to another vendor before approval.

## Assets and warranties

Under **Assets & warranties**, an owner, portfolio manager or maintenance coordinator records the selected tenancy's installed equipment: what it is, where it is, make, model, serial number and installed date, with an optional warranty provider and end date, a manual link or where the manual is kept, and a planned replacement date and cost.

When preparing maintenance, choose the asset the repair is for. A repair due on or before the asset's warranty end is listed as **under warranty** with the provider to claim from; any other repair is listed as the owner's cost. Approved estimates are totalled per asset. Terrace flags warranty coverage; it does not file or confirm a claim.

To replace equipment, open **Record a replacement** on the asset and enter the new equipment. The old asset stays, marked replaced on the new installed date, with its service history; new repairs link to the replacement.

## Quote requirement

With the owner's spending limit you can record how many quotes the owner wants above an amount (for example two quotes above $400). Work above that amount cannot be approved until that many quotes are recorded on it.

## Service report

On the **Properties** page, **Maintenance service report** downloads a CSV of maintenance jobs, filtered by the date they were prepared, property and status (choose **Unresolved** for the open queue). Each job shows its status, how long it has been open, hours from preparation to the first approval and to the handoff, and hours to the resident's confirmation. A vendor's completion report, a reopened job or a job closed without the resident's confirmation has no resolution time. `GET /api/maintenance-report` returns the same report with vendor performance, asset cost and budget variance. Costs are approved estimates, not invoices. Appointment booking time and open emergencies are listed as not recorded until those features exist.

