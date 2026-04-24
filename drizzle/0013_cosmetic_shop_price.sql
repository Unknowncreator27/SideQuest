ALTER TABLE `unlockables`
ADD COLUMN `priceXp` int NOT NULL DEFAULT 0;

ALTER TABLE `users`
ADD COLUMN `selectedBadgeId` int NULL;
