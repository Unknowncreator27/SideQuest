ALTER TABLE `quests` ADD `requirementType` enum('individual','team') DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `quests` ADD `requiredMediaCount` int DEFAULT 1 NOT NULL;