CREATE INDEX "feed_receipt_link_idx" ON "feed_receipt" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "referral_ack_referral_idx" ON "referral_ack" USING btree ("referral_id");