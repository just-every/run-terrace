-- Additive migration. Never drop existing delivery receipts or state.
CREATE TABLE IF NOT EXISTS rer_mail_event_receipts (
  provider TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_namespace TEXT NOT NULL,
  event_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  event_json TEXT NOT NULL,
  commit_token TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  conflict INTEGER NOT NULL DEFAULT 0 CONSTRAINT rer_mail_event_identity_conflict CHECK (conflict = 0),
  PRIMARY KEY (provider, tenant_id, event_namespace, event_id)
);
CREATE TABLE IF NOT EXISTS rer_mail_event_states (
  provider TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_namespace TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  terminal INTEGER NOT NULL CHECK (terminal IN (0, 1)),
  PRIMARY KEY (provider, tenant_id, event_namespace, provider_message_id, recipient)
);

-- Keep callback intake atomic with eligible financial-document erasure.
CREATE TRIGGER tt_resident_mail_custody_fence BEFORE INSERT ON rer_mail_event_receipts
WHEN NEW.event_namespace='terrace-resident-documents' AND NOT EXISTS(
 SELECT 1 FROM tt_resident_deliveries d WHERE d.provider=NEW.provider
 AND d.recipient=json_extract(NEW.event_json,'$.recipients[0]')
 AND (d.id=json_extract(NEW.event_json,'$.deliveryId') OR
 (json_extract(NEW.event_json,'$.deliveryId') IS NULL AND d.provider_id=json_extract(NEW.event_json,'$.providerMessageId')))
)
BEGIN SELECT RAISE(ABORT,'resident_delivery_erased'); END;
