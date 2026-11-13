CREATE TABLE "drug_allergy_alias" (
	"rule_id" uuid NOT NULL,
	"role" text NOT NULL,
	"alias" text NOT NULL,
	CONSTRAINT "drug_allergy_alias_rule_id_role_alias_pk" PRIMARY KEY("rule_id","role","alias"),
	CONSTRAINT "drug_allergy_alias_role_chk" CHECK ("drug_allergy_alias"."role" in ('allergy', 'medicine'))
);
--> statement-breakpoint
CREATE TABLE "glossary_alias" (
	"test_key" text NOT NULL,
	"alias" text NOT NULL,
	"alias_key" text NOT NULL,
	CONSTRAINT "glossary_alias_test_key_alias_pk" PRIMARY KEY("test_key","alias")
);
--> statement-breakpoint
CREATE TABLE "glossary_question" (
	"test_key" text NOT NULL,
	"position" integer NOT NULL,
	"question" text NOT NULL,
	CONSTRAINT "glossary_question_test_key_position_pk" PRIMARY KEY("test_key","position")
);
--> statement-breakpoint
CREATE TABLE "share_hidden_category" (
	"share_id" uuid NOT NULL,
	"category" text NOT NULL,
	CONSTRAINT "share_hidden_category_share_id_category_pk" PRIMARY KEY("share_id","category"),
	CONSTRAINT "share_hidden_category_chk" CHECK ("share_hidden_category"."category" in ('sexual_reproductive', 'mental_health', 'infectious_disease', 'substance_use', 'other_sensitive'))
);
--> statement-breakpoint
CREATE TABLE "share_hidden_document" (
	"share_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	CONSTRAINT "share_hidden_document_share_id_document_id_pk" PRIMARY KEY("share_id","document_id")
);
--> statement-breakpoint
ALTER TABLE "drug_allergy_alias" ADD CONSTRAINT "drug_allergy_alias_rule_id_drug_allergy_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."drug_allergy_rule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary_alias" ADD CONSTRAINT "glossary_alias_test_key_glossary_test_key_fk" FOREIGN KEY ("test_key") REFERENCES "public"."glossary"("test_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary_question" ADD CONSTRAINT "glossary_question_test_key_glossary_test_key_fk" FOREIGN KEY ("test_key") REFERENCES "public"."glossary"("test_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_hidden_category" ADD CONSTRAINT "share_hidden_category_share_id_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_hidden_document" ADD CONSTRAINT "share_hidden_document_share_id_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_hidden_document" ADD CONSTRAINT "share_hidden_document_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "glossary_alias_key_idx" ON "glossary_alias" USING btree ("alias_key");--> statement-breakpoint
ALTER TABLE "drug_allergy_rule" DROP COLUMN "allergy_aliases";--> statement-breakpoint
ALTER TABLE "drug_allergy_rule" DROP COLUMN "medicine_aliases";--> statement-breakpoint
ALTER TABLE "glossary" DROP COLUMN "aliases";--> statement-breakpoint
ALTER TABLE "glossary" DROP COLUMN "questions";--> statement-breakpoint
ALTER TABLE "share" DROP COLUMN "hidden_categories";--> statement-breakpoint
ALTER TABLE "share" DROP COLUMN "hidden_document_ids";