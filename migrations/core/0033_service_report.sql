-- REPORT-004. Who reads the maintenance service and cost report: portfolio managers and maintenance coordinators
-- who run the work, and bookkeepers and accountants who read every report (the owner holds every action).
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','maintenance.report'),('maintenance_coordinator','maintenance.report'),('bookkeeper','maintenance.report'),('accountant','maintenance.report');
