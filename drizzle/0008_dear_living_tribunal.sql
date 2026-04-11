ALTER TABLE `questProposals` ADD `requirementType` enum('individual','team') DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `questProposals` ADD `requiredMediaCount` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `questProposals` ADD `expiresAt` timestamp;