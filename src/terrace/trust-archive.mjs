// Validate staged custody before Base installs any archive rows; source amounts stay authoritative.
export async function validateTrustArchive(db,tables){
 const names=['tt_trust_mappings','tt_trust_allocations','tt_trust_transfers','tt_trust_approvals','tt_trust_recordings','tt_operating_accounts','tt_journal'];
 if(!names.every(n=>tables[n]))return;
 const [m,a,t,p,r,b,j]=names.map(n=>'"'+tables[n]+'"');
 const invalid=async sql=>!!await db.prepare(sql+' LIMIT 1').first();
 if(await invalid(`SELECT 1 FROM ${m} m LEFT JOIN ${b} b ON b.id=m.bank_id WHERE b.id IS NULL OR NOT((m.fund='deposit' AND b.purpose='deposit') OR (m.fund='operating' AND b.purpose IN ('operating','rent_trust'))) OR EXISTS(SELECT 1 FROM ${m} x JOIN ${b} y ON y.id=x.bank_id WHERE x.property_id=m.property_id AND y.entity_id<>b.entity_id)`))throw Error('Archive bank mapping violates designated fund or legal entity.');
 if(await invalid(`SELECT 1 FROM ${a} a LEFT JOIN ${j} j ON j.id=a.journal_id WHERE j.id IS NULL OR NOT EXISTS(SELECT 1 FROM ${m} m WHERE m.property_id=j.property_id AND m.bank_id=a.bank_id AND m.fund=j.fund)`))throw Error('Archive custody allocation has no authorized journal source.');
 if(await invalid(`SELECT 1 FROM ${t} t LEFT JOIN ${b} f ON f.id=t.from_bank LEFT JOIN ${b} z ON z.id=t.to_bank WHERE f.id IS NULL OR z.id IS NULL OR f.purpose<>z.purpose OR t.from_bank=t.to_bank OR t.amount_cents<=0 OR NOT EXISTS(SELECT 1 FROM ${m} m WHERE m.property_id=t.property_id AND m.bank_id=t.from_bank AND m.fund=t.fund) OR NOT EXISTS(SELECT 1 FROM ${m} m WHERE m.property_id=t.property_id AND m.bank_id=t.to_bank AND m.fund=t.fund)`))throw Error('Archive transfer crosses a designated bank boundary.');
 if(await invalid(`SELECT 1 FROM ${r} r WHERE NOT EXISTS(SELECT 1 FROM ${p} p JOIN ${t} t ON t.id=p.transfer_id WHERE p.transfer_id=r.transfer_id)`))throw Error('Archive transfer recording has no human approval.');
 if(await invalid(`SELECT 1 FROM (
 SELECT a.bank_id,j.property_id,j.owner_key,j.fund,SUM(json_extract(l.value,'$.debit')-json_extract(l.value,'$.credit')) AS n FROM ${a} a JOIN ${j} j ON j.id=a.journal_id,json_each(j.lines) l WHERE json_extract(l.value,'$.account')='cash' GROUP BY a.bank_id,j.property_id,j.owner_key,j.fund
 UNION ALL SELECT t.from_bank,t.property_id,t.owner_id,t.fund,-t.amount_cents FROM ${r} r JOIN ${t} t ON t.id=r.transfer_id
 UNION ALL SELECT t.to_bank,t.property_id,t.owner_id,t.fund,t.amount_cents FROM ${r} r JOIN ${t} t ON t.id=r.transfer_id
 ) GROUP BY bank_id,property_id,owner_key,fund HAVING SUM(n)<0`))throw Error('Archive overdraws a bank beneficiary balance.');
}
