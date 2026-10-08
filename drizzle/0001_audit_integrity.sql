CREATE FUNCTION cloudsentry_reject_history_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CloudSentry history is append-only' USING ERRCODE = '42501';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION cloudsentry_reject_history_changes();
--> statement-breakpoint
CREATE TRIGGER decisions_append_only BEFORE UPDATE OR DELETE ON decisions FOR EACH ROW EXECUTE FUNCTION cloudsentry_reject_history_changes();
--> statement-breakpoint
CREATE FUNCTION cloudsentry_immutable_script() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.script_text IS DISTINCT FROM OLD.script_text OR NEW.script_hash IS DISTINCT FROM OLD.script_hash OR NEW.action IS DISTINCT FROM OLD.action OR NEW.format IS DISTINCT FROM OLD.format OR NEW.finding_id IS DISTINCT FROM OLD.finding_id OR NEW.original_configuration IS DISTINCT FROM OLD.original_configuration THEN
    RAISE EXCEPTION 'Create a new remediation version and obtain fresh approval' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER remediations_immutable_script BEFORE UPDATE ON remediations FOR EACH ROW EXECUTE FUNCTION cloudsentry_immutable_script();
--> statement-breakpoint
ALTER TABLE decisions ADD CONSTRAINT decisions_remediation_hash_fk FOREIGN KEY (remediation_id, script_hash) REFERENCES remediations (id, script_hash);
