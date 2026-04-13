CREATE TABLE `unlockables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` enum('badge','cosmetic','title','boost') NOT NULL,
	`criteria` text NOT NULL,
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `unlockables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userUnlockables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`unlockableId` int NOT NULL,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	`metadata` text,
	CONSTRAINT `userUnlockables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('xp_gained','level_up','quest_completed','submission_verified','submission_rejected','milestone','unlockable_earned') NOT NULL;