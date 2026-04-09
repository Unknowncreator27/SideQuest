import {
  bigint,
  boolean,
  float,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 255 }), // Add password field for email auth
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  xp: int("xp").default(0).notNull(),
  level: int("level").default(1).notNull(),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const quests = mysqlTable("quests", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  xpReward: int("xpReward").notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard", "legendary"]).notNull(),
  status: mysqlEnum("status", ["active", "expired", "archived"]).default("active").notNull(),
  requirementType: mysqlEnum("requirementType", ["individual", "team"]).default("individual").notNull(),
  requiredMediaCount: int("requiredMediaCount").default(1).notNull(),
  createdBy: int("createdBy").notNull(),
  expiresAt: timestamp("expiresAt"),
  imageUrl: text("imageUrl"),
  completionCount: int("completionCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = typeof quests.$inferInsert;

export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  questId: int("questId").notNull(),
  userId: int("userId").notNull(),
  mediaUrl: text("mediaUrl").notNull(),
  mediaType: mysqlEnum("mediaType", ["image", "video"]).notNull(),
  mediaKey: text("mediaKey").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  aiVerified: boolean("aiVerified").default(false).notNull(),
  aiConfidence: float("aiConfidence"),
  aiReason: text("aiReason"),
  xpAwarded: int("xpAwarded").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["xp_gained", "level_up", "quest_completed", "submission_verified", "submission_rejected", "milestone"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const questProposals = mysqlTable("questProposals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  xpReward: int("xpReward").notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard", "legendary"]).notNull(),
  proposedBy: int("proposedBy").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestProposal = typeof questProposals.$inferSelect;
export type InsertQuestProposal = typeof questProposals.$inferInsert;


export const filterPresets = mysqlTable("filterPresets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  difficulties: text("difficulties"), // JSON array of difficulty levels
  dateFrom: varchar("dateFrom", { length: 10 }), // YYYY-MM-DD format
  dateTo: varchar("dateTo", { length: 10 }), // YYYY-MM-DD format
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FilterPreset = typeof filterPresets.$inferSelect;
export type InsertFilterPreset = typeof filterPresets.$inferInsert;


export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  friendId: int("friendId").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "blocked"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

export const questTeamInvitations = mysqlTable("questTeamInvitations", {
  id: int("id").autoincrement().primaryKey(),
  questProposalId: int("questProposalId").notNull(),
  invitedUserId: int("invitedUserId").notNull(),
  invitedBy: int("invitedBy").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "declined"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestTeamInvitation = typeof questTeamInvitations.$inferSelect;
export type InsertQuestTeamInvitation = typeof questTeamInvitations.$inferInsert;
