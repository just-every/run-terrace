export default {
 product: 'residential/terrace',
 // ROLE-001: the capability table is product configuration each installation's migrations create, never archived data.
 excludeTables:['tt_role_actions'],
 requiredConfiguration: ['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
 async validateStaged({db,tables}) {
  const q=tables.tt_charges, r=tables.tt_receipts, a=tables.tt_adjustments;
  if(!q || !r || !a) throw new Error('Terrace rent tables are required.');
  const bad=await db.prepare(`SELECT 1 FROM "${q}" q WHERE q.amount_cents < COALESCE((SELECT SUM(amount_cents) FROM "${r}" WHERE charge_id=q.id),0)+COALESCE((SELECT SUM(amount_cents) FROM "${a}" WHERE charge_id=q.id),0) LIMIT 1`).first();
  if(bad) throw new Error('Receipt and adjustment totals exceed the charge.');
 }
};
