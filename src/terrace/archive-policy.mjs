import {validatePaymentArchive} from './payment-archive.mjs'
import {validateTrustArchive} from './trust-archive.mjs'
export default {
 product: 'residential/terrace',
 // ROLE-001: the capability table is product configuration each installation's migrations create, never archived data.
 // OPS-001: API credentials, their token hashes and idempotency records stay in the installation; after a restore the owner mints new ones.
 // PORTAL-007: request evidence is portable, but bearer action links never leave the installation.
 // ROLE-002: portal people, their grants, links and sessions stay in the installation; after a restore the owner invites each person again.
 // SAFE-001: authenticator secrets, recovery codes, passed sessions and failed attempts never leave the installation.
 excludeTables:['tt_card_checkout_links','tt_budget_clock','tt_action_links','tt_report_delivery_holds','tt_report_delivery_events','tt_report_deliveries','tt_reconcile_clock','tt_erasure_work','tt_role_actions','tt_totp','tt_recovery_codes','tt_factor_sessions','tt_factor_failures','tt_api_credentials','tt_api_credential_portfolios','tt_api_idempotency','tt_portal_identities','tt_portal_grants','tt_portal_links','tt_portal_sessions'],
 requiredConfiguration: ['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
 async validateStaged({db,tables}) {
  await validateTrustArchive(db,tables);
  await validatePaymentArchive(db,tables);
  const q=tables.tt_charges, r=tables.tt_receipts, a=tables.tt_adjustments, reversals=tables.tt_receipt_reversals, refunds=tables.tt_financial_recordings;
  const refunded=refunds?`COALESCE((SELECT SUM(x.amount_cents) FROM "${refunds}" x JOIN "${r}" r ON r.id=x.receipt_id WHERE r.charge_id=q.id),0)`:"0";
  if(!q || !r || !a) throw new Error('Terrace rent tables are required.');
  const bad=await db.prepare(`SELECT 1 FROM "${q}" q WHERE q.amount_cents < -${refunded}-COALESCE((SELECT SUM(r.amount_cents) FROM "${reversals}" x JOIN "${r}" r ON r.id=x.receipt_id WHERE r.charge_id=q.id),0)+COALESCE((SELECT SUM(amount_cents) FROM "${r}" WHERE charge_id=q.id),0)+COALESCE((SELECT SUM(amount_cents) FROM "${a}" WHERE charge_id=q.id),0) LIMIT 1`).first();
  if(bad) throw new Error('Receipt and adjustment totals exceed the charge.');
  const j=tables.tt_journal,chart=tables.tt_gl_accounts;
  const chargebacks=tables.tt_work_chargebacks,approvals=tables.tt_work_chargeback_approvals;
  if(chargebacks&&approvals&&j){
   const bad=await db.prepare(`SELECT 1 FROM "${chargebacks}" c LEFT JOIN "${j}" s ON s.id=c.source_id WHERE s.id IS NULL OR s.source_kind NOT IN ('bill','stock_use') OR c.amount_cents<=0 OR c.amount_cents>(SELECT COALESCE(SUM(json_extract(l.value,'$.debit')),0) FROM json_each(s.lines) l WHERE json_extract(l.value,'$.account')='expense') OR (SELECT SUM(x.amount_cents) FROM "${chargebacks}" x JOIN "${approvals}" a ON a.chargeback_id=x.id WHERE x.source_id=c.source_id)>(SELECT COALESCE(SUM(json_extract(l.value,'$.debit')),0) FROM json_each(s.lines) l WHERE json_extract(l.value,'$.account')='expense') LIMIT 1`).first();
   if(bad)throw Error('Chargeback archive exceeds or lacks its recorded source cost.');
   const mismatch=await db.prepare(`SELECT 1 FROM "${approvals}" a LEFT JOIN "${chargebacks}" c ON c.id=a.chargeback_id LEFT JOIN "${j}" s ON s.id=c.source_id LEFT JOIN "${j}" p ON p.source_kind='chargeback' AND p.source_id=c.id WHERE c.id IS NULL OR p.id IS NULL OR p.owner_key<>s.owner_key OR p.property_id IS NOT s.property_id OR p.tenancy_id<>c.tenancy_id OR p.lines<>json_array(json_object('account','receivable','debit',c.amount_cents,'credit',0),json_object('account','expense','debit',0,'credit',c.amount_cents)) LIMIT 1`).first();
   if(mismatch)throw Error('Chargeback archive approval and beneficiary posting differ.');
  }

  if(j&&chart){
   const invalid=await db.prepare(`SELECT 1 FROM "${j}" j WHERE currency<>'USD' OR json_type(lines)<>'array' OR json_array_length(lines)<2 OR (SELECT SUM(json_extract(value,'$.debit')-json_extract(value,'$.credit')) FROM json_each(j.lines))<>0 OR EXISTS(SELECT 1 FROM json_each(j.lines) l LEFT JOIN (SELECT * FROM tt_gl_chart WHERE created_by='migration' UNION ALL SELECT * FROM "${chart}") a ON a.code=json_extract(l.value,'$.account') WHERE a.code IS NULL OR (a.fund<>'both' AND a.fund<>j.fund) OR json_type(l.value,'$.debit') IS NOT 'integer' OR json_type(l.value,'$.credit') IS NOT 'integer' OR json_extract(l.value,'$.debit')<0 OR json_extract(l.value,'$.credit')<0 OR (json_extract(l.value,'$.debit')=0)=(json_extract(l.value,'$.credit')=0)) LIMIT 1`).first();
   if(invalid)throw Error('Unbalanced or invalid journal in archive.');
   const overridden=await db.prepare(`SELECT 1 FROM "${chart}" WHERE code IN (SELECT code FROM tt_gl_chart WHERE created_by='migration') LIMIT 1`).first();
   if(overridden)throw Error('Archive cannot redefine a built-in chart account.');
   const reversal=await db.prepare(`SELECT 1 FROM "${j}" r LEFT JOIN "${j}" o ON o.id=r.reversal_of WHERE r.reversal_of IS NOT NULL AND (o.id IS NULL OR o.reversal_of IS NOT NULL OR r.owner_key<>o.owner_key OR r.property_id IS NOT o.property_id OR r.tenancy_id IS NOT o.tenancy_id OR r.vendor_id IS NOT o.vendor_id OR r.fund<>o.fund OR r.lines<>(SELECT json_group_array(json_object('account',json_extract(value,'$.account'),'debit',json_extract(value,'$.credit'),'credit',json_extract(value,'$.debit'))) FROM json_each(o.lines))) LIMIT 1`).first();
   if(reversal)throw Error('Archive reversal does not match its original.');
  }
 }
};
