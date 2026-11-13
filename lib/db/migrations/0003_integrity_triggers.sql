-- ACID / integrity backstops. These make the rules true in the database itself, so a bug in application code
-- (or a leaked service key used carelessly) cannot break them. Permissions are still decided in lib/policy.ts.

-- 1. RLS deny-all on the tables added in 0002 (see 0001 for the reasoning).
ALTER TABLE "share_hidden_category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "share_hidden_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "glossary_alias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "glossary_question" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drug_allergy_alias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 2. Append-only audit tables (FR-13, NFR-24): no UPDATE, DELETE or TRUNCATE, by anyone.
CREATE FUNCTION itan_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER access_log_append_only BEFORE UPDATE OR DELETE ON "access_log"
  FOR EACH ROW EXECUTE FUNCTION itan_append_only();--> statement-breakpoint
CREATE TRIGGER fact_event_append_only BEFORE UPDATE OR DELETE ON "fact_event"
  FOR EACH ROW EXECUTE FUNCTION itan_append_only();--> statement-breakpoint
CREATE TRIGGER access_log_no_truncate BEFORE TRUNCATE ON "access_log"
  FOR EACH STATEMENT EXECUTE FUNCTION itan_append_only();--> statement-breakpoint
CREATE TRIGGER fact_event_no_truncate BEFORE TRUNCATE ON "fact_event"
  FOR EACH STATEMENT EXECUTE FUNCTION itan_append_only();--> statement-breakpoint

-- 3. Hospital-sent facts are immutable (NFR-24). Only these may change: state (confirmed <-> disputed),
--    superseded_by (a corrected result replaced it), removed_at is NOT allowed, sensitive_category (the patient's
--    privacy tag, not clinical content).
CREATE FUNCTION itan_provider_fact_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.origin = 'provider_entered' THEN
    IF NEW.origin IS DISTINCT FROM OLD.origin
       OR NEW.record_id IS DISTINCT FROM OLD.record_id
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.label_as_printed IS DISTINCT FROM OLD.label_as_printed
       OR NEW.value_as_printed IS DISTINCT FROM OLD.value_as_printed
       OR NEW.unit_as_printed IS DISTINCT FROM OLD.unit_as_printed
       OR NEW.range_as_printed IS DISTINCT FROM OLD.range_as_printed
       OR NEW.value_num IS DISTINCT FROM OLD.value_num
       OR NEW.range_low IS DISTINCT FROM OLD.range_low
       OR NEW.range_high IS DISTINCT FROM OLD.range_high
       OR NEW.fact_date IS DISTINCT FROM OLD.fact_date
       OR NEW.fact_date_as_printed IS DISTINCT FROM OLD.fact_date_as_printed
       OR NEW.extra IS DISTINCT FROM OLD.extra
       OR NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
       OR NEW.facility_name IS DISTINCT FROM OLD.facility_name
       OR NEW.feed_receipt_id IS DISTINCT FROM OLD.feed_receipt_id
       OR NEW.source_identifier IS DISTINCT FROM OLD.source_identifier
       OR NEW.removed_at IS DISTINCT FROM OLD.removed_at THEN
      RAISE EXCEPTION 'provider-entered facts cannot be edited' USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.state NOT IN ('confirmed', 'disputed') THEN
      RAISE EXCEPTION 'provider-entered facts are only confirmed or disputed' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER fact_provider_immutable BEFORE UPDATE ON "fact"
  FOR EACH ROW EXECUTE FUNCTION itan_provider_fact_immutable();--> statement-breakpoint

-- 4. A record always has at least one holder is enforced in code (createRecord inserts both rows in one
--    transaction); a document and its facts always share a record:
ALTER TABLE "fact" ADD CONSTRAINT "fact_confirmed_only_for_non_ai_chk"
  CHECK (origin = 'ai_read' OR state IN ('confirmed', 'disputed'));
