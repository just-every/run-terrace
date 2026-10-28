# Terrace Agent surface (draft)

Draft Agent surface for Terrace, written by ct on 28 October 2026 to the contract standard's section 13. It maps every Core clause of `CONTRACT.md` at main `dcc5a3e6c7181c3060c4a87404ee0c03399123a9` (143 Core clauses). It is not part of CONTRACT.md yet: the seed's contract cleanup folds the `### Agent surface` area below into CONTRACT.md as the last area under Target clauses, and the rows under "Status rows" into its Status table. Old clauses whose text fixes what happens to an agent's step: ROLE-003, LEASE-009, WORK-001, WORK-003, OPS-001, OPS-003, SAFE-001, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009; the cleanup rewords them as the class the step carries.

### Agent surface

**Specialist: Residential portfolio steward.** It keeps homes occupied, rent and trust records reconciled, repairs completed and residents, owners and vendors informed through each lease's lifecycle.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call.

**How Terrace computes each class.** The server uses typed arguments, current native records, actual content and verified provider responses; caller flags and imported or conversational text cannot lower a class. Today names the existing native action or route and its bounded scope, rather than claiming MCP exists; `none` means the job has no native implementation. Repeated Core ids identify separate jobs within the same clause.

- *standard:* internal reads, drafts and operational edits reversible through native revision, cancellation or correction; facts are affected item ids and count. It accompanies no irreversible, financial or binding effect merely because that effect began as a draft.
- *external:* publication, messages, exports or submissions reaching residents, owners, vendors, applicants, marketplaces or other services outside the management business. Internal staff-only content stays standard. Facts are recipient count and counterparty: known for a current recorded customer, owner, vendor or trusted domain; new otherwise; public for an open listing or link. Updating an already exposed document counts as exposure too.
- *money:* posting or changing rent, fees, concessions, deposit obligations, payables or recoveries, or charging, refunding, transferring or distributing funds. Facts are exact cents, stored currency, payee or payer, beneficiary and paying account. Estimates, forecasts and source-cost comparisons alone carry no money class.
- *commitment:* binding lease or management terms, applicant offers, vendor acceptance, signed artifacts, jurisdictional publication, accounting sign-offs and referrals whose sign-off others rely on. Facts are exact revision, counterparty and stated value; drafting or requesting changes alone does not bind anything.
- *gated:* a provider response requires its hosted consent, payment authentication, identity/business verification or terms in a person's name. Facts are provider and exact step; the same job without that response carries no gated class. The provider's interactive step stays at that provider.
- *access:* staff invitations, role or portfolio assignments, portal membership, devices, integration permissions and agent credentials or sponsor reassignment. Facts are affected people, native before/after authority and direction widens or narrows; agent-supplied direction has no effect.
- *security:* factor requirements, credential custody/rotation, scanner configuration or release, protected bank-destination settings and custody exports. Facts name the setting or credential reference, without secret values.
- *destructive:* erasing eligible records, originals or delivery snapshots without product Undo; facts are item ids and count, with retention and hold results.
- *sensitive:* protected content actually read, uploaded, exported or sent contains health, full identity, bank, card or payroll numbers. Facts are record count and data kind; ordinary names, private operational notes, bank last-four references and masked fields alone do not qualify.
- *live:* activating or retiring a running workflow, scheduler, rule pack, listing or integration changes service behavior for users. Facts name the installation service and before/after revision.

Terrace uses no accounts class: creating identities or paid resources at outside providers is an installation fact, outside these tools. A dot between classes means always both; `or` chooses from current facts; `(+ class)` adds that class when its computation above holds. No tool accepts a person's password, 2FA code or CAPTCHA solution.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `terrace.company.get` | Read company, entity and currency settings | PORT-001 | standard | `GET /api/state` |
| `terrace.company.save` | Revise office identity and timezone | PORT-001 | standard | `company.save` |
| `terrace.entities.create` | Add a legal entity reference | PORT-001 | standard | `entity.add` |
| `terrace.bank_references.create` | Record an operating account reference | PORT-001 | security | `account.add` |
| `terrace.currency.confirm` | Record historical currency identification without conversion | PORT-001 | commitment | `currency.confirm` |
| `terrace.properties.list` | Read properties, units and dated occupancy | PORT-002 | standard | `GET /api/v1/properties` |
| `terrace.properties.create` | Add a property in a portfolio | PORT-002 | standard | `property.add` |
| `terrace.units.create` | Add a rentable unit | PORT-002 | standard | `unit.add` |
| `terrace.units.update` | Revise unit attributes or rentable state | PORT-002 | standard | `unit.update` |
| `terrace.leases.get` | Read linked tenancy terms and history | TER-002, PORT-005 | standard (+ sensitive) | `GET /api/v1/leases` |
| `terrace.leases.create` | Create a tenancy on a unit | TER-002 | money · commitment | `tenancy.create` |
| `terrace.leases.transfer` | Transfer obligations between units | PORT-002, PORT-006 | money · commitment | `tenancy.transfer` |
| `terrace.leases.end` | Record dated end of possession | PORT-006 | commitment | `tenancy.end` |
| `terrace.checklists.record` | Append a move-in or move-out checklist revision | PORT-006 | standard | `move.checklist` |
| `terrace.owners.list` | Read dated owners and shares | PORT-003 | standard | `GET /api/state` |
| `terrace.owners.create` | Add an owner contact | PORT-003 | standard | `owner.add` |
| `terrace.ownership.set` | Record a new dated share set | PORT-003 | commitment · access | `ownership.set` |
| `terrace.agreements.set` | Record effective fees and reserve terms | PORT-003, ACCT-009 | money · commitment | `agreement.set` |
| `terrace.households.list` | Read dated household roles and recipients | PORT-004 | standard | `GET /api/v1/households` |
| `terrace.households.add` | Add a dated household member and their rights | PORT-004 | access | `household.add` |
| `terrace.households.leave` | End household membership and its rights | PORT-004 | access | `household.leave` |
| `terrace.households.move` | Move membership to another lease | PORT-004 | access | `household.move` |
| `terrace.lease_versions.prepare` | Prepare source-linked lease terms | PORT-005 | standard (+ sensitive) | `lease.prepare` |
| `terrace.lease_versions.preview` | Compute charges from the exact version | PORT-005 | standard | `lease.preview` |
| `terrace.lease_versions.activate` | Activate versioned economic obligations | PORT-005 | money · commitment | `lease.approve` |
| `terrace.renewals.prepare` | Prepare sourced term alternatives | TER-003, AGENT-005 | standard | `renewal.prepare; agent.enqueue renewal slice` |
| `terrace.renewals.decide` | Bind or decline exact recorded renewal terms | TER-003 | commitment (+ money) | `proposal.approve / proposal.reject` |
| `terrace.renewals.schedule` | Create a lease-end campaign window | LEASE-012 | standard | `renewal.schedule` |
| `terrace.renewals.send` | Deliver the exact renewal offer | LEASE-012 | external · commitment | `renewal.send` |
| `terrace.renewals.reply` | Record a sourced reply without inventing a signature | LEASE-012 | standard | `renewal.reply` |
| `terrace.renewals.activate` | Activate the executed future schedule | LEASE-012, AGENT-005 | money · commitment | `lease.approve via renewal version` |
| `terrace.renewals.close` | Record nonresponse or nonrenewal with next action | LEASE-012 | standard | `renewal.close` |
| `terrace.arrears.prepare` | Draft a dated follow-up | TER-005, AGENT-004 | standard | `arrears.prepare` |
| `terrace.arrears.decide` | Record the exact follow-up decision | TER-005 | commitment | `proposal.approve / proposal.reject` |
| `terrace.arrears.compare` | Compare plan, notice and waiting by cash and vacant days | AGENT-009 | standard | none |
| `terrace.plans.offer` | Offer a source-linked payment plan | PAY-011, AGENT-004, AGENT-009 | external · commitment | none |
| `terrace.plans.record` | Record a dated promise or plan reply | PAY-011 | standard | none |
| `terrace.rent.charge` | Post a reasoned charge | TER-004 | money | `rent.charge` |
| `terrace.rent.receipt` | Record an externally received payment once | TER-004, PAY-007 | money | `rent.receipt` |
| `terrace.rent.reduce` | Post an explained charge reduction | TER-004 | money | `rent.adjust` |
| `terrace.terms.create` | Set future recurring charge terms | PAY-001 | money · commitment | `term.add` |
| `terrace.terms.amend` | Revise unposted future charge terms | PAY-001 | money · commitment | `term.amend` |
| `terrace.charges.preview` | Preview property-local recurring charge lines | PAY-001 | standard | `charges.preview` |
| `terrace.charges.post` | Post the exact preview once | PAY-001 | money | `charges.post` |
| `terrace.payments.collect` | Initiate an authorized ACH collection | PAY-002, BOUND-001 | money · external (+ gated) | none |
| `terrace.payments.card` | Initiate hosted card collection | PAY-003 | money · external (+ gated) | `payment.card (Stripe test only)` |
| `terrace.payments.reconcile` | Reconcile canonical collection outcomes | PAY-003, PAY-008, PAY-012 | standard or money | `payment.card.reconcile (test card only)` |
| `terrace.payments.policy` | Set partial and split-payment admission rules | PAY-005 | money · live | `payment.policy` |
| `terrace.payments.reserve` | Reserve pending external funds against charge capacity | PAY-005 | money | `payment.record (external fact only)` |
| `terrace.payments.settle` | Allocate externally settled funds once | PAY-005, PAY-007 | money | `payment.settle (external fact only)` |
| `terrace.payments.return` | Reverse a failed or returned collection | PAY-007, PAY-008 | money | `payment.fail (pending external funds only)` |
| `terrace.autopay.authorize` | Record a sponsor-attributed mandate | PAY-004 | money · commitment · external (+ gated) | none |
| `terrace.autopay.cancel` | Cancel unsent mandate attempts | PAY-004 | money · external | none |
| `terrace.latefees.preview` | Compute grace, fee and pack source facts | PAY-006 | standard | `latefee.preview` |
| `terrace.latefees.post` | Post a fee against its exact basis | PAY-006 | money | `latefee.post` |
| `terrace.latefees.waive` | Reduce an eligible fee with a reason | PAY-006 | money | `latefee.waive` |
| `terrace.refunds.prepare` | Draft a refund, credit or write-off and its effects | PAY-009 | standard (+ sensitive) | `finance.prepare` |
| `terrace.refunds.authorize` | Bind the exact refund or credit revision | PAY-009 | money · commitment | `finance.approve (external-record slice)` |
| `terrace.refunds.execute` | Execute an original-method or forwarding-address refund | PAY-009, ACCT-004 | money · external (+ gated, + sensitive) | `none; finance.record records external execution only` |
| `terrace.statements.get` | Read an itemized resident or period statement | TER-006, PAY-010, PORTAL-001 | standard (+ sensitive) | `GET /api/state; GET /api/statement` |
| `terrace.statements.prepare` | Freeze an itemized resident document | PAY-010 | standard (+ sensitive) | `resident.delivery.prepare` |
| `terrace.statements.send` | Deliver the selected statement link | PAY-010 | external (+ sensitive) | `resident.delivery.send` |
| `terrace.hap.prepare` | Draft a dated tenant and housing-authority split | PAY-013 | standard | `hap.change.prepare` |
| `terrace.hap.activate` | Post the effective split or abatement | PAY-013 | money · commitment | `hap.change.approve` |
| `terrace.hap.allocate` | Allocate a remittance to frozen payer charges | PAY-013 | money | `hap.remittance.allocate` |
| `terrace.ledgers.get` | Read property, owner, resident and fund entries | ACCT-001, ACCT-002, AGENT-003 | standard | `GET /api/v1/ledgers; GET /api/v1/owner-ledgers` |
| `terrace.journals.post` | Post a balanced source-linked correction | ACCT-001 | money | `journal.post` |
| `terrace.journals.reverse` | Append an inverse entry preserving beneficiaries | ACCT-001 | money | `journal.reverse` |
| `terrace.trust.map` | Set authorized bank, property and fund mapping | ACCT-002 | security | `trust.map` |
| `terrace.trust.transfer` | Move funds within the same beneficiary | ACCT-002 | money · external (+ sensitive, + gated) | `none; trust.record records external facts only` |
| `terrace.deposits.record` | Record collected deposit liability and custody | ACCT-003 | money | none |
| `terrace.deposits.accrue` | Post pack-based deposit interest | ACCT-003 | money | none |
| `terrace.dispositions.prepare` | Draft source-backed deductions and refund | ACCT-004 | standard (+ sensitive) | none |
| `terrace.dispositions.issue` | Bind and issue an itemized disposition | ACCT-004 | money · commitment · external (+ sensitive) | none |
| `terrace.bank_feeds.connect` | Connect the authorized Plaid feed | ACCT-005 | access · security · external (+ gated) | none |
| `terrace.bank_feeds.refresh` | Read provider bank transactions | ACCT-005 | external (+ sensitive, + gated) | none |
| `terrace.reconciliation.get` | Read statement matches and unresolved differences | ACCT-006, AGENT-003 | standard (+ sensitive) | `GET /api/reconcile` |
| `terrace.reconciliation.match` | Match or unmatch a statement line | ACCT-006 | standard | `reconcile.match` |
| `terrace.reconciliation.signoff` | Record a three-way reconciliation sign-off | ACCT-006 | commitment | `reconcile.signoff` |
| `terrace.bills.create` | Capture a vendor invoice original and allocations | ACCT-007 | standard (+ sensitive) | `bill.create / bill.attach` |
| `terrace.bills.authorize` | Record the exact payable and owner expense | ACCT-007 | money · commitment | `bill.approve` |
| `terrace.bills.revise` | Propose revised payable terms retaining originals | ACCT-007 | standard (+ sensitive) | `bill.revise` |
| `terrace.payables.pay` | Pay the exact vendor batch and reconcile its result | ACCT-008 | money · external (+ gated, + sensitive) | none |
| `terrace.fees.post` | Post source-linked management fees and reserves | ACCT-009 | money | `fees.run` |
| `terrace.fees.override` | Record an attributable fee override | ACCT-009 | money | `fee.override` |
| `terrace.distributions.prepare` | Draft cleared-cash owner distributions | ACCT-010 | standard (+ sensitive) | none |
| `terrace.distributions.pay` | Execute a one-account owner distribution | ACCT-010 | money · external (+ gated, + sensitive) | none |
| `terrace.periods.get` | Read close versions and exception queue | ACCT-011 | standard | `GET /api/state (month data)` |
| `terrace.periods.signoff` | Record exact month checklist evidence | ACCT-011 | commitment | `period.signoff` |
| `terrace.periods.close` | Create an immutable close version | ACCT-011 | commitment | `period.close` |
| `terrace.periods.reopen` | Supersede a close with a reason | ACCT-011 | commitment | `period.reopen` |
| `terrace.corrections.prepare` | Prepare a source-linked close correction | ACCT-011, AGENT-003 | standard | `correction.prepare` |
| `terrace.corrections.post` | Post an exact correction in an open period | ACCT-011 | money · commitment | `correction.approve` |
| `terrace.owner_statements.get` | Read source-linked owner-period balances | ACCT-012, PORTAL-002 | standard (+ sensitive) | `GET /api/owner-statement (allocation slice)` |
| `terrace.owner_statements.publish` | Publish a frozen statement to its owner | ACCT-012 | external · commitment (+ sensitive) | `report.delivery.send (bounded allocation statement)` |
| `terrace.financials.get` | Read basis-specific financial reports and sources | ACCT-013 | standard | `GET /api/financial-reports` |
| `terrace.tax_forms.prepare` | Prepare reconciled year-to-date 1099 data | ACCT-014 | standard (+ sensitive) | `none; tax.prepare handles charge-tax rules only` |
| `terrace.tax_forms.file` | Submit exact forms to Nelco | ACCT-014 | external · commitment · sensitive (+ gated) | none |
| `terrace.accounting.sync` | Send source-linked journals to QuickBooks | ACCT-015 | external (+ sensitive, + gated) | none |
| `terrace.recoveries.prepare` | Preview source-limited utility allocations | ACCT-016 | standard | `utility.prepare` |
| `terrace.recoveries.post` | Post exact utility and ancillary receivables | ACCT-016 | money · commitment | `utility.approve / ancillary.charge` |
| `terrace.checks.issue` | Generate or mail numbered checks and register them | ACCT-017 | money · external · sensitive (+ gated) | none |
| `terrace.checks.void` | Void a check with a reversing posting | ACCT-017 | money · external | none |
| `terrace.ach.generate` | Produce the exact paying-account NACHA file | ACCT-018 | money · sensitive | none |
| `terrace.ach.transmit` | Transmit that batch to bank SFTP or Modern Treasury | ACCT-018 | money · external · sensitive (+ gated) | none |
| `terrace.ach.reconcile` | Apply a verified bank return or change notice | ACCT-018 | money (+ security, + sensitive) | none |
| `terrace.residents.set_preferences` | Revise permitted resident contact preferences | PORTAL-001 | standard | none |
| `terrace.owners.contribute` | Initiate an owner contribution | PORTAL-002 | money · external (+ gated) | none |
| `terrace.vendors.respond` | Accept or decline exact assigned work | PORTAL-003 | external · commitment | `POST /portal/api/work-response` |
| `terrace.vendors.propose` | Submit a vendor appointment proposal | PORTAL-003 | external | `POST /portal/api/appointment-proposal` |
| `terrace.vendors.invoice` | Submit the vendor's invoice original | PORTAL-003 | external (+ sensitive) | `POST /portal/api/invoice` |
| `terrace.requests.create` | Prepare a scoped evidence or decision request | PORTAL-007 | standard | `request.create` |
| `terrace.requests.send` | Send or remind the named recipient with exact content | PORTAL-007 | external (+ sensitive) | `request.replace / request.remind` |
| `terrace.requests.validate` | Validate the submitted original against its fingerprint | PORTAL-007 | commitment (+ sensitive) | `request.validate` |
| `terrace.requests.expire` | Expire the action link without completing the item | PORTAL-007 | access | `request.expire` |
| `terrace.maintenance_requests.create` | Record a resident issue and original media | PORTAL-004 | standard (+ sensitive) | `POST /portal/repairs` |
| `terrace.maintenance_requests.link` | Link a report to the exact work record | PORTAL-004 | standard | `native portal request linking action` |
| `terrace.messages.prepare` | Prepare exact content and recipient revisions | PORTAL-005 | standard (+ sensitive) | `message.prepare` |
| `terrace.messages.send` | Deliver one exact email, SMS or page | PORTAL-005 | standard or external (+ sensitive) | `message.send (repair, arrival, page slice)` |
| `terrace.messages.consent` | Record recipient permission and channel evidence | PORTAL-005 | standard | `message.contact` |
| `terrace.threads.get` | Search visible shared conversations and notes | PORTAL-006 | standard (+ sensitive) | `GET /api/threads` |
| `terrace.threads.reply` | Append a note or reply to its native audience | PORTAL-006 | standard or external (+ sensitive) | `thread.reply; POST /portal/api/threads` |
| `terrace.threads.publish` | Publish a frozen notice or conversation entry | PORTAL-006 | external · commitment (+ sensitive) | `thread.approve` |
| `terrace.notices.prepare` | Merge a source-linked print or service packet | PORTAL-009 | standard (+ sensitive) | none |
| `terrace.notices.send` | Mail or submit an exact notice for service | PORTAL-009, WORK-015 | external · commitment (+ sensitive, + gated) | none |
| `terrace.service.record` | Record sourced physical-service facts and outcomes | PORTAL-009 | commitment | `thread.service (existing notices only)` |
| `terrace.repairs.notify` | Tell the dated owner about verified repair and cost | PORTAL-010 | external (+ sensitive) | none |
| `terrace.emergencies.record` | Record safety intake and give the published guidance | WORK-001, BOUND-003 | standard or external | `emergency.report (on-call mail side effect)` |
| `terrace.emergencies.escalate` | Send the exact on-call escalation | WORK-001 | external | `emergency.escalate` |
| `terrace.emergencies.resolve` | Record sourced field resolution without inference | WORK-001, BOUND-003 | commitment | `emergency.resolve` |
| `terrace.assets.create` | Add equipment and warranty sources | WORK-002 | standard | `asset.add` |
| `terrace.assets.replace` | Link a replacement while retaining service history | WORK-002 | standard | `asset.replace` |
| `terrace.work.get` | Read a scoped job, qualifications, cost and evidence | WORK-002, WORK-004, WORK-006 | standard (+ sensitive) | `GET /api/v1/work` |
| `terrace.work.prepare` | Prepare a repair scope and estimate | TER-008, WORK-003, AGENT-001 | standard | `maintenance.prepare` |
| `terrace.quotes.add` | Record one comparable vendor quote | WORK-003 | standard | `quote.add` |
| `terrace.quotes.select` | Revise prepared terms to the selected quote | WORK-003 | standard | `quote.select` |
| `terrace.work.authorize` | Bind the exact job, vendor and economic terms | TER-008, WORK-003 | money · commitment | `maintenance.approve` |
| `terrace.work.reassign` | Revise work to a qualified vendor | WORK-004 | standard | `maintenance.reassign` |
| `terrace.vendors.update` | Revise qualification evidence without certifying it | WORK-004 | standard | `vendor.update` |
| `terrace.appointments.book` | Reserve the permitted access and calendar window | WORK-005 | commitment | `appointment.book` |
| `terrace.appointments.cancel` | Cancel the specific reserved window | WORK-005 | standard | `appointment.cancel` |
| `terrace.appointments.confirm` | Record a sourced party response | WORK-005 | commitment | `appointment.confirm` |
| `terrace.work.dispatch` | Send the work packet to the assigned technician | TER-008, WORK-006 | external · commitment | `maintenance.dispatch` |
| `terrace.work.progress` | Record technician progress and next action | WORK-006 | standard | `maintenance.progress` |
| `terrace.field_evidence.record` | Record labor, materials and completion originals | WORK-007 | standard (+ sensitive) | `inspection.capture; technician field-evidence door (partial)` |
| `terrace.completion.record` | Append a vendor's completion claim and source | WORK-008 | standard | `completion.record` |
| `terrace.completion.check` | Record the resident's actual repair answer | WORK-008 | commitment | `completion.check` |
| `terrace.completion.close` | Record sourced closure without inventing resident confirmation | WORK-008 | commitment | `completion.close` |
| `terrace.invoice_matches.compare` | Compare work, invoice and owner charge sources | WORK-009, AGENT-001 | standard (+ sensitive) | none |
| `terrace.invoice_matches.post` | Post the source-limited matched owner charge | WORK-009 | money · commitment | none |
| `terrace.schedules.create` | Create a dated preventive maintenance schedule | WORK-010 | standard | `schedule.add` |
| `terrace.schedules.activate` | Activate recurring work generation | WORK-010 | live | `schedule.run (on-demand run; Cron slice)` |
| `terrace.inspections.create` | Open a dated inspection | TER-007, WORK-011 | standard | `inspection.create` |
| `terrace.inspections.capture` | Retain original photos and checklist observations | TER-007, WORK-011 | standard (+ sensitive) | `inspection.photo / inspection.capture` |
| `terrace.inspections.complete` | Record completion backed by notes and originals | TER-007, WORK-011 | commitment | `inspection.complete` |
| `terrace.inspections.compare` | Compare original entry, exit and repair evidence | AGENT-006 | standard (+ sensitive) | none |
| `terrace.inspections.import` | Retrieve evidence from the HappyCo connector | WORK-012 | external (+ sensitive, + gated) | none |
| `terrace.turnovers.open` | Create a make-ready board and task plan | WORK-013, AGENT-002 | standard | `turnover.open` |
| `terrace.turnovers.update` | Revise a task dependency or evidence | WORK-013 | standard | `turnover.task.update / turnover.task.submit` |
| `terrace.turnovers.publish` | Publish evidenced availability and ready date | WORK-013 | commitment | `turnover.publish` |
| `terrace.budgets.set` | Record maintenance category and asset limits | WORK-014 | money · commitment | `work.budget` |
| `terrace.stock.receive` | Record source-invoice parts and beneficiaries | WORK-014 | money | `stock.receive` |
| `terrace.stock.consume` | Allocate exact part cost to the source-backed repair | WORK-014 | money | `stock.consume` |
| `terrace.chargebacks.prepare` | Draft source-limited resident, owner or insurer recovery | WORK-014 | standard | `chargeback.prepare` |
| `terrace.chargebacks.post` | Post exact receivable and offset original expense | WORK-014 | money · commitment | `chargeback.approve` |
| `terrace.chargebacks.dispute` | Record a chargeback dispute and next action | WORK-015 | standard | none |
| `terrace.rent_roll.get` | Read as-of unit and collection sources | REPORT-001 | standard | `GET /api/rent-roll` |
| `terrace.delinquency.get` | Read payer-separated aging and follow-up sources | REPORT-002 | standard | `GET /api/delinquency` |
| `terrace.leasing_metrics.get` | Read vacancy, funnel and renewal measures | REPORT-003 | standard | `GET /api/leasing-report` |
| `terrace.service_metrics.get` | Read service evidence and cost measures | REPORT-004 | standard | `GET /api/maintenance-report` |
| `terrace.reports.compare` | Compare source-backed cash and vacancy scenarios | REPORT-007, AGENT-002 | standard | `GET /api/cash-scenario` |
| `terrace.custom_fields.define` | Define a typed field and native visibility | REPORT-005 | standard | `custom.field.define` |
| `terrace.custom_reports.save` | Save a source-pinned report definition | REPORT-005 | standard | `custom.report.save` |
| `terrace.custom_reports.get` | Read an authorized saved report | REPORT-005 | standard (+ sensitive) | `native custom-report route` |
| `terrace.report_schedules.create` | Prepare recipient-scoped report generation | REPORT-006 | standard | `report.schedule` |
| `terrace.report_schedules.activate` | Activate or retire running report generation | REPORT-006 | live | `report.retire; Cron generation slice` |
| `terrace.report_deliveries.send` | Deliver the frozen report link | REPORT-006 | external (+ sensitive) | `report.delivery.send` |
| `terrace.report_snapshots.erase` | Erase eligible installation-only snapshots | REPORT-006 | destructive | `report.delivery.delete` |
| `terrace.workflows.create` | Prepare a versioned operating workflow | OPS-003 | standard | `workflow.template (currently saves active version)` |
| `terrace.workflows.activate` | Activate or retire a running template | OPS-003 | live | `workflow.template / workflow.retire` |
| `terrace.workflows.start` | Start a source-matched durable run | OPS-003 | standard | `workflow.start` |
| `terrace.workflows.record` | Record attempt, reply or completion evidence | OPS-003 | standard | `workflow.attempt / workflow.reply / workflow.step` |
| `terrace.workloads.get` | Read accountable purpose, next step, costs and history | AGENT-008 | standard | `GET /api/agent-workloads` |
| `terrace.workloads.enqueue` | Enqueue a structured specialist job | AGENT-001, AGENT-004, AGENT-005 | standard | `agent.enqueue (prepare-only native slice)` |
| `terrace.workloads.reassign` | Change the named sponsor for future work | AGENT-008 | access | `agent.reassign` |
| `terrace.risks.analyze` | Compare verified operating outcomes and hypotheses | AGENT-007 | standard (+ sensitive) | none |
| `terrace.improvements.propose` | Draft sourced preventive or staffing changes | AGENT-007 | standard | none |
| `terrace.staff.invite` | Invite staff within the sponsor's native authority | TER-001, ROLE-001 | access (+ external) | `operator.invite` |
| `terrace.staff.set_role` | Change role and portfolio scope | TER-001, ROLE-001 | access | `operator.role` |
| `terrace.staff.deactivate` | Withdraw staff authority and sessions | TER-001, ROLE-001 | access | `operator.status` |
| `terrace.portals.invite` | Grant dated resident, owner or vendor membership | ROLE-002 | access · external | `portal.invite` |
| `terrace.portals.revoke` | Withdraw portal membership and sessions | ROLE-002 | access | `portal.revoke` |
| `terrace.devices.revoke` | Revoke a device session | ROLE-001 | access | `none; native apps not built` |
| `terrace.money_authorities.set` | Change payment and decision capabilities | ROLE-003 | access | `none; native role matrix is fixed` |
| `terrace.credentials.mint` | Create a scoped agent credential | OPS-001 | access · security | `credential.mint` |
| `terrace.credentials.rotate` | Replace a scoped credential without widening it | OPS-001, SAFE-003 | access · security | `credential.rotate` |
| `terrace.credentials.revoke` | Withdraw a credential | OPS-001 | access · security | `credential.revoke` |
| `terrace.security.require` | Change staff factor requirements | SAFE-001 | security | `factor.require` |
| `terrace.bank_destinations.set` | Record a verified payee destination revision | SAFE-001, PORTAL-001, PORTAL-002, PORTAL-003 | security (+ sensitive) | `vendor.bank.prepare / vendor.bank.verify (last-four reference only)` |
| `terrace.scanner.configure` | Set or rotate the contracted scanner adapter | PORT-010, SAFE-003 | security · external | none |
| `terrace.scanner.scan` | Submit the original to the configured scanner | PORT-010 | external (+ sensitive) | none |
| `terrace.scanner.release` | Release an original on verified scanner evidence | PORT-010 | security | none |
| `terrace.documents.search` | Find role-exact records and version metadata | PORT-007 | standard | `GET /api/v1/documents` |
| `terrace.documents.read` | Read an authorized original version | PORT-007, PORT-009 | standard (+ sensitive) | `native documentDownload / mediaDownload byte routes` |
| `terrace.documents.upload` | Attach an original or new version to its native record | PORT-007, PORT-009 | standard or external (+ sensitive) | `document.upload / media.begin, chunk, finish (staff custody only)` |
| `terrace.history.list` | Read attributable operating changes | SAFE-002 | standard (+ sensitive) | `GET /api/history` |
| `terrace.events.list` | Read typed changes after a cursor | OPS-002 | standard (+ sensitive) | `none; GET /api/history is not a replay feed` |
| `terrace.subscriptions.create` | Create an access-filtered event delivery endpoint | OPS-002 | access · security · external · live | none |
| `terrace.subscriptions.revoke` | Withdraw a running event subscription | OPS-002 | access · live | none |
| `terrace.integrations.connect` | Bind provider credentials and permission scopes | OPS-004 | access · security · live (+ gated) | none |
| `terrace.integrations.health` | Read redacted permission, freshness and cost facts | OPS-004 | standard | none |
| `terrace.insurance.quote` | Request a renter-insurance quote | OPS-005 | external (+ sensitive, + gated) | none |
| `terrace.insurance.enroll` | Bind the exact provider policy terms | OPS-005 | external · money · commitment (+ sensitive, + gated) | none |
| `terrace.handoffs.send` | Submit mapped finance, signing or trade records | OPS-006 | external (+ sensitive, + gated) | none |
| `terrace.siblings.link` | Record an unchecked authorized sibling address | OPS-007 | standard | `sibling.link` |
| `terrace.referrals.record` | Record a professional referral and sourced response | BOUND-002 | commitment | none |
| `terrace.custody.export` | Export native product custody and readable originals | TER-010, SAFE-005 | security (+ sensitive) | `GET /api/backup; readableExport` |
| `terrace.privacy.request` | Prepare a subject access or erasure request | SAFE-004 | standard | `privacy.request` |
| `terrace.privacy.hold` | Set a source-backed legal retention hold | SAFE-004 | commitment | `privacy.hold` |
| `terrace.privacy.release` | Release a specific hold with its source | SAFE-004 | commitment | `privacy.release` |
| `terrace.privacy.erase` | Erase eligible subject data and retain restore fences | TER-011, SAFE-004 | destructive | `tenancy.erase / privacy.review (eligible redaction)` |
| `terrace.recovery.reconcile` | Resolve an uncertain external job by provider identity | SAFE-006 | external (+ money, + sensitive, + gated) | none |
| `terrace.listings.prepare` | Draft vacancy, rent, fees and media | LEASE-001 | standard (+ sensitive) | none |
| `terrace.listings.publish` | Publish or update one own-site listing | LEASE-001 | external · live (+ sensitive) | none |
| `terrace.listings.withdraw` | Withdraw the public vacancy | LEASE-001 | external · live | none |
| `terrace.marketplaces.submit` | Submit the exact listing to a named entitled channel | LEASE-002, LEASE-003, LEASE-004 | external · live (+ gated, + sensitive) | none |
| `terrace.marketplaces.withdraw` | Remove the listing from its provider channel | LEASE-002, LEASE-003, LEASE-004 | external · live (+ gated) | none |
| `terrace.prospects.create` | Record a sourced lead and duplicate state | LEASE-005 | standard | `prospect.add` |
| `terrace.prospects.resolve` | Record merge or separate duplicate disposition | LEASE-005 | standard | `prospect.review` |
| `terrace.prospects.assign` | Assign in-scope operational follow-up | LEASE-005 | standard | `prospect.assign` |
| `terrace.prospects.send` | Send a consented prospect response | LEASE-005 | external (+ sensitive) | `prospect.email` |
| `terrace.showings.book` | Reserve the permitted showing window and calendars | LEASE-006 | external · commitment (+ gated) | none |
| `terrace.showings.cancel` | Cancel the particular tour and notify its parties | LEASE-006 | external | none |
| `terrace.applications.get` | Read current authorized application answers and evidence | LEASE-007 | standard (+ sensitive) | `native applicationRecord / staffApplications routes` |
| `terrace.applications.submit` | Submit the applicant's versioned answers | LEASE-007 | external (+ sensitive) | `POST /apply/api/application` |
| `terrace.applications.request` | Request the exact missing evidence | LEASE-007 | external (+ sensitive) | `application.request (native applicant-link slice)` |
| `terrace.application_fees.collect` | Initiate disclosed hosted application-fee collection | LEASE-007 | money · external (+ gated) | `native hosted application-fee action (Stripe test only)` |
| `terrace.screening.order` | Order TransUnion screening with recorded consent | LEASE-008 | external · money (+ sensitive, + gated) | none |
| `terrace.screening.read` | Read authorized provider reports and retrieval evidence | LEASE-008 | external (+ sensitive, + gated) | none |
| `terrace.applicants.compare` | Compute disclosed income criteria from verified sources | LEASE-009 | standard (+ sensitive) | none |
| `terrace.applicants.decide` | Record the sponsor-attributed applicant decision | LEASE-009 | commitment (+ sensitive) | none |
| `terrace.adverse_actions.send` | Send the exact adverse-action package | LEASE-009 | external · commitment (+ sensitive) | none |
| `terrace.lease_templates.prepare` | Merge jurisdiction-specific terms and redlines | LEASE-010 | standard (+ sensitive) | none |
| `terrace.lease_templates.adopt` | Bind the source-backed legal wording revision | LEASE-010 | commitment | none |
| `terrace.signatures.send` | Send an exact lease or renewal envelope | LEASE-011 | external · commitment (+ sensitive, + gated) | none |
| `terrace.signatures.reconcile` | Attach a verified executed artifact and activate once | LEASE-011 | money · commitment (+ sensitive, + gated) | none |
| `terrace.rules.get` | Read active jurisdiction values, citations and gaps | PORT-008 | standard | `GET /api/rules` |
| `terrace.rules.prepare` | Draft a sourced jurisdictional pack version | PORT-008 | standard | `rules.pack` |
| `terrace.rules.record_counsel` | Record counsel's actual review of an exact version | PORT-008 | commitment | `rules.pack` (review metadata) |
| `terrace.rules.activate` | Activate the source-backed jurisdiction version | PORT-008 | commitment · live | `rules.activate` |
| `terrace.jurisdictions.propose` | Propose the property's state and local overlay | PORT-008 | standard | `property.rules.propose` |
| `terrace.jurisdictions.confirm` | Activate that property's jurisdiction assignment | PORT-008 | commitment · live | `property.rules.confirm` |

**Resources.** `terrace://company/{id}`, `terrace://entity/{id}`, `terrace://portfolio/{id}`, `terrace://property/{id}`, `terrace://unit/{id}`, `terrace://lease/{id}`, `terrace://lease_version/{id}`, `terrace://household/{id}`, `terrace://owner/{id}`, `terrace://agreement/{id}`, `terrace://prospect/{id}`, `terrace://application/{id}`, `terrace://screening/{id}`, `terrace://renewal/{id}`, `terrace://charge/{id}`, `terrace://payment/{id}`, `terrace://mandate/{id}`, `terrace://deposit/{id}`, `terrace://journal/{id}`, `terrace://bank_statement/{id}`, `terrace://bill/{id}`, `terrace://distribution/{id}`, `terrace://statement/{id}`, `terrace://document/{id}`, `terrace://thread/{id}`, `terrace://request/{id}`, `terrace://work/{id}`, `terrace://asset/{id}`, `terrace://vendor/{id}`, `terrace://appointment/{id}`, `terrace://inspection/{id}`, `terrace://turnover/{id}`, `terrace://workflow/{id}`, `terrace://workload/{id}`, `terrace://referral/{id}`, `terrace://event/{id}`. Native role, portfolio, dated household/ownership and original-file visibility apply to every template. External, resident, vendor, applicant, import and log text is marked untrusted. Provider custody remains identified as provider custody.

**Events.** `lease.changed`, `household.changed`, `ownership.changed`, `listing.changed`, `application.submitted`, `screening.updated`, `renewal.changed`, `charge.posted`, `payment.changed`, `deposit.changed`, `journal.posted`, `bill.changed`, `reconciliation.changed`, `period.closed`, `statement.published`, `document.versioned`, `thread.changed`, `request.completed`, `emergency.changed`, `work.changed`, `appointment.changed`, `inspection.completed`, `turnover.changed`, `workflow.changed`, `workload.changed`, `authority.changed`, `provider.uncertain`, `privacy.erased`. Each event carries stable record links, property-local business dates and recorded instants without copying protected originals into event text.

**Prompts.** The steward offers repair-to-owner-statement follow-through (AGENT-001, WORK-003, WORK-008, WORK-009); vacancy recovery comparison and execution (AGENT-002, REPORT-007, WORK-013); deposit and close investigation (AGENT-003, ACCT-006, ACCT-011); arrears plan-versus-notice follow-through (AGENT-004, AGENT-009, PAY-011); executed renewal and future-rent verification (AGENT-005, LEASE-012); source-linked inspection comparison (AGENT-006, WORK-011); and verified-outcome improvement proposals (AGENT-007, REPORT-004). Continuing work records its next step through the same typed jobs, rather than a general executor.

**Not tools, and why.**

- *The import door:* TER-009, MOVE-001, MOVE-002, MOVE-003, MOVE-004, MOVE-005, MOVE-006, MOVE-007, MOVE-008, MOVE-009, MOVE-010, MOVE-011. Preview, originals, mapping, apply, compensation, shadow cutover and incumbent-switch proof stay in Base's import task flow; restore is also an import task. These are not general MCP mutation executors.
- *Device-only:* PORTAL-008. Native mobile rendering, assistive interaction, push permission and offline device resume run on the device; revocable sessions have a separate tool above.
- *A connector:* OPS-008. Commercial CAM and project-based housing data enter through the specialist adapter and import door, preserving the residential boundary.
- *Operation or installation facts:* TER-012, SAFE-007, SAFE-008, SAFE-009, BOUND-004, OPEN-001, DEMO-001. Installed Lobby and run-site rendering, owned deployment and diagnostics, entitlement/pricing disclosures, measured portfolio capacity, residential-only scope, MIT distribution and isolated demo operation are properties of the installation.

A person's sign-in, password, 2FA, provider consent screen and hosted checkout remain interactive screens; provider challenges return the exact provider step, rather than a password or CAPTCHA tool. Physical work and professional provider verification remain external facts with attributable evidence, never a successful software-call inference.

**Limits.** Existing native capacities include original uploads at most 5 MB, at most 200 records per versioned API page, renewal scheduling windows at most 367 days and leasing report windows at most 732 days. `/docs/agents` identifies each operation's actual item, byte and concurrency bounds and reports measured portfolio performance separately from the 500-unit capacity target. Business limits and spend caps are the company's policy. Amounts retain their stored currency and exact cents, and business dates retain the property's timezone; no tool changes an unconfirmed historical currency by inference.

**Handoffs.** Listen for authenticated processor settlement/return, bank transaction, screening report, signed-envelope, vendor completion/invoice and resident reply events, retaining provider identities and uncertain outcomes. Inkwell/DocuSign execution feeds versioned lease custody; Glove/Gasket evidence feeds repair and asset records; Pantry/QuickBooks handoffs retain Terrace's beneficiary subledgers. Emit repair, renewal, receivable, statement, evidence-request and unresolved-exception events for the relevant specialist. A provider callback's signature proves its source, not household identity, permission to enter, legal service or settled cash.

#### SURFACE-001 — The registry equals the Agent surface table

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** Terrace's registry contains exactly this area's typed jobs, resource templates, event types and specialist prompts, with each tool bound to its native UI action. The registry exposes the Core mapping and installation reasons in discovery; existing partial native actions do not stand in for missing target jobs.

**Acceptance.**
1. `tools/list` returns exactly the tool names above, their arguments, Core ids and declared class expressions, with stable ordering and no general command executor.
2. `resources/templates/list`, `prompts/list` and discovery return exactly the templates, specialist jobs and Not-tools reasons above; every Core id is covered and none has both kinds of mapping.
3. For a charge preview/post, work preparation/dispatch, household change and document upload, the MCP and native UI actions on equal fixtures produce equal domain results and event types.
4. The Base harness passes on Terrace fixtures under the named company policies All-autonomous and Held defined in SURFACE-013.
5. The generated manifest and `/docs/agents` carry these declarations and the same conformance journey, including computed-class examples and honest native gaps.

#### SURFACE-002 — Read the sponsor’s exact residential records

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-010

**Requirement.** Terrace resources and read tools project native role, portfolio, dated ownership and household rights, including source originals. Reports preserve currency, property-local dates, actual-versus-assumed values and the distinction between an external recorded receipt and bank settlement.

**Acceptance.**
1. The same rent roll, delinquency, financial, leasing and service queries return the native filtered records and totals, with stable source links and separate tenant/PHA and currency balances.
2. A lease in another portfolio, an inaccessible screening original and a missing record give indistinguishable missing results through list, direct resource and byte reads.
3. On one application fixture, reading masked metadata declares standard only; reading its full identity and payroll evidence declares standard and sensitive with record count and kinds. The same predicate applies to every optional-sensitive cell, including upload, export and outbound payloads.
4. On the same invoice, a private ordinary original carries no sensitive class; adding a full bank number to the bytes returned, uploaded or sent adds sensitive with kind bank and the exact record count. A private address or last-four reference alone adds none.
5. Event replay after the same cursor matches the subscribed event ids; removing the sponsor’s portfolio removes those records from subsequent reads and replay.
6. Resident, vendor, applicant, provider, imported and log text retains its untrusted marker and cannot alter tools, classes, recipients or sponsor scope.

#### SURFACE-003 — Classify exposure at the actual destination

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** The steward prepares content separately from transmission or publication. The server computes exposure for the actual audience, including already shared originals and portal threads. Delivery outcomes, service evidence, resident permission and repair confirmation remain separate facts.

**Acceptance.**
1. On one thread fixture, an internal note through `terrace.threads.reply` declares standard; the same reply published to the resident declares external, one recipient, counterparty known. A caller’s internal flag changes neither result.
2. On one document fixture, uploading a new version into staff custody declares standard; uploading it where its current owner or vendor audience can read declares external with that audience’s recipient count. The same content-sensitive computation in SURFACE-002 applies in each location.
3. On one message fixture, `terrace.messages.send` to an internal staff mailbox declares standard and to its recorded vendor declares external/known; replacing that destination with an unrecorded permitted address gives external/new, while an open listing gives external/public.
4. Renewal, prospect, request, statement, report, repair-notification, notice, vendor-submission, scanner and provider-handoff sends declare the fixed external class and record their actual recipients; sensitive content adds its facts without changing delivery truth.
5. Retry after a claimed or uncertain provider attempt returns its stored identity and next reconciliation action, with no second send; a delivery receipt supplies no entry permission, legal service or resident repair answer.
6. An exposed message whose source revision or recipient rights changed returns the same stale-source result as its native door and creates no exposure.

#### SURFACE-004 — Keep lease and applicant commitments source-linked

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Offers, legal wording, lease versions, mandate terms, applicant decisions and executed artifacts bind exact native source revisions and counterparties. Economic activation carries money as well as commitment. Recorded signatures remain recorded evidence; verified provider execution has its own provenance.

**Acceptance.**
1. A prepared renewal alternative declares standard with dated market/vacancy assumptions and posts nothing; sending its exact offer declares fixed external and commitment with value and counterparty.
2. On one recorded-renewal fixture, a declined decision declares commitment without money; binding increased future rent declares commitment and money with exact cents, currency and effective date.
3. Lease-version activation, effective management terms, work authorization, utility recovery and refund authorization each declare fixed money and commitment; stale sources return a conflict and preserve the former version.
4. Applicant decision, adopted lease wording, appointment booking, completed inspection, verified repair answer, ready-date publication, professional referral and accounting sign-off each declare fixed commitment with the exact revision and counterparty or sign-off audience.
5. An agent-authored applicant decision, offer or envelope carries the agent and sponsor attribution; a person’s own signature or confirmation appears only from that person’s actual action.
6. A completed signature envelope attaches one verified artifact/certificate and activates one schedule; a callback replay creates neither a second version nor charges.
7. A source-backed applicant criteria comparison carries sensitive only when it actually processes protected content; it records the disclosed calculation rather than asserting legal validity.

#### SURFACE-005 — Preserve exact money and payer boundaries

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-012

**Requirement.** Terrace money tools preserve exact cents, stored currency, dated beneficiaries and append-only correction sources. Execution never borrows another owner’s funds, merges deposit and rent custody or treats pending money as settled. Forecasts and draft estimates stay separate from charges.

**Acceptance.**
1. Posting rent, late fees, HAP changes, receipts, deposit interest, payables, stock costs, recoveries, fees, credit reductions and distributions declares fixed money with exact source amount, currency and counterparty; forecasts and preview tools declare standard without money.
2. On one payment fixture, canonical reconciliation with unchanged pending state declares standard; a verified settlement that posts its allocation declares money with exact payer and cents. Replaying either response adds no second ledger entry.
3. Two leases under different owners share one PHA remittance: allocation posts each frozen tenant/HAP amount once, holds the unmatched remainder and never moves an abatement onto the resident.
4. An owner payout from a deposit fund or another beneficiary fails the native fund-isolation check under either company policy, with no bank submission.
5. An amount, payee, source original, ownership allocation or reserved-fund change after preparation makes the prior fingerprint stale; concurrent exact executions produce one payment and source-linked reversal history.
6. Every money receipt records external fact, submitted, transmitted, pending or settled according to its actual native/provider evidence, never from a browser return or the agent’s wording.

#### SURFACE-006 — Keep provider challenges and bank custody explicit

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Provider jobs retain their provider identity and hosted-person step. NACHA files belong to one paying account; checks retain their continuous register.

**Acceptance.**
1. On the same hosted-payment fixture, an already valid provider authorization returns money and external without gated; a provider response requiring hosted authentication adds gated, naming the provider and exact step. No password, card-entry, CAPTCHA or 2FA tool is offered.
2. The same provider-response pair covers every optional-gated family: bank feeds, autopay, refunds, trust transfers, payouts, filings, checks, ACH transmission, integrations, insurance, sibling handoffs, showings, marketplace submissions, inspection retrieval, screening, signing and external recovery.
3. Generating a NACHA file declares fixed money and sensitive with bank-data kind; two paying accounts produce separate balanced files, stable traces and equal bytes on regeneration.
4. Issuing a check declares money, external and sensitive; a duplicate number is refused and a void preserves the issued entry with a reversing posting.
5. On one ACH outcome fixture, an ordinary return declares money without security or sensitive if its result contains no protected numbers; a verified NOC carrying full corrected bank detail adds security and sensitive, naming the changed setting and record count.
6. On one uncertain-job fixture, provider lookup with no financial change declares external without money; applying its verified settlement adds money and exact payer/beneficiary facts. Protected data and provider challenges independently add sensitive and gated.
7. Hosted consent returns a provider link; imported text cannot manufacture completion.

#### SURFACE-007 — Follow repairs from intake through verified cost

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-012

**Requirement.** The steward joins safety guidance, qualifications, sourced quotes, access windows, original field evidence, resident answers, invoice matching and owner cost. It distinguishes a plan, dispatched work, vendor completion and actual resident confirmation, and never infers physical assistance from notification.

**Acceptance.**
1. On one safety-intake fixture, recording a non-emergency for staff only declares standard; the same intake requiring an on-call alert declares external with its named responder and recipient count.
2. An arrival booking checks the property’s actual timezone offsets, recorded resident permission, notice evidence, current vendor qualification and calendar conflicts; none is supplied by message delivery or a signed callback alone.
3. A vendor reports completion, the resident reports continued leaking and the job reopens; only a sourced subsequent answer changes the repair outcome, retaining both claims and originals.
4. The same invoice original containing only ordinary repair lines is standard for comparison; a full bank number in returned content adds sensitive. Unsupported damage and uncertain low-light findings keep their source locations and uncertainty.
5. Stock receipt and consumption declare money with the exact source-invoice beneficiary split; a chargeback posts a receivable and original-owner expense offset without inventing collection or a second payable.
6. An invoice mismatch retains an open next action; a matched final cost drills from resident evidence through work, payable and the dated owner-statement line.

#### SURFACE-008 — Classify authority and protective changes from native targets

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Authority direction comes from native before/after records. An agent never widens its own or its sponsor’s authority.

**Acceptance.**
1. Staff roles, household rights, ownership visibility, portal grants, device revocation, money authorities, credentials, request-link expiry, workload sponsor reassignment, event subscriptions and integration scopes declare fixed access with affected people and direction.
2. On one staff invitation fixture, adding an existing internal colleague declares access without external; inviting an outside mailbox adds external with one recipient and known/new counterparty from current records.
3. Credentials declare fixed access and security; factor settings, trust mappings, bank destinations, scanner configuration/release and custody export declare fixed security with the setting reference and no secret bytes in the audit.
4. Under every policy, staff, household, ownership, portal, device, money-authority, credential, request, workload, subscription and integration tools refuse widening the sponsor’s or agent’s own authority, including indirect sponsor reassignment.
5. Under every company policy, factor, trust-mapping, bank-destination, scanner and credential-custody changes that widen the sponsor’s or agent’s own authority are refused; security and access classes do not bypass that invariant.
6. On the same bank-destination fixture, a last-four external reference declares security without sensitive; storing or returning full verified account/routing data adds sensitive with kind bank and record count.
7. A role or scope change between enqueue and execution takes effect before the native write; no restored session, grant, provider credential or archived workload supplies destination authority.

#### SURFACE-009 — Make live configuration a distinct effect

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-012

**Requirement.** Terrace separates drafting workflow and schedule configuration from changing a running service. Publishing listing changes, event subscriptions, partial-payment admission and provider integration state also identify their live service effect.

**Acceptance.**
1. Drafting a workflow version declares standard and does not start a sweep; activating or retiring it declares fixed live with service and before/after revisions.
2. Maintenance generation, report scheduling activation/retirement and payment admission changes declare live, preserving their native sources and any money class stated in the table.
3. Jurisdiction pack activation and property-jurisdiction confirmation declare commitment and live. Listing and marketplace publication or withdrawal declares fixed external and live with public or provider counterparty; subscription creation declares access, security, external and live, and subscription revocation declares access and live.
4. An integration connection declares access, security and live, adding gated only on the verified provider-step response; loss of its sponsor’s native authority prevents later exchanges.
5. A sweep replay starts one matching workflow per source and version; an uncertain contact outcome retains its durable next action without turning a timer tick into evidence of contact.
6. A proposed operating improvement remains a standard draft until the relevant typed configuration or economic action is called; no analysis result activates its own recommendation.

#### SURFACE-010 — Erasure and evidence custody retain native fences

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-006, BASE-AGENT-012

**Requirement.** Erasure and snapshot deletion carry destructive, with their actual item counts. Native preservation, subject-scoped access, immutable financial evidence and restoration fences apply to agent calls exactly as to the source actions. Custody exports contain usable originals without restoring authority.

**Acceptance.**
1. Erasing eligible tenancy evidence and deleting a report snapshot each declare fixed destructive with affected ids and count; neither is described as trash or Undo.
2. A held original or shared invoice with another subject’s retention duty remains preserved under either company policy, with no disclosure of that other subject’s identity or hold reason.
3. A native custody export declares security and adds sensitive exactly when the archive contains protected numbers; the readable inventory carries original hashes and source revisions.
4. An import-door restore with the later erasure journal cannot resurrect the erased original, session, credential or outbound attempt authority.
5. An agent’s erasure retry returns the first receipt and item count; erased file hashes prevent re-upload resurrection without retaining the erased content.

#### SURFACE-011 — Continuing specialist work stays inspectable

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-009, BASE-AGENT-010, BASE-AGENT-012

**Requirement.** Terrace’s specialist projections join native sources and expose current next actions without substituting a plan for its outcome. Repair, arrears, renewal, close and improvement prompts use the same individual tools as outside agents.

**Acceptance.**
1. A repair workload retains sources, purpose, next step, due date, attempts, replies, actual costs and outcome links through an interruption and sponsor reassignment.
2. A renewal counteroffer changes its live sources; the former offer fingerprint cannot activate future rent, and the next action names the current envelope or missing source.
3. A delinquent household’s plan-versus-notice comparison recalculates cash and vacant days when a dated assumption changes, posts no entries and later compares actual receipts to that assumption.
4. A deposit investigation traces duplicate receipts, missing custody and wrong-owner expense to original sources; unresolved differences remain in the close queue.
5. An inspection comparison retains unchanged, damaged and ambiguous originals with exact source locations, while an improvement proposal distinguishes hypotheses from measured outcomes.
6. Each workload event names the actual agent, sponsor, source revisions, class/facts and outcome; a cancelled follow-up produces no later tool mutation.

#### SURFACE-012 — Document capacity and provider boundaries honestly

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-011, BASE-AGENT-013

**Requirement.** Terrace documents concrete transport and domain capacities, honest provider gaps and installation/import/device boundaries. These are separate from company business limits. The surface exposes no hosted-person interaction as a synthetic completion.

**Acceptance.**
1. `/docs/agents` and discovery show the tool-specific upload, page and window bounds stated above; a request exceeding one returns the named native limit without partial mutation.
2. A 500-unit capacity target appears as a target until measured with commit, date and dataset counts; a native action or absent provider is not labeled full target implementation.
3. The import task flow retains original bytes, count/balance reconciliation, reviewed manifest and compensation receipts; no catch-all MCP action bypasses it.
4. The same specialist prompt links its tools, resources, Core jobs and event handoffs; ordinary resource fields expose no credentials or provider-hosted card-entry data.
5. Business limits and spend caps are shown as company policy inputs without claiming door-enforced spend accounting or a fabricated spend-exhaustion result.

#### SURFACE-013 — The portfolio steward runs a seeded week under two company policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-013

**Requirement.** A stranger agent runs one seeded week through MCP with no prior installation knowledge. Company policy All-autonomous assigns autonomous to every class; company policy Held assigns standard review and all other classes approval. People set each policy; neither is a shipping disposition.

**Acceptance.**
1. Given the URL and named sponsor, the stranger discovers tools, resources, class facts, limits and prompts without Terrace-specific instructions.
2. Under All-autonomous, a leak reaches qualified booking, resident-origin confirmation, matched invoice and owner statement; a duplicate receipt is reconciled, an arrears plan followed and renewal future charges verified, with no person participating.
3. Under All-autonomous, existing provider authorizations, professional records and seeded resident/vendor events supply external facts; the completed week involves no CAPTCHA, password, 2FA or provider-person step.
4. Under Held, standard reads/drafts complete into review; external, money, commitment, access, security, destructive, sensitive and live steps produce approval with source/class facts and no effect before the designated person acts.
5. Under Held, the person grants one exact action, declines another and changes a third source: one effect, no declined effect and a new decision for stale inputs.
6. Both policies refuse out-of-role work and self-authority expansion; internal or confirmed text changes neither classes nor provider evidence.
7. The audit reconciles calls and outcomes to policy revisions, with zero invented person signatures/confirmations or duplicate financial/communication effects.

## Status rows

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `SURFACE-001` | The registry equals the Agent surface table | target | missing | | The exact MCP registry and Base conformance proof are not built. |
| `SURFACE-002` | Read the sponsor’s exact residential records | target | missing | | Role-exact MCP resources and protected-content classification are not built. |
| `SURFACE-003` | Classify exposure at the actual destination | target | missing | | Destination-based MCP exposure and reliable native-action parity are not built. |
| `SURFACE-004` | Keep lease and applicant commitments source-linked | target | missing | | Source-linked MCP lease and applicant commitments are not built. |
| `SURFACE-005` | Preserve exact money and payer boundaries | target | missing | | Exact-money MCP orchestration and full payer-boundary proof are not built. |
| `SURFACE-006` | Keep provider challenges and bank custody explicit | target | missing | | Provider challenge and complete bank-rail MCP workflows are not built. |
| `SURFACE-007` | Follow repairs from intake through verified cost | target | missing | | End-to-end repair MCP follow-through and verified cost proof are not built. |
| `SURFACE-008` | Classify authority and protective changes from native targets | target | missing | | Classified MCP authority and protective-setting families are not built. |
| `SURFACE-009` | Make live configuration a distinct effect | target | missing | | Separate draft and activation MCP jobs for running services are not built. |
| `SURFACE-010` | Erasure and evidence custody retain native fences | target | missing | | MCP erasure and custody jobs with complete native-fence proof are not built. |
| `SURFACE-011` | Continuing specialist work stays inspectable | target | missing | | Continuing specialist MCP projections and outcome follow-through are not built. |
| `SURFACE-012` | Document capacity and provider boundaries honestly | target | missing | | The registry-generated capacity and boundary documentation is not built. |
| `SURFACE-013` | The portfolio steward runs a seeded week under two company policies | target | missing | | The stranger-agent seeded week under both company policies is not proved. |
