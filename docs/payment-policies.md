# Reviewed payments and financial corrections

These doors record approved policies and external financial facts. They initiate no processor payment, refund, ACH instruction or negotiable check. Pending funds, settled allocations and unapplied credit stay distinct. PAY-005, PAY-006 and PAY-009 remain partial with the specific approval and rail gaps in CONTRACT.md.

## Lease payment policy

The owner records `payment.policy` with tenancyId, current version (0 initially), reference and terms. The API terms shape is:

```json
{"stages":[{"minDaysPastDue":0,"allowPartial":true,"overpayment":"reject"}],"priority":["CHARGE_ID"]}
```

The native ledger form uses stage controls and named charge allocation positions; it requires no JSON or household ids. Stages have increasing, unique day thresholds beginning at zero. Allocation positions are unique and every unpaid charge must be included before funds can be admitted. A new policy version preserves prior decisions.

Each assigned active PORT-008 state/local pack must supply `partialPayments.value.stages` with the same explicit stage fields. Missing/inactive data holds admission without a default. Admission uses property-local today and the oldest outstanding charge, selecting the last threshold no greater than its days past due separately in the lease and every pack. Every rule must permit a partial amount or separate credit. An older externally recorded initiation date does not bypass today's stage.

## External payment records

`payment.record` takes tenancyId, amount (USD decimal), state (pending/settled), method (ach/card/cash/check/other), receivedDate, unique reference and payerKind (resident/co_tenant/housing_authority). A co-tenant needs payerId and membership covering the payment day. A housing-authority payment needs that day's effective approved signed lease HAP obligation; its name and source version come from the lease, never a client-substituted payer name. This does not prove PAY-013 subsidy entitlement or reconciliation.

Pending records reserve exact charge allocations atomically but reduce no receivable. Settled funds become charge receipts in the approved order; an allowed excess remains separate unapplied credit, excluded from charge receipts and owner income. No credit is automatically spent or transferred. Credit custody accounting/use and future collection rails remain open.

`payment.settle` and `payment.fail` take paymentId, reviewed version, on and an external outcome reference. Settlement turns the original reserved allocation into receipts once; failure releases the reservation. Both retain the original policy/source snapshot. A settlement cannot replay after restart or restore. Every existing receipt/reduction door, including concessions and month-close corrections, respects reservations through database guards. A lease that enables policy records funds through the split-payment door instead of bypassing it through a single-charge receipt.

Policy configuration is owner-only. Recording and outcomes preserve existing TER-004/ROLE-001 rent.receipt authority (owner, scoped portfolio manager/bookkeeper). API credentials cannot post. Full policy, payer and source details are restricted to those recording roles; other ledger readers receive aggregate pending/credit figures. These conservative configuration/disclosure defaults await ct approval.

## Late-fee schedules

Owner-only `latefee.policy` takes tenancyId, chargeId (confirmed USD monthly rent), current version, reference and terms: fullUnpaidDays, feeCents, capCents, weekendRule (calendar/next_business_day), excludeTimely (boolean). Native forms translate decimal USD exactly. A fee charge never becomes a fee basis.

Every active state/local `lateFee` field must state its monthly_rent basis and cap fields, fullUnpaidDays, weekendRule, explicit holidays (ISO days), pendingPolicy (exclude_timely/count_pending) and reversalPolicy (hold/recalculate_once). Unsupported or absent values hold action. Lease terms can only lower the fee/cap, extend grace, defer charging to a business day or protect timely pending funds. The applicable packs all constrain the calculation; no reviewed legal values ship with Terrace.

`latefee.preview` takes tenancyId and an elapsed property-local schedule day on, returning lines and a fingerprint. `latefee.post` takes the same fields and fingerprint. Posting fences the source balance, reservation, policy, jurisdiction, pack and structure unit count; changed inputs require a new review. A source rent charge gets at most one fee.

Eligibility reconstructs unpaid principal at the first eligible fee day (or the earlier schedule day). Paying late principal later does not erase an earned fee. Timely means initiated before that first fee day; successful delayed settlement keeps its protection. A failed timely pending payment follows the explicit reversal policy. Existing fees recalculate under their original frozen lease/pack snapshot and may only be reduced, never increased or compounded. A paid/reserved reduction is held for reviewed refund/reallocation.

`latefee.waive` takes feeId, amount, on, reason and unique reference. The original fee, calculation, actor and reason remain. Native charge/reduction journal triggers preserve owner effects. Detailed fee policies/snapshots are owner/portfolio-manager only; underlying charge balances remain available under existing ledger rights. PAY-006 awaits ct approval of owner-only configuration, reviewed manual schedule execution and waiver authority. Synthetic pack tests claim no Terrace counsel review.

## Approved external refunds and corrections

`finance.prepare` takes kind (refund/credit/write_off), amount, on, reason and preparation reference. A refund takes receiptId, exact payee and method (original/ach/check); original requires the recorded payment method. Check preparation also needs forwardingAddress and externally assigned bank checkNumber (digits). A credit/write-off takes chargeId. The response contains id, version, fingerprint and exact before/after resident and owner effects.

`finance.revise` takes actionId, current version and complete replacement fields. Changing the source invalidates approval and retains prior revisions. `finance.approve` takes actionId/version/fingerprint. Only the owner or in-scope portfolio manager handles these actions. ROLE-003 independence applies; a sole operator is explicitly labelled. Approval reserves refundable receipt capacity. Changed source balances, reservations, owner effects or authority require new review.

`finance.record` takes the approved actionId/version/fingerprint, unique externalReference and confirm: RECORDED. It requires Base's fresh email-link proof and rechecks live approver authority/portfolio scope. Repeating the same external reference returns the existing result; another reference or stale revision is refused. A staff-entered reference is not a provider receipt or verified bank settlement.

Refunds reopen only the refunded receipt amount. Cash follows the original frozen owners even after ownership transfers. Each new refund uses each original owner's remaining receipt allocation: integer division floors each proportion, then remainder cents follow descending remaining allocation, owner id on a tie, capped at that owner's remaining amount. Past allocations remain frozen. Repeated small or large refunds never overdraw an original allocation. Review also checks each original owner's recorded property operating cash; another owner/fund cannot supply it.

Owner before/after figures cover the property's operating ledger, not a bank balance or disbursement authority. Credits/write-offs use the existing reduction journal and posting-day ownership, reducing lease income or tax liability rather than claiming a cash refund. An already partially refunded receipt cannot also be fully reversed; refund only its remaining amount.

`finance.check` registers an unchanged approved numbered forwarding-address draft. The draft is non-negotiable: no check is printed, mailed or issued. Staff may subsequently record an actual externally issued check reference; the register distinguishes draft and external-record states and never claims clearance. Revised/cancelled draft numbers remain reserved. Provider execution/reconciliation, ACCT-017 negotiable check issuance and ACCT-018 ACH acceptance remain open.

`finance.cancel` takes actionId/version/fingerprint and reason. It cancels an unexecuted pending/approved action, releases its source reservation and retains history. Cancelled actions cannot execute, be revised or reapproved; prepare a new action. Recorded actions need a new correction instead. Financial details/forwarding addresses are owner/scoped-portfolio-manager only; API credentials and ordinary ledger readers receive no action details. The conservative authority/external-record default awaits ct approval.

## Resident monthly statements (PAY-010 partial)

Full resident grants open `/portal/statement?tenancyId=ID&month=YYYY-MM&format=html|csv|json` from their lease account. Months end on their calendar last day, or property-local today in the current month; future months are refused. Opening/closing receivables follow dated charges, net receipts/refunds and reductions known now. Reductions use their approved posting day, or property-local recorded day when absent. Current recorded balance is separate from the month's closing, as-of pending funds and settled unapplied credit; neither pending nor credit is automatically deducted.

`/portal/transaction?tenancyId=ID&id=SOURCE` inspects an opaque source id from the statement (JSON with format=json). It shows only the financial kind, date, amount and matching charge. Other household contacts, arbitrary staff notes and private provider/bank references are excluded. Only full residents reach these new doors; delegated contacts keep their existing balance/charges CSV and receive no monthly payment/source details. Every request rechecks the live session/grant.

Accessible HTML and Unicode CSV ship. Accessible PDF, delivered invoices/receipts and failed-email follow-up remain open. Unsupported PDF is explicitly refused. A projection/download is never delivery; no automatic send is added. Staff delinquency JSON/CSV/native screens show matching dated external pending funds separately and reconstruct source-limited refunds and approved correction dates.

## Retention and portability

SAFE-004 accounting retention/holds and subject access cover these records. Personal payer, policy, forwarding-address and cancellation references are redacted when the retention/hold fence permits, while amounts and accounting links remain. Backup/readable export preserve policy versions, source allocations, original signed lease files, approval/outcome history and check drafts. Import undo/compensation detects the new native work. Restore validates payment totals/reservations, exact approved financial revisions, original owner/fund refund limits and frozen late-fee amounts before installing any product row. Restoring records grants no source staff or portal authority and initiates no payment/send.
