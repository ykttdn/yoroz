DROP INDEX `categories_user_id_name_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_id_kind_name_unique` ON `categories` (`user_id`,`kind`,`name`);