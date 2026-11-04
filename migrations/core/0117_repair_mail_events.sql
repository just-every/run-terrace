-- Existing sends have no frozen provider and cannot acquire callback authority.
ALTER TABLE tt_messages ADD COLUMN mail_provider TEXT;
ALTER TABLE tt_messages ADD COLUMN mail_recipient TEXT;
ALTER TABLE tt_messages ADD COLUMN mail_event_id TEXT;
CREATE TRIGGER tt_message_mail_claim_immutable BEFORE UPDATE OF mail_provider,mail_recipient ON tt_messages
 WHEN OLD.claimed_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'Mail identity is frozen at the send claim'); END;
