-- Each partial refund freezes allocations against the original owners' remaining receipt amounts.
-- Never recompute a past refund against the receipt's original weights on every read.
DROP TRIGGER tt_refund_journal;
DROP VIEW tt_refund_owner_allocations;
DROP VIEW tt_refund_owner_weights;
CREATE TRIGGER tt_refund_journal AFTER INSERT ON tt_financial_recordings WHEN NEW.receipt_id IS NOT NULL BEGIN
 INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at)
 SELECT NEW.id||':'||json_extract(e.value,'$.ownerId'),NEW.on_day,json_extract(v.source_snapshot,'$.propertyId'),json_extract(e.value,'$.ownerId'),a.tenancy_id,'operating','refund',NEW.id,NEW.reference,json_array(json_object('account','receivable','debit',json_extract(e.value,'$.amountCents'),'credit',0),json_object('account','cash','debit',0,'credit',json_extract(e.value,'$.amountCents'))),NEW.recorded_by,NEW.recorded_at
 FROM tt_financial_actions a JOIN tt_financial_revisions v ON v.action_id=a.id AND v.version=NEW.version,json_each(v.source_snapshot,'$.ownerEffects') e WHERE a.id=NEW.action_id AND json_extract(e.value,'$.amountCents')>0;
END;
CREATE TABLE tt_financial_cancellations(action_id TEXT NOT NULL,version INTEGER NOT NULL,reason TEXT NOT NULL,cancelled_by TEXT NOT NULL,cancelled_at TEXT NOT NULL,PRIMARY KEY(action_id,version),FOREIGN KEY(action_id,version) REFERENCES tt_financial_revisions(action_id,version));
INSERT INTO tt_role_actions(role,action) VALUES('portfolio_manager','finance.cancel');
