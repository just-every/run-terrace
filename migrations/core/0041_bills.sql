-- ACCT-007: private originals, exact revisions and recorded payables; no money movement.
CREATE TABLE tt_bills(id TEXT PRIMARY KEY,vendor_id TEXT NOT NULL REFERENCES tt_vendors(id),invoice_number TEXT NOT NULL,invoice_key TEXT NOT NULL,day TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','payable')),prepared_by TEXT NOT NULL,revised_by TEXT NOT NULL,created_at TEXT NOT NULL,template_id TEXT,period TEXT,UNIQUE(vendor_id,invoice_key),UNIQUE(template_id,period));
CREATE TABLE tt_bill_subjects(kind TEXT NOT NULL CHECK(kind IN ('bill','template')),entity_id TEXT NOT NULL,tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),PRIMARY KEY(kind,entity_id,tenancy_id));
CREATE TABLE tt_erased_bill_files(sha256 TEXT PRIMARY KEY);
CREATE INDEX tt_bill_subject_tenancy ON tt_bill_subjects(tenancy_id);

CREATE TABLE tt_bill_revisions(bill_id TEXT NOT NULL REFERENCES tt_bills(id),version INTEGER NOT NULL,terms TEXT NOT NULL,sha256 TEXT NOT NULL,prepared_by TEXT NOT NULL,prepared_at TEXT NOT NULL,PRIMARY KEY(bill_id,version));
CREATE TABLE tt_bill_attachments(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL REFERENCES tt_bills(id),version INTEGER NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,bytes BLOB NOT NULL,sha256 TEXT NOT NULL,original INTEGER NOT NULL CHECK(original IN (0,1)),recorded_by TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE UNIQUE INDEX tt_bill_original_bytes ON tt_bill_attachments(sha256) WHERE original=1;
CREATE TABLE tt_bill_decisions(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL REFERENCES tt_bills(id),version INTEGER NOT NULL,sha256 TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('approved','declined')),source TEXT NOT NULL,reference TEXT NOT NULL,recorded_by TEXT NOT NULL,recorded_at TEXT NOT NULL,UNIQUE(bill_id,version));
CREATE TABLE tt_bill_approvals(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL REFERENCES tt_bills(id),version INTEGER NOT NULL,sha256 TEXT NOT NULL,snapshot TEXT NOT NULL,approved_by TEXT NOT NULL,approved_at TEXT NOT NULL,label TEXT,UNIQUE(bill_id,version));
CREATE TABLE tt_bill_expenses(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL REFERENCES tt_bills(id),version INTEGER NOT NULL,property_id TEXT NOT NULL REFERENCES tt_properties(id),owner_id TEXT NOT NULL REFERENCES tt_owners(id),share_set_id TEXT NOT NULL REFERENCES tt_ownership_sets(id),agreement_id TEXT NOT NULL REFERENCES tt_management_agreements(id),day TEXT NOT NULL,share_bp INTEGER NOT NULL,property_cents INTEGER NOT NULL,amount_cents INTEGER NOT NULL);
CREATE TABLE tt_bill_templates(id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved')),terms TEXT NOT NULL,sha256 TEXT NOT NULL,prepared_by TEXT NOT NULL,revised_by TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE tt_bill_template_revisions(template_id TEXT NOT NULL REFERENCES tt_bill_templates(id),version INTEGER NOT NULL,terms TEXT NOT NULL,sha256 TEXT NOT NULL,prepared_by TEXT NOT NULL,prepared_at TEXT NOT NULL,PRIMARY KEY(template_id,version));
CREATE TABLE tt_bill_template_approvals(id TEXT PRIMARY KEY,template_id TEXT NOT NULL REFERENCES tt_bill_templates(id),version INTEGER NOT NULL,sha256 TEXT NOT NULL,approved_by TEXT NOT NULL,approved_at TEXT NOT NULL,label TEXT,UNIQUE(template_id,version));
CREATE TRIGGER tt_bill_revision_kept BEFORE UPDATE ON tt_bill_revisions BEGIN SELECT RAISE(ABORT,'Bill revision is immutable'); END;
CREATE TRIGGER tt_bill_decision_kept BEFORE UPDATE ON tt_bill_decisions BEGIN SELECT RAISE(ABORT,'Bill decision is immutable'); END;
CREATE TRIGGER tt_bill_approval_kept BEFORE UPDATE ON tt_bill_approvals BEGIN SELECT RAISE(ABORT,'Bill approval is immutable'); END;
CREATE TRIGGER tt_bill_attachment_kept BEFORE UPDATE ON tt_bill_attachments BEGIN SELECT RAISE(ABORT,'Bill original is immutable'); END;
CREATE TRIGGER tt_bill_expense_kept BEFORE UPDATE ON tt_bill_expenses BEGIN SELECT RAISE(ABORT,'Bill expense is immutable'); END;
CREATE TRIGGER tt_bill_template_revision_kept BEFORE UPDATE ON tt_bill_template_revisions BEGIN SELECT RAISE(ABORT,'Template revision is immutable'); END;
CREATE TRIGGER tt_bill_template_approval_kept BEFORE UPDATE ON tt_bill_template_approvals BEGIN SELECT RAISE(ABORT,'Template approval is immutable'); END;
CREATE TRIGGER tt_bill_period_insert BEFORE INSERT ON tt_bills WHEN EXISTS(SELECT 1 FROM tt_period_closes WHERE month=substr(NEW.day,1,7) AND reopened_at IS NULL) BEGIN SELECT RAISE(ABORT,'period_closed'); END;
CREATE TRIGGER tt_bill_period_update BEFORE UPDATE ON tt_bills WHEN NOT (EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.kind='bill' AND s.entity_id=OLD.id) AND NEW.id=OLD.id AND NEW.vendor_id=OLD.vendor_id AND NEW.day=OLD.day AND NEW.version=OLD.version AND NEW.state=OLD.state AND NEW.prepared_by=OLD.prepared_by AND NEW.revised_by=OLD.revised_by AND NEW.created_at=OLD.created_at AND NEW.template_id IS OLD.template_id AND NEW.period IS OLD.period AND NEW.invoice_number=OLD.id AND NEW.invoice_key=OLD.id) AND EXISTS(SELECT 1 FROM tt_period_closes WHERE month IN (substr(NEW.day,1,7),substr(OLD.day,1,7)) AND reopened_at IS NULL) BEGIN SELECT RAISE(ABORT,'period_closed'); END;
CREATE TABLE tt_fees_bills(id TEXT PRIMARY KEY,property_id TEXT NOT NULL REFERENCES tt_properties(id),owner_id TEXT NOT NULL REFERENCES tt_owners(id),month TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('management','minimum','leasing','renewal','markup')),source TEXT NOT NULL,source_label TEXT NOT NULL,base_cents INTEGER NOT NULL,rate_bp INTEGER,amount_cents INTEGER NOT NULL,tax_bp INTEGER NOT NULL,tax_cents INTEGER NOT NULL,agreement_id TEXT NOT NULL REFERENCES tt_management_agreements(id),override_reason TEXT,run_id TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
INSERT INTO tt_fees_bills SELECT * FROM tt_fees;
DROP TABLE tt_fees;
ALTER TABLE tt_fees_bills RENAME TO tt_fees;
CREATE INDEX tt_fees_property_month ON tt_fees(property_id,month);
CREATE INDEX tt_fees_owner ON tt_fees(owner_id,month);
CREATE TRIGGER tt_fee_immutable BEFORE UPDATE ON tt_fees WHEN NOT (
 EXISTS(SELECT 1 FROM tt_erasure_work w WHERE OLD.source='lease:'||w.tenancy_id OR OLD.source IN (SELECT 'receipt:'||r.id FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=w.tenancy_id) OR OLD.source IN (SELECT 'renewal:'||p.id FROM tt_proposals p WHERE p.tenancy_id=w.tenancy_id) OR EXISTS(SELECT 1 FROM tt_bill_subjects s WHERE s.tenancy_id=w.tenancy_id AND s.kind='bill' AND OLD.source LIKE 'bill:'||s.entity_id||':v%'))
 AND NEW.source_label='Retained accounting record' AND NEW.override_reason IS NULL
 AND NEW.id=OLD.id AND NEW.property_id=OLD.property_id AND NEW.owner_id=OLD.owner_id AND NEW.month=OLD.month AND NEW.day=OLD.day AND NEW.kind=OLD.kind AND NEW.source=OLD.source AND NEW.base_cents=OLD.base_cents AND NEW.rate_bp IS OLD.rate_bp AND NEW.amount_cents=OLD.amount_cents AND NEW.tax_bp=OLD.tax_bp AND NEW.tax_cents=OLD.tax_cents AND NEW.agreement_id=OLD.agreement_id AND NEW.run_id=OLD.run_id AND NEW.created_by=OLD.created_by AND NEW.created_at=OLD.created_at
) BEGIN SELECT RAISE(ABORT,'A fee line is never edited'); END;
CREATE TRIGGER tt_fee_kept BEFORE DELETE ON tt_fees BEGIN SELECT RAISE(ABORT,'A fee line is never deleted'); END;
CREATE TRIGGER tt_fee_period BEFORE INSERT ON tt_fees WHEN EXISTS(SELECT 1 FROM tt_period_closes WHERE month=NEW.month AND reopened_at IS NULL) BEGIN SELECT RAISE(ABORT,'period_closed'); END;
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','bills.read'),
('portfolio_manager','bill.create'),
('portfolio_manager','bill.revise'),
('portfolio_manager','bill.attach'),
('portfolio_manager','bill-template.create'),
('portfolio_manager','bill-template.revise'),
('portfolio_manager','bill-template.run'),
('bookkeeper','bills.read'),
('bookkeeper','bill.create'),
('bookkeeper','bill.revise'),
('bookkeeper','bill.attach'),
('bookkeeper','bill-template.create'),
('bookkeeper','bill-template.revise'),
('bookkeeper','bill-template.run');
INSERT INTO tt_role_actions(role,action) VALUES ('accountant','bills.read'),('portfolio_manager','bill.approve'),('portfolio_manager','bill.owner'),('portfolio_manager','bill-template.approve');

DROP TRIGGER tt_bill_revision_kept;
CREATE TRIGGER tt_bill_revision_kept BEFORE UPDATE ON tt_bill_revisions WHEN NOT (EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.kind='bill' AND s.entity_id=OLD.bill_id) AND NEW.bill_id=OLD.bill_id AND NEW.version=OLD.version AND NEW.prepared_by=OLD.prepared_by AND NEW.prepared_at=OLD.prepared_at AND NEW.sha256=OLD.sha256 AND json_remove(NEW.terms,'$.invoiceNumber','$.purpose','$.lines')=json_remove(OLD.terms,'$.invoiceNumber','$.purpose','$.lines')
 AND json_extract(NEW.terms,'$.invoiceNumber')=OLD.bill_id AND json_array_length(NEW.terms,'$.lines')=json_array_length(OLD.terms,'$.lines')
 AND NOT EXISTS(SELECT 1 FROM json_each(OLD.terms,'$.lines') o LEFT JOIN json_each(NEW.terms,'$.lines') n ON n.key=o.key WHERE json_remove(o.value,'$.description','$.code')<>json_remove(n.value,'$.description','$.code') OR json_extract(n.value,'$.description')<>'Retained accounting record' OR json_extract(n.value,'$.code')<>'retained-expense')) BEGIN SELECT RAISE(ABORT,'Bill evidence is immutable'); END;
DROP TRIGGER tt_bill_template_revision_kept;
CREATE TRIGGER tt_bill_template_revision_kept BEFORE UPDATE ON tt_bill_template_revisions WHEN NOT (EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.kind='template' AND s.entity_id=OLD.template_id) AND NEW.template_id=OLD.template_id AND NEW.version=OLD.version AND NEW.prepared_by=OLD.prepared_by AND NEW.prepared_at=OLD.prepared_at AND NEW.sha256=OLD.sha256 AND json_remove(NEW.terms,'$.invoiceNumber','$.purpose','$.lines')=json_remove(OLD.terms,'$.invoiceNumber','$.purpose','$.lines')
 AND json_extract(NEW.terms,'$.invoiceNumber')=OLD.template_id AND json_array_length(NEW.terms,'$.lines')=json_array_length(OLD.terms,'$.lines')
 AND NOT EXISTS(SELECT 1 FROM json_each(OLD.terms,'$.lines') o LEFT JOIN json_each(NEW.terms,'$.lines') n ON n.key=o.key WHERE json_remove(o.value,'$.description','$.code')<>json_remove(n.value,'$.description','$.code') OR json_extract(n.value,'$.description')<>'Retained accounting record' OR json_extract(n.value,'$.code')<>'retained-expense')) BEGIN SELECT RAISE(ABORT,'Bill evidence is immutable'); END;

DROP TRIGGER tt_bill_decision_kept;
CREATE TRIGGER tt_bill_decision_kept BEFORE UPDATE ON tt_bill_decisions WHEN NOT (
 EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.kind='bill' AND s.entity_id=OLD.bill_id)
 AND NEW.reference='Retained accounting record' AND NEW.id=OLD.id AND NEW.bill_id=OLD.bill_id AND NEW.version=OLD.version AND NEW.sha256=OLD.sha256 AND NEW.decision=OLD.decision AND NEW.source=OLD.source AND NEW.recorded_by=OLD.recorded_by AND NEW.recorded_at=OLD.recorded_at
) BEGIN SELECT RAISE(ABORT,'Bill decision is immutable'); END;
DROP TRIGGER tt_bill_approval_kept;
CREATE TRIGGER tt_bill_approval_kept BEFORE UPDATE ON tt_bill_approvals WHEN NOT (
 EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.kind='bill' AND s.entity_id=OLD.bill_id)
 AND NEW.id=OLD.id AND NEW.bill_id=OLD.bill_id AND NEW.version=OLD.version AND NEW.sha256=OLD.sha256 AND NEW.approved_by=OLD.approved_by AND NEW.approved_at=OLD.approved_at AND NEW.label IS OLD.label
 AND json_remove(NEW.snapshot,'$.terms','$.decision.reference')=json_remove(OLD.snapshot,'$.terms','$.decision.reference')
 AND json_remove(NEW.snapshot,'$.terms.invoiceNumber','$.terms.purpose','$.terms.lines','$.decision.reference')=json_remove(OLD.snapshot,'$.terms.invoiceNumber','$.terms.purpose','$.terms.lines','$.decision.reference')
 AND json_array_length(NEW.snapshot,'$.terms.lines')=json_array_length(OLD.snapshot,'$.terms.lines')
 AND NOT EXISTS(SELECT 1 FROM json_each(OLD.snapshot,'$.terms.lines') o LEFT JOIN json_each(NEW.snapshot,'$.terms.lines') n ON n.key=o.key WHERE json_remove(o.value,'$.description','$.code')<>json_remove(n.value,'$.description','$.code'))
) BEGIN SELECT RAISE(ABORT,'Bill approval is immutable'); END;

DROP TRIGGER tt_audit_immutable;

CREATE TRIGGER tt_audit_immutable BEFORE UPDATE ON tt_audit WHEN NOT (
 (EXISTS(SELECT 1 FROM tt_erasure_work WHERE tenancy_id=OLD.tenancy_id) OR EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.entity_id=OLD.subject AND ((s.kind='bill' AND OLD.action LIKE 'bill.%') OR (s.kind='template' AND OLD.action LIKE 'bill-template.%'))))
 AND NEW.id=OLD.id AND NEW.actor=OLD.actor AND NEW.action=OLD.action AND NEW.at=OLD.at
 AND NEW.role IS OLD.role AND NEW.policy IS OLD.policy AND NEW.tenancy_id IS OLD.tenancy_id
 AND NEW.outcome IS OLD.outcome AND (NEW.subject=OLD.tenancy_id OR (NEW.subject=OLD.subject AND EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.entity_id=OLD.subject))) AND NEW.source IS NULL
) BEGIN SELECT RAISE(ABORT,'History is never edited'); END;
