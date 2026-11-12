CREATE TABLE "access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"share_id" uuid,
	"link_id" uuid,
	"fact_id" uuid,
	CONSTRAINT "access_log_outcome_chk" CHECK ("access_log"."outcome" in ('allowed', 'refused')),
	CONSTRAINT "access_log_actor_chk" CHECK ("access_log"."actor_type" in ('patient', 'clinician', 'partner', 'system'))
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ai_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"client_upload_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" integer NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"error_code" text,
	"doc_type" text,
	"model_version" text,
	"prompt_version" text,
	"raw_extraction" jsonb,
	"facility_as_printed" text,
	"document_date_as_printed" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"extracted_at" timestamp with time zone,
	CONSTRAINT "document_client_upload_id_uq" UNIQUE("client_upload_id"),
	CONSTRAINT "document_status_chk" CHECK ("document"."status" in ('uploaded', 'extracting', 'extracted', 'failed')),
	CONSTRAINT "document_mime_chk" CHECK ("document"."mime" in ('image/jpeg', 'image/png', 'application/pdf'))
);
--> statement-breakpoint
CREATE TABLE "drug_allergy_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_key" text NOT NULL,
	"allergy_aliases" text[] NOT NULL,
	"medicine_aliases" text[] NOT NULL,
	"note" text NOT NULL,
	"reviewed_by" text,
	CONSTRAINT "drug_allergy_rule_key_uq" UNIQUE("rule_key")
);
--> statement-breakpoint
CREATE TABLE "facility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"is_simulated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_name_uq" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"document_id" uuid,
	"feed_receipt_id" uuid,
	"created_by_account_id" uuid,
	"hospital_id" uuid,
	"facility_name" text,
	"origin" text NOT NULL,
	"state" text NOT NULL,
	"kind" text NOT NULL,
	"label_as_printed" text NOT NULL,
	"test_key" text,
	"value_as_printed" text,
	"value_num" numeric,
	"unit_as_printed" text,
	"range_as_printed" text,
	"range_low" numeric,
	"range_high" numeric,
	"flag_as_printed" text,
	"fact_date" date,
	"fact_date_as_printed" text,
	"unreadable" boolean DEFAULT false NOT NULL,
	"check_carefully" boolean DEFAULT false NOT NULL,
	"confidence" text,
	"source_quote" text,
	"source_box" jsonb,
	"source_page" integer,
	"sensitive_category" text,
	"source_identifier" text,
	"superseded_by" uuid,
	"removed_at" timestamp with time zone,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fact_origin_chk" CHECK ("fact"."origin" in ('ai_read', 'patient_added', 'provider_entered')),
	CONSTRAINT "fact_state_chk" CHECK ("fact"."state" in ('unverified', 'confirmed', 'disputed')),
	CONSTRAINT "fact_kind_chk" CHECK ("fact"."kind" in ('lab', 'medication', 'allergy', 'diagnosis', 'referral', 'other')),
	CONSTRAINT "fact_confidence_chk" CHECK ("fact"."confidence" is null or "fact"."confidence" in ('high', 'medium', 'low')),
	CONSTRAINT "fact_sensitive_category_chk" CHECK ("fact"."sensitive_category" is null or "fact"."sensitive_category" in ('sexual_reproductive', 'mental_health', 'infectious_disease', 'substance_use', 'other_sensitive'))
);
--> statement-breakpoint
CREATE TABLE "fact_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fact_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_account_id" uuid,
	"event" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"note" text,
	CONSTRAINT "fact_event_actor_chk" CHECK ("fact_event"."actor_type" in ('system', 'patient', 'partner'))
);
--> statement-breakpoint
CREATE TABLE "feed_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid,
	"link_id" uuid,
	"idempotency_key" text,
	"status" text NOT NULL,
	"refusal_reason" text,
	"facts_created" integer DEFAULT 0 NOT NULL,
	"bundle_bytes" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_receipt_hospital_idem_uq" UNIQUE("hospital_id","idempotency_key"),
	CONSTRAINT "feed_receipt_status_chk" CHECK ("feed_receipt"."status" in ('accepted', 'refused'))
);
--> statement-breakpoint
CREATE TABLE "glossary" (
	"test_key" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"aliases" text[] NOT NULL,
	"description" text NOT NULL,
	"questions" text[] NOT NULL,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "hospital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"simulated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hospital_name_uq" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "hospital_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "hospital_credential_key_hash_uq" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "hospital_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"link_ref" text NOT NULL,
	"hospital_patient_ref" text,
	"linked_by_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "hospital_link_link_ref_uq" UNIQUE("link_ref")
);
--> statement-breakpoint
CREATE TABLE "patient_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"birth_year" integer,
	"is_self" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_member" (
	"account_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"role" text DEFAULT 'holder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_member_account_id_record_id_pk" PRIMARY KEY("account_id","record_id"),
	CONSTRAINT "record_member_role_chk" CHECK ("record_member"."role" in ('holder'))
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"created_by_account_id" uuid,
	"destination_facility_id" uuid,
	"source_fact_id" uuid,
	"reason_as_written" text,
	"urgency_as_written" text,
	"urgency_code" text,
	"referring_clinician_as_written" text,
	"referral_date_as_written" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_urgency_code_chk" CHECK ("referral"."urgency_code" is null or "referral"."urgency_code" in ('routine', 'urgent', 'asap', 'stat'))
);
--> statement-breakpoint
CREATE TABLE "referral_ack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" uuid NOT NULL,
	"viewer_session_id" text NOT NULL,
	"status" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_ack_status_chk" CHECK ("referral_ack"."status" in ('service_offered', 'service_not_offered'))
);
--> statement-breakpoint
CREATE TABLE "share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text DEFAULT 'general' NOT NULL,
	"hidden_categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"hidden_document_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"referral_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_code_hash_uq" UNIQUE("code_hash"),
	CONSTRAINT "share_purpose_chk" CHECK ("share"."purpose" in ('general', 'referral'))
);
--> statement-breakpoint
CREATE TABLE "viewer_session" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"share_id" uuid NOT NULL,
	"viewer_name" text NOT NULL,
	"practice_no" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_record_id_patient_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_share_id_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_link_id_hospital_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."hospital_link"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_fact_id_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."fact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_record_id_patient_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_record_id_patient_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_feed_receipt_id_feed_receipt_id_fk" FOREIGN KEY ("feed_receipt_id") REFERENCES "public"."feed_receipt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_created_by_account_id_account_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_hospital_id_hospital_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospital"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_superseded_by_fact_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."fact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_event" ADD CONSTRAINT "fact_event_fact_id_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."fact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_event" ADD CONSTRAINT "fact_event_actor_account_id_account_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_receipt" ADD CONSTRAINT "feed_receipt_hospital_id_hospital_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospital"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_receipt" ADD CONSTRAINT "feed_receipt_link_id_hospital_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."hospital_link"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_credential" ADD CONSTRAINT "hospital_credential_hospital_id_hospital_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospital"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_link" ADD CONSTRAINT "hospital_link_record_id_patient_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_link" ADD CONSTRAINT "hospital_link_hospital_id_hospital_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospital"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_link" ADD CONSTRAINT "hospital_link_linked_by_account_id_account_id_fk" FOREIGN KEY ("linked_by_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_member" ADD CONSTRAINT "record_member_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_member" ADD CONSTRAINT "record_member_record_id_patient_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_record_id_patient_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_created_by_account_id_account_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_destination_facility_id_facility_id_fk" FOREIGN KEY ("destination_facility_id") REFERENCES "public"."facility"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_source_fact_id_fact_id_fk" FOREIGN KEY ("source_fact_id") REFERENCES "public"."fact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_ack" ADD CONSTRAINT "referral_ack_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_ack" ADD CONSTRAINT "referral_ack_viewer_session_id_viewer_session_token_hash_fk" FOREIGN KEY ("viewer_session_id") REFERENCES "public"."viewer_session"("token_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_record_id_patient_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_session" ADD CONSTRAINT "viewer_session_share_id_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_log_record_at_idx" ON "access_log" USING btree ("record_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "code_attempt_ip_at_idx" ON "code_attempt" USING btree ("ip_hash","at");--> statement-breakpoint
CREATE INDEX "document_record_idx" ON "document" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "fact_record_test_date_idx" ON "fact" USING btree ("record_id","test_key","fact_date");--> statement-breakpoint
CREATE INDEX "fact_document_idx" ON "fact" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "fact_event_fact_idx" ON "fact_event" USING btree ("fact_id");--> statement-breakpoint
CREATE INDEX "hospital_link_record_idx" ON "hospital_link" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "referral_record_idx" ON "referral" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "share_record_idx" ON "share" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "viewer_session_share_idx" ON "viewer_session" USING btree ("share_id");