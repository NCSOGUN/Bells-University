-- BACKSTOP ONLY (NFR-01, design section 9). Row level security is enabled on every table with NO
-- policies, which denies the anon and authenticated roles everything: browser code can never read or
-- write the database directly, even with the public (anon/publishable) key. The server connects as a
-- role that bypasses RLS. Permissions are decided in lib/policy.ts, never here.
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "patient_record" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "record_member" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fact" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fact_event" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "share" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "viewer_session" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "access_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "code_attempt" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "facility" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "referral" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "referral_ack" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hospital" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hospital_credential" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hospital_link" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "feed_receipt" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "glossary" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "drug_allergy_rule" ENABLE ROW LEVEL SECURITY;
