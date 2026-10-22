-- PORT-007 (ct 22 Oct 18:00Z): who reads restricted tenancy documents, always within ROLE-001 portfolio scope (404 outside it).
-- Screening reports: the owner and portfolio managers. Application documents: also leasing staff. Tax documents: also
-- accountants, who find, open and download them and no other document, and never upload or revise one.
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','document.application'),('leasing','document.application'),('accountant','document.tax');
