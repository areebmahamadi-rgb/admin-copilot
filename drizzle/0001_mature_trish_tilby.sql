CREATE TABLE `draft_edits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` varchar(32) NOT NULL,
	`sender` varchar(320),
	`originalDraft` text NOT NULL,
	`editedDraft` text NOT NULL,
	`itemTitle` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `draft_edits_id` PRIMARY KEY(`id`)
);
