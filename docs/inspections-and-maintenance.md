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

1. An owner or portfolio manager reviews the scope, vendor details, date and estimate, then selects **Approve maintenance**.
2. Terrace saves an approval snapshot and changes the job to **Approved · awaiting external handoff**.
3. Select **Download approved email packet (.eml)**.
4. Open the packet in your own email client, check it and send it to the vendor.
5. After sending, enter an **Email or external handoff reference** and select **Record external handoff**.

Downloading an `.eml` file does not send it. The final state, **Sent · external handoff recorded**, means a person recorded the external handoff. Terrace does not deliver the maintenance email or confirm receipt by the trade.

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

