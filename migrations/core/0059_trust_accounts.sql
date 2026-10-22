-- ACCT-002: recorded custody only. No bank credential or payment rail.
ALTER TABLE tt_operating_accounts ADD COLUMN purpose TEXT NOT NULL DEFAULT 'operating' CHECK(purpose IN ('operating','rent_trust','deposit'));
CREATE TABLE tt_trust_mappings(property_id TEXT NOT NULL REFERENCES tt_properties(id),bank_id TEXT NOT NULL REFERENCES tt_operating_accounts(id),fund TEXT NOT NULL CHECK(fund IN ('operating','deposit')),is_primary INTEGER NOT NULL CHECK(is_primary IN (0,1)),reference TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(property_id,bank_id));
CREATE UNIQUE INDEX tt_trust_primary ON tt_trust_mappings(property_id,fund) WHERE is_primary=1;
CREATE TRIGGER tt_trust_mapping_valid BEFORE INSERT ON tt_trust_mappings BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tt_operating_accounts a WHERE a.id=NEW.bank_id AND ((NEW.fund='deposit' AND a.purpose='deposit') OR (NEW.fund='operating' AND a.purpose IN ('operating','rent_trust')))) OR EXISTS(SELECT 1 FROM tt_trust_mappings m JOIN tt_operating_accounts a ON a.id=m.bank_id WHERE m.property_id=NEW.property_id AND a.entity_id<>(SELECT entity_id FROM tt_operating_accounts WHERE id=NEW.bank_id)) THEN RAISE(ABORT,'bank_fund_or_entity') END;
END;
CREATE TABLE tt_trust_allocations(journal_id TEXT PRIMARY KEY REFERENCES tt_journal(id),bank_id TEXT NOT NULL REFERENCES tt_operating_accounts(id),recorded_by TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TABLE tt_trust_transfers(id TEXT PRIMARY KEY,property_id TEXT NOT NULL REFERENCES tt_properties(id),owner_id TEXT NOT NULL REFERENCES tt_owners(id),fund TEXT NOT NULL CHECK(fund IN ('operating','deposit')),from_bank TEXT NOT NULL REFERENCES tt_operating_accounts(id),to_bank TEXT NOT NULL REFERENCES tt_operating_accounts(id),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),day TEXT NOT NULL,reason TEXT NOT NULL,prepared_by TEXT NOT NULL,prepared_at TEXT NOT NULL,CHECK(from_bank<>to_bank));
CREATE TABLE tt_trust_approvals(transfer_id TEXT PRIMARY KEY REFERENCES tt_trust_transfers(id),approved_by TEXT NOT NULL,approved_at TEXT NOT NULL,label TEXT);
CREATE TABLE tt_trust_recordings(transfer_id TEXT PRIMARY KEY REFERENCES tt_trust_transfers(id),bank_reference TEXT NOT NULL UNIQUE,recorded_by TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE VIEW tt_trust_cash AS
 SELECT a.bank_id,j.property_id,j.owner_key,j.fund,j.day,l.debit_cents-l.credit_cents AS amount_cents,j.id AS source_id,'journal' AS source_kind FROM tt_trust_allocations a JOIN tt_journal j ON j.id=a.journal_id JOIN tt_journal_lines l ON l.id=j.id JOIN tt_gl_chart g ON g.code=l.account WHERE g.cash=1
 UNION ALL SELECT t.from_bank,t.property_id,t.owner_id,t.fund,t.day,-t.amount_cents,t.id,'transfer' FROM tt_trust_recordings r JOIN tt_trust_transfers t ON t.id=r.transfer_id
 UNION ALL SELECT t.to_bank,t.property_id,t.owner_id,t.fund,t.day,t.amount_cents,t.id,'transfer' FROM tt_trust_recordings r JOIN tt_trust_transfers t ON t.id=r.transfer_id;
CREATE VIEW tt_trust_running_cash AS SELECT bank_id,property_id,owner_key,fund,day,SUM(SUM(amount_cents)) OVER (PARTITION BY bank_id,property_id,owner_key,fund ORDER BY day) AS balance_cents FROM tt_trust_cash GROUP BY bank_id,property_id,owner_key,fund,day;
CREATE TRIGGER tt_trust_allocate_valid BEFORE INSERT ON tt_trust_allocations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tt_journal j JOIN tt_trust_mappings m ON m.property_id=j.property_id AND m.fund=j.fund AND m.bank_id=NEW.bank_id WHERE j.id=NEW.journal_id) THEN RAISE(ABORT,'bank_fund_or_entity') END;
END;
CREATE TRIGGER tt_trust_allocate_balance AFTER INSERT ON tt_trust_allocations BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM tt_trust_running_cash WHERE bank_id=NEW.bank_id AND balance_cents<0) THEN RAISE(ABORT,'insufficient_bank_funds') END;
END;
CREATE TRIGGER tt_trust_journal AFTER INSERT ON tt_journal BEGIN
 SELECT CASE WHEN NEW.source_kind='receipt' AND EXISTS(SELECT 1 FROM tt_trust_mappings m JOIN tt_operating_accounts a ON a.id=m.bank_id WHERE m.property_id=NEW.property_id AND m.fund=NEW.fund AND m.is_primary=1 AND a.purpose<>'rent_trust') THEN RAISE(ABORT,'rent_trust_required') END;
 INSERT INTO tt_trust_allocations(journal_id,bank_id,recorded_by,recorded_at)
 SELECT NEW.id,a.bank_id,NEW.recorded_by,NEW.recorded_at FROM tt_trust_allocations a WHERE a.journal_id=NEW.reversal_of
 UNION ALL SELECT NEW.id,m.bank_id,NEW.recorded_by,NEW.recorded_at FROM tt_trust_mappings m WHERE NEW.reversal_of IS NULL AND m.property_id=NEW.property_id AND m.fund=NEW.fund AND m.is_primary=1 AND EXISTS(SELECT 1 FROM json_each(NEW.lines) l JOIN tt_gl_chart a ON a.code=json_extract(l.value,'$.account') WHERE a.cash=1);
END;
CREATE TRIGGER tt_trust_record_valid BEFORE INSERT ON tt_trust_recordings BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tt_trust_approvals WHERE transfer_id=NEW.transfer_id) THEN RAISE(ABORT,'transfer_not_approved') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM tt_trust_transfers t WHERE t.id=NEW.transfer_id AND (SELECT COALESCE(SUM(amount_cents),0) FROM tt_trust_cash WHERE bank_id=t.from_bank AND property_id=t.property_id AND owner_key=t.owner_id AND fund=t.fund)<t.amount_cents) THEN RAISE(ABORT,'insufficient_bank_funds') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM tt_trust_transfers t JOIN tt_period_closes p ON p.month=substr(t.day,1,7) WHERE t.id=NEW.transfer_id AND p.reopened_at IS NULL) THEN RAISE(ABORT,'period_closed') END;
END;
CREATE TRIGGER tt_trust_record_balance AFTER INSERT ON tt_trust_recordings BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM tt_trust_running_cash WHERE balance_cents<0) THEN RAISE(ABORT,'insufficient_bank_funds') END;
END;
INSERT INTO tt_role_actions(role,action) VALUES('portfolio_manager','trust.prepare'),('bookkeeper','trust.prepare'),('portfolio_manager','trust.approve'),('portfolio_manager','trust.record'),('bookkeeper','trust.record');
CREATE TRIGGER tt_trust_mappings_update BEFORE UPDATE ON tt_trust_mappings BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_mappings_delete BEFORE DELETE ON tt_trust_mappings BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_allocations_update BEFORE UPDATE ON tt_trust_allocations BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_allocations_delete BEFORE DELETE ON tt_trust_allocations BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_transfers_update BEFORE UPDATE ON tt_trust_transfers BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_transfers_delete BEFORE DELETE ON tt_trust_transfers BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_approvals_update BEFORE UPDATE ON tt_trust_approvals BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_approvals_delete BEFORE DELETE ON tt_trust_approvals BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_recordings_update BEFORE UPDATE ON tt_trust_recordings BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_trust_recordings_delete BEFORE DELETE ON tt_trust_recordings BEGIN SELECT RAISE(ABORT,'Trust records are immutable'); END;
CREATE TRIGGER tt_bank_designation_fixed BEFORE UPDATE ON tt_operating_accounts BEGIN SELECT RAISE(ABORT,'Bank account references and designations are immutable'); END;
CREATE TRIGGER tt_bank_designation_kept BEFORE DELETE ON tt_operating_accounts BEGIN SELECT RAISE(ABORT,'Bank account references are never deleted'); END;
