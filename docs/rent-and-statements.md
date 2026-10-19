# Rent, arrears and owner statements

Use **Rent & arrears** for the selected tenancy's charges, recorded receipts and corrections. An owner or admin records these entries and downloads statements. Members can read the ledger and prepare an arrears follow-up.

Terrace records money already received elsewhere. Collection, bank reconciliation, trust accounting and disbursements stay in your existing systems.

## Add a rent charge

Choose the tenancy, then use **Add rent charge**. Enter the due date, amount in the tenancy's currency (USD; a tenancy recorded before Terrace stored a currency shows “currency unconfirmed” until the installation owner confirms AUD or USD on Data & access, and is never converted), description and a unique charge reference. Select **Record charge**.

The tenancy's rent fills the amount as a starting value; check it before saving. Enter each charge you intend to record. A saved tenancy or renewal does not itself create rent charges.

## Record money received externally

1. Confirm the money has already arrived in your external system.
2. Under **Record external receipt**, choose the unpaid charge.
3. Enter the amount, received date and unique external receipt reference.
4. Select **Record receipt** and check **Recorded receipts**.

A receipt cannot exceed the selected charge's unpaid balance or use a future received date. Duplicate references are refused without duplicating the recorded amount. Use references that let you find the original bank or receipt record.

## Reduce an incorrect charge

Open **Reduce an incorrect charge**, choose the unpaid charge and enter the reduction and reason. Select **Record charge reduction**. The reduction cannot exceed the unpaid balance. The explained correction appears under **Charge reductions**; the original charge remains recorded.

## Review arrears

**Outstanding** shows unpaid charges after receipts and reductions. **Overdue as of today** shows unpaid balances for charges with a due date before today at the property, in the property's time zone.

Under **Prepare arrears follow-up**, enter a message and follow-up date. Select **Prepare follow-up**. An owner or admin reviews it in the tenancy's **Prepared decisions**. No message is sent by preparation or approval; handle communication in your established workflow.

## Post recurring charges

Under **Recurring charges**, an owner or admin adds the tenancy's lease charge terms: rent, utility, pet, parking or a concession, each with an amount per billing period and a start date (and an end date if it stops before the lease ends). A monthly tenancy bills calendar months; a weekly or fortnightly tenancy bills 7- or 14-day periods from its lease start.

Under **Charge run**, choose a month and select **Preview charge run**. The preview lists every line for periods starting that month across the portfolio, marked new or posted, and any period with no rent term under **Missing terms**. A partly covered period, such as a mid-month move-in, is prorated by days and rounded half up to the cent; a concession reduces that period's rent charge. Select **Post** to record the new lines. Posting again, or previewing a month already posted, never records a period twice.

To change rent from a future date, open **Amend from a date** on the term and enter the effective date and new amount. The date must follow the term's last posted period; posted charges never change. Approving a renewal does not change these terms: amend the rent term for the renewal's new rent.

## Rent roll and collections

On **Properties**, owners and admins see the **Rent roll** as of a chosen date: each unit's state (occupied, vacant, or vacant with a future lease), resident, lease dates, contract rent on that date (a renewal's new rent starts when the earlier period ends), market rent, recurring charges and concessions, with totals. Filter by property or occupancy and download the same rows as CSV, XLSX or PDF. Deposits are not recorded yet.

**Collections** for a month shows, per lease and in total, what was collected of what was billed for charges due that month, how many leases are paid in full, and each lease's state: paid by ACH, card, cash or check (as recorded with the receipt), partial or unpaid. Record the method when you record a receipt. Terrace holds no pending funds.

## Download an owner statement

Under **Owner statement**, choose **Period start** and **Period end**, then select **Download owner statement**. The end must be on or after the start. The CSV includes the owner and property, the tenancy's currency and the property's time zone, the exact start and end of the period with their UTC offsets (a period crossing a daylight-saving change shows both offsets), opening receivable, charges, external receipts, reductions within the inclusive period and closing receivable.

The opening receivable uses entries dated before the period. Charge entries use their due date; receipts use their received date; reductions use the property-local day they were recorded. Closing receivable equals opening receivable plus period charges, minus period receipts and reductions.

This is a record of rent receivables. It is not a statutory trust, owner disbursement, bank reconciliation or tax statement. Store and share the downloaded CSV with the same care as other tenant and owner records.
