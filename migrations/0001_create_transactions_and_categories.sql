CREATE TABLE `categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "categories_kind_check" CHECK("categories"."kind" IN ('expense', 'income'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_id_id_unique` ON `categories` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_id_name_unique` ON `categories` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` integer,
	`memo` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`category_id`) REFERENCES `categories`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_kind_check" CHECK("transactions"."kind" IN ('expense', 'income')),
	CONSTRAINT "transactions_amount_check" CHECK("transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `transactions_user_occurred_at` ON `transactions` (`user_id`,`occurred_at`);