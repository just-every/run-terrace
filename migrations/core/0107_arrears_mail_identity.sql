-- SendGrid correlates the durable delivery identity with its complete event ID.
DROP TRIGGER tt_arrears_mail_custody_fence;
CREATE TRIGGER tt_arrears_mail_custody_fence BEFORE INSERT ON rer_mail_event_receipts
WHEN NEW.event_namespace='terrace-arrears' AND NOT EXISTS(
 SELECT 1 FROM tt_arrears_actions a JOIN tt_tenancies t ON t.id=a.tenancy_id
 WHERE t.erased_at IS NULL AND t.custody_retired_at IS NULL AND a.provider=NEW.provider
 AND json_extract(a.snapshot,'$.recipient')=json_extract(NEW.event_json,'$.recipients[0]')
 AND (a.provider_id=json_extract(NEW.event_json,'$.providerMessageId') OR
  (NEW.provider='sendgrid' AND substr(json_extract(NEW.event_json,'$.providerMessageId'),1,length(a.provider_id)+1)=a.provider_id||'.'))
)
BEGIN SELECT RAISE(ABORT,'arrears_delivery_erased'); END;
