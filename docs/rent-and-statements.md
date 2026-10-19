# Rent, arrears and owner statements

Use **Rent & arrears** for the selected tenancy's charges, recorded receipts and corrections. An owner or admin records these entries and downloads statements. Members can read the ledger and prepare an arrears follow-up.

Terrace records money already received elsewhere. Collection, bank reconciliation, trust accounting and disbursements stay in your existing systems.

## Add a rent charge

Choose the tenancy, then use **Add rent charge**. Enter the due date, amount in the tenancy's currency (USD; a tenancy recorded before USD keeps AUD and is never converted), description and a unique charge reference. Select **Record charge**.

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

## Download an owner statement

Under **Owner statement**, choose **Period start** and **Period end**, then select **Download owner statement**. The end must be on or after the start. The CSV includes the owner and property, the tenancy's currency and the property's time zone, the exact start and end of the period with their UTC offsets (a period crossing a daylight-saving change shows both offsets), opening receivable, charges, external receipts, reductions within the inclusive period and closing receivable.

The opening receivable uses entries dated before the period. Charge entries use their due date; receipts use their received date; reductions use the property-local day they were recorded. Closing receivable equals opening receivable plus period charges, minus period receipts and reductions.

This is a record of rent receivables. It is not a statutory trust, owner disbursement, bank reconciliation or tax statement. Store and share the downloaded CSV with the same care as other tenant and owner records.
