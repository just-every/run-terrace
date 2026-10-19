-- WORK-005: staff-recorded access and appointments. No provider delivery or portal reply is claimed.
CREATE TABLE tt_appointments (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 approval_id TEXT NOT NULL REFERENCES tt_maintenance_approvals(id), previous_id TEXT REFERENCES tt_appointments(id) ON DELETE SET NULL,
 vendor_id TEXT, vendor_name TEXT NOT NULL, vendor_email TEXT NOT NULL, staff_id TEXT NOT NULL,
 time_zone TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
 access_starts_at TEXT NOT NULL, access_ends_at TEXT NOT NULL, permission_reference TEXT NOT NULL,
 notice_reference TEXT NOT NULL, notice_at TEXT NOT NULL, keys_access TEXT NOT NULL, availability_reference TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','confirmed','cancelled','no_show','superseded')),
 version INTEGER NOT NULL DEFAULT 1, vendor_confirmed_at TEXT, resident_confirmed_at TEXT, confirmed_at TEXT,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 CHECK(starts_at < ends_at AND access_starts_at <= starts_at AND ends_at <= access_ends_at)
);
CREATE UNIQUE INDEX tt_appointment_active ON tt_appointments(job_id) WHERE state IN ('proposed','confirmed');
CREATE INDEX tt_appointment_calendar ON tt_appointments(staff_id,starts_at,ends_at);
CREATE TABLE tt_appointment_events (
 id TEXT PRIMARY KEY, appointment_id TEXT NOT NULL REFERENCES tt_appointments(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, party TEXT, outcome TEXT, reference TEXT NOT NULL, label TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX tt_appointment_event_history ON tt_appointment_events(appointment_id,recorded_at);
CREATE TRIGGER tt_appointment_evidence_immutable BEFORE UPDATE OF job_id,approval_id,vendor_id,vendor_name,vendor_email,staff_id,time_zone,starts_at,ends_at,access_starts_at,access_ends_at,permission_reference,notice_reference,notice_at,keys_access,availability_reference,recorded_by,recorded_at ON tt_appointments BEGIN SELECT RAISE(ABORT,'Appointment evidence is never edited; reschedule it'); END;
CREATE TRIGGER tt_appointment_event_immutable BEFORE UPDATE ON tt_appointment_events BEGIN SELECT RAISE(ABORT,'Appointment history is never edited'); END;
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','appointment.book'),('portfolio_manager','appointment.confirm'),('portfolio_manager','appointment.cancel'),('portfolio_manager','appointment.no-show'),('portfolio_manager','appointment.reassign'),('maintenance_coordinator','appointment.book'),('maintenance_coordinator','appointment.confirm'),('maintenance_coordinator','appointment.cancel'),('maintenance_coordinator','appointment.no-show'),('maintenance_coordinator','appointment.reassign');
