import {test} from 'node:test'
import {journey as hapJourney} from './hap.mjs'
import {journey as residentStatementJourney} from './resident-statements.mjs'
import {journey as financialJourney} from './financial-actions.mjs'
import {journey as lateFeeJourney} from './late-fees.mjs'
import {journey as paymentJourney} from './payments.mjs'
// Use the existing Worker SQL door over real D1, avoiding the idle isolate proxy.
process.env.TERRACE_ASYNC_SQL='1'
test('PAY-013: signed voucher portions, held remittances, retroactive notices, PHA-only abatement and complete payer reconciliation survive restore and erasure',hapJourney)
test('PAY-005: reviewed lease stages reserve concurrent co-tenant payments, allocate settlement once, separate credit and block partial or excess funds',paymentJourney)
test('PAY-006: reviewed state caps, weekend and holiday grace, timely pending settlement and reasoned waivers retain original calculations',lateFeeJourney)
test('PAY-009: exact independent approvals refuse changed refund sources, record one external refund with original owner effects and retain reasoned corrections and forwarding check drafts',financialJourney)
test('PAY-010: resident statements, delivered receipts, failed-email tasks and private accessible downloads',residentStatementJourney)
