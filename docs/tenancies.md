# Tenancies and renewals

The tenancy holds the property address, owner and tenant details, lease dates, rent and cadence. Owners and admins can add tenancies. Every operator can read them and prepare a renewal for review.

## Record a tenancy

In **Tenancies**, open **Add a tenancy**. Enter the property address, owner and tenant names and emails, lease start and end dates, rent in USD, the property's time zone and weekly, every-two-weeks or monthly cadence. Check the saved details before recording rent or inspection work.

For existing records in bulk, use the [Move in CSV kit](move-in.md).

## Properties and units

Under **Properties**, an owner or portfolio manager adds a portfolio, its properties (name, address, kind and time zone) and each property's units (identifier, bedrooms, bathrooms, amenities and whether it is rentable). When adding a tenancy, choose its unit: the tenancy takes the unit's address and the property's time zone. A unit holds one lease at a time; a unit that is not rentable takes no new lease.

Each unit shows its occupancy today (occupied, vacant with a future lease, or vacant) and every lease it has held, with dates. To end a lease early, open **End lease or transfer** on it and enter the move-out date and reason; the lease record and its original end date are kept. To move a resident to another unit, choose the unit and move-in date and select **Transfer resident**: the first lease ends the day before and a linked lease starts on the new unit with the same terms.


## Owners and management agreements

Under **Owners** on the Properties page, the owner or a portfolio manager over all portfolios adds each property owner (an individual or an entity) and records their W-9 as requested, then received with where the signed form is kept. Terrace stores no taxpayer identification number and has not validated one.

On each property, **Change ownership** records the owners' shares from a date; they must total exactly 100%. To record a sale, enter the new shares from the transfer date: the seller's share ends the day before. Earlier ownership stays in **Ownership history** and cannot be edited. **Record management agreement** sets the fee as a percent of collected rent and the reserve requirement from a start date.

**Download allocation statement** lists, for one owner and period, each recorded receipt on their properties split by the shares in force on its received date (the remainder cent goes to the largest share), the management fee and net, and the owner's share of the reserve requirement on each side of any transfer. Reserve lines are requirements, not cash held. Expenses are not included until vendor bills are recorded.

## Households

On a tenancy page, **Household** lists the tenant (the primary resident) and anyone added with **Add a household member**: co-tenants, guarantors, occupants, emergency contacts and authorized contacts, with contact details, how they prefer to be contacted and the day they joined. The page shows who is liable for this lease's balance (the resident, co-tenants and guarantors), who receives lease notices and statements (the resident, co-tenants, guarantors and authorized contacts, except anyone who asked not to be contacted), and who may see lease documents (the same people, whatever their contact preference). Terrace lists recipients; it sends nothing.

Use **Leave or move** to record that someone left, or to move them to another lease from a date: they leave this household the day before and join the other one. Each lease keeps its own balance.

## Make a unit ready

When a unit is vacant (or a resident has given notice), open **Open make-ready board** on it with the move-out date. The board lists the standard tasks: move-out inspection and utility transfer, then the deposit disposition and repairs, then cleaning and the listing. Each task shows its planned dates; edit a task's assignee, duration, delay or quote and the dependent tasks and the planned ready date move with it. The board shows how many days the unit stays vacant.

Anyone can mark a task done with **Submit done**; an owner, portfolio manager, leasing staff member or maintenance coordinator then checks it, and only once the tasks before it are checked. When every task is checked, **Publish available date** records when the unit is ready: the later of the planned ready date and the day after the last check. The deposit and listing tasks prepare those decisions; Terrace does not move deposit money or publish listings.

## Prepare a renewal

1. Open the tenancy in **Tenancies**.
2. Under **Prepare a renewal**, enter the proposed lease end and proposed rent in USD.
3. Add the **Lease reference / reason** so the reviewer can trace the terms.
4. Select **Prepare renewal**.

The proposed end must be later than the current lease end. Preparing saves a pending proposal; it does not change the tenancy. An agent or member account hands the prepared decision to a person with approval authority.

## Review the decision

An owner or portfolio manager opens **Prepared decisions** for the tenancy, checks the proposed terms and reference, then chooses **Approve renewal** or **Reject proposal**.

Approval records the authenticated reviewer and decision time, archives the previous lease terms and updates the tenancy's end date and rent. Rejection records the decision without changing the terms. Previous terms remain in the backup archive.

A proposal refers to the tenancy version that was current when it was prepared. If the tenancy changed, a stale decision is refused. Check the current details and prepare a new proposal for review.

## Arrears decisions

[Rent & arrears](rent-and-statements.md) contains **Prepare arrears follow-up**. Its message and follow-up date appear in **Prepared decisions** on the tenancy. An owner or portfolio manager reviews and approves or rejects it there. Approval records the follow-up decision; it does not send a message.

Terrace does not generate or serve statutory notices. Keep any required legal notice and delivery process in your established workflow.

## Signed lease versions and amendments

Open a tenancy’s **Signed lease versions** and choose **Record a signed lease or amendment**. Record the effective date, signer names, signed date and reference, upload the original PDF, and enter the complete charge schedule and other obligations. Each line names the source clause; use an explicit “none” for obligation kinds absent from the signed document. HAP obligations record authority and payer portions, while their actual posting belongs to the voucher-rent workflow. These are signatures recorded by staff, not signatures collected or verified by Terrace.

Choose **Preview lease charges** for a month at or after the effective date. A different owner or portfolio manager reviews and approves that exact preview (a sole operator’s approval is labelled). Then use **Rent & arrears → Preview charge run** to post those same charges. A mid-month amendment prorates each effective portion by its covered days. Posted periods and earlier signed versions remain unchanged; signed amendments cannot be bypassed through the old add/amend-term forms.

Owners, portfolio managers, bookkeepers and accountants can download original PDFs within their portfolio scope. Downloads are private and audited. Backups and readable exports include versions, original PDFs and hashes. The lease retention period and legal holds apply before erasure.
