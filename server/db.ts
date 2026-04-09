import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  filterPresets,
  InsertFilterPreset,
  InsertNotification,
  InsertQuest,
  InsertQuestProposal,
  InsertSubmission,
  InsertTeamMember,
  InsertUser,
  InsertQuestTeamInvitation,
  notifications,
  Quest,
  questProposals,
  questTeamInvitations,
  quests,
  submissions,
  teamMembers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod", "password"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.role), users.name);
}

export async function countAdmins() {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql`COUNT(*)` })
    .from(users)
    .where(eq(users.role, "admin"));

  return Number(result[0]?.count ?? 0);
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return false;

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
  return true;
}

export async function addXpToUser(
  userId: number,
  xpAmount: number
): Promise<{ newXp: number; newLevel: number; leveledUp: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const newXp = (user.xp ?? 0) + xpAmount;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > (user.level ?? 1);

  await db
    .update(users)
    .set({ xp: newXp, level: newLevel })
    .where(eq(users.id, userId));

  return { newXp, newLevel, leveledUp };
}

export function calculateLevel(xp: number): number {
  // Level thresholds: 1=0, 2=100, 3=250, 4=500, 5=900, 6=1400, 7=2100, 8=3000, 9=4200, 10=6000
  const thresholds = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

export function xpForLevel(level: number): number {
  const thresholds = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
  return thresholds[Math.min(level - 1, thresholds.length - 1)] ?? 0;
}

export function xpForNextLevel(level: number): number {
  const thresholds = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
  return thresholds[Math.min(level, thresholds.length - 1)] ?? 6000;
}

export async function getLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      xp: users.xp,
      level: users.level,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .orderBy(desc(users.xp))
    .limit(limit);
}

export async function updateUser(id: number, updates: Partial<InsertUser>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id));
  return true;
}

export async function getUserByEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(and(
      eq(users.emailVerificationToken, token),
      gt(users.emailVerificationExpires, new Date())
    ))
    .limit(1);

  return result[0] || null;
}

export async function getUserByPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(and(
      eq(users.passwordResetToken, token),
      gt(users.passwordResetExpires, new Date())
    ))
    .limit(1);

  return result[0] || null;
}

// ─── Quests ──────────────────────────────────────────────────────────────────

export async function createQuest(quest: InsertQuest): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(quests).values(quest);
  return (result[0] as { insertId: number }).insertId;
}

export async function getQuests(filters?: {
  difficulty?: Quest["difficulty"];
  status?: Quest["status"];
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  // Auto-expire quests past their expiry time
  await db
    .update(quests)
    .set({ status: "expired" })
    .where(
      and(
        eq(quests.status, "active"),
        lt(quests.expiresAt, new Date())
      )
    );

  const conditions = [];
  if (filters?.difficulty) conditions.push(eq(quests.difficulty, filters.difficulty));
  if (filters?.status) conditions.push(eq(quests.status, filters.status));
  if (filters?.createdBy) conditions.push(eq(quests.createdBy, filters.createdBy));

  const rows = await db
    .select({
      quest: quests,
      creator: {
        id: users.id,
        name: users.name,
        level: users.level,
      },
    })
    .from(quests)
    .leftJoin(users, eq(quests.createdBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(quests.createdAt));

  return rows;
}

export async function getQuestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      quest: quests,
      creator: {
        id: users.id,
        name: users.name,
        level: users.level,
      },
    })
    .from(quests)
    .leftJoin(users, eq(quests.createdBy, users.id))
    .where(eq(quests.id, id))
    .limit(1);
  return rows[0];
}

export async function updateQuestCompletionCount(questId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(quests)
    .set({ completionCount: sql`${quests.completionCount} + 1` })
    .where(eq(quests.id, questId));
}

export async function deleteQuest(questId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quests).where(eq(quests.id, questId));
}

export async function updateQuest(questId: number, data: Partial<InsertQuest>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quests).set(data).where(eq(quests.id, questId));
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export async function createSubmission(sub: InsertSubmission): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(submissions).values(sub);
  return (result[0] as { insertId: number }).insertId;
}

export async function getSubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  return result[0];
}

export async function getSubmissionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      submission: submissions,
      quest: {
        id: quests.id,
        title: quests.title,
        xpReward: quests.xpReward,
        difficulty: quests.difficulty,
      },
    })
    .from(submissions)
    .leftJoin(quests, eq(submissions.questId, quests.id))
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.createdAt));
}

export async function getSubmissionsByQuest(questId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      submission: submissions,
      user: {
        id: users.id,
        name: users.name,
        level: users.level,
      },
    })
    .from(submissions)
    .leftJoin(users, eq(submissions.userId, users.id))
    .where(eq(submissions.questId, questId))
    .orderBy(desc(submissions.createdAt));
}

export async function updateSubmission(
  id: number,
  data: Partial<InsertSubmission>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(submissions).set(data).where(eq(submissions.id, id));
}

export async function hasUserCompletedQuest(userId: number, questId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, userId),
        eq(submissions.questId, questId),
        eq(submissions.status, "approved")
      )
    )
    .limit(1);
  return result.length > 0;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(notif: InsertNotification): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(notif);
}

export async function getNotificationsByUser(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return result[0]?.count ?? 0;
}

// ─── Quest Proposals ─────────────────────────────────────────────────────────

export async function createQuestProposal(proposal: InsertQuestProposal): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(questProposals).values(proposal);
  return (result[0] as { insertId: number }).insertId;
}

export async function getQuestProposalsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(questProposals)
    .where(eq(questProposals.proposedBy, userId))
    .orderBy(desc(questProposals.createdAt));
}

export async function getPendingQuestProposals() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      proposal: questProposals,
      proposer: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(questProposals)
    .innerJoin(users, eq(questProposals.proposedBy, users.id))
    .where(eq(questProposals.status, "pending"))
    .orderBy(desc(questProposals.createdAt));
}

export async function updateQuestProposal(
  id: number,
  updates: Partial<InsertQuestProposal>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(questProposals).set(updates).where(eq(questProposals.id, id));
}


// ─── Proposal Stats ──────────────────────────────────────────────────────────

export async function getProposalStats() {
  const db = await getDb();
  if (!db) return null;

  // Get all proposals grouped by status
  const allProposals = await db.select().from(questProposals);

  const pending = allProposals.filter((p) => p.status === "pending").length;
  const approved = allProposals.filter((p) => p.status === "approved").length;
  const rejected = allProposals.filter((p) => p.status === "rejected").length;
  const total = allProposals.length;

  // Calculate approval rate
  const approvalRate = total > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;
  const rejectionRate = total > 0 ? Math.round((rejected / (approved + rejected)) * 100) : 0;

  // Calculate average review time (in hours)
  const reviewedProposals = allProposals.filter((p) => p.status !== "pending");
  let avgReviewTime = 0;
  if (reviewedProposals.length > 0) {
    const totalReviewTime = reviewedProposals.reduce((sum, p) => {
      if (p.createdAt && p.updatedAt) {
        const reviewHours = (p.updatedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60);
        return sum + reviewHours;
      }
      return sum;
    }, 0);
    avgReviewTime = Math.round(totalReviewTime / reviewedProposals.length);
  }

  // Difficulty distribution
  const difficultyDistribution = {
    easy: allProposals.filter((p) => p.difficulty === "easy").length,
    medium: allProposals.filter((p) => p.difficulty === "medium").length,
    hard: allProposals.filter((p) => p.difficulty === "hard").length,
    legendary: allProposals.filter((p) => p.difficulty === "legendary").length,
  };

  // Average XP reward
  const avgXpReward =
    total > 0
      ? Math.round(allProposals.reduce((sum, p) => sum + (p.xpReward ?? 0), 0) / total)
      : 0;

  return {
    total,
    pending,
    approved,
    rejected,
    approvalRate,
    rejectionRate,
    avgReviewTime,
    avgXpReward,
    difficultyDistribution,
  };
}


// ─── Filter Presets ──────────────────────────────────────────────────────────

export async function saveFilterPreset(
  userId: number,
  name: string,
  difficulties: string[],
  dateFrom: string,
  dateTo: string
) {
  const db = await getDb();
  if (!db) return null;

  const preset: InsertFilterPreset = {
    userId,
    name,
    difficulties: JSON.stringify(difficulties),
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  };

  const result = await db.insert(filterPresets).values(preset);
  return result;
}

export async function getFilterPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const presets = await db
    .select()
    .from(filterPresets)
    .where(eq(filterPresets.userId, userId))
    .orderBy(desc(filterPresets.createdAt));

  return presets.map((p) => ({
    ...p,
    difficulties: p.difficulties ? JSON.parse(p.difficulties) : [],
  }));
}

export async function deleteFilterPreset(presetId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(filterPresets)
    .where(and(eq(filterPresets.id, presetId), eq(filterPresets.userId, userId)));

  return true;
}


// ─── Team Members ────────────────────────────────────────────────────────────

export async function searchUsers(query: string, excludeUserId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      level: users.level,
      xp: users.xp,
    })
    .from(users)
    .where(
      and(
        or(
          sql`${users.name} LIKE ${`%${query}%`}`,
          sql`${users.email} LIKE ${`%${query}%`}`
        ),
        sql`${users.id} != ${excludeUserId}`
      )
    )
    .limit(limit);

  return results;
}

export async function createTeamInvitation(
  questProposalId: number,
  invitedUserId: number,
  invitedBy: number
) {
  const db = await getDb();
  if (!db) return null;

  const invitation: InsertQuestTeamInvitation = {
    questProposalId,
    invitedUserId,
    invitedBy,
    status: "pending",
  };

  await db.insert(questTeamInvitations).values(invitation);
  
  // Get the created invitation
  const created = await db
    .select()
    .from(questTeamInvitations)
    .where(
      and(
        eq(questTeamInvitations.questProposalId, questProposalId),
        eq(questTeamInvitations.invitedUserId, invitedUserId)
      )
    )
    .orderBy(desc(questTeamInvitations.createdAt))
    .limit(1);

  return created[0]?.id ?? null;
}

export async function getTeamInvitationsByQuestProposal(questProposalId: number) {
  const db = await getDb();
  if (!db) return [];

  const invitations = await db
    .select({
      id: questTeamInvitations.id,
      questProposalId: questTeamInvitations.questProposalId,
      invitedUserId: questTeamInvitations.invitedUserId,
      invitedBy: questTeamInvitations.invitedBy,
      status: questTeamInvitations.status,
      createdAt: questTeamInvitations.createdAt,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        level: users.level,
      },
    })
    .from(questTeamInvitations)
    .innerJoin(users, eq(questTeamInvitations.invitedUserId, users.id))
    .where(eq(questTeamInvitations.questProposalId, questProposalId));

  return invitations;
}

export async function getTeamInvitationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const invitations = await db
    .select({
      id: questTeamInvitations.id,
      questProposalId: questTeamInvitations.questProposalId,
      invitedUserId: questTeamInvitations.invitedUserId,
      invitedBy: questTeamInvitations.invitedBy,
      status: questTeamInvitations.status,
      createdAt: questTeamInvitations.createdAt,
      questProposal: {
        id: questProposals.id,
        title: questProposals.title,
        description: questProposals.description,
        xpReward: questProposals.xpReward,
        difficulty: questProposals.difficulty,
      },
      invitedByUser: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(questTeamInvitations)
    .innerJoin(questProposals, eq(questTeamInvitations.questProposalId, questProposals.id))
    .innerJoin(users, eq(questTeamInvitations.invitedBy, users.id))
    .where(eq(questTeamInvitations.invitedUserId, userId))
    .orderBy(desc(questTeamInvitations.createdAt));

  return invitations;
}

export async function updateTeamInvitationStatus(
  invitationId: number,
  status: "pending" | "accepted" | "declined"
) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(questTeamInvitations)
    .set({ status, updatedAt: new Date() })
    .where(eq(questTeamInvitations.id, invitationId));

  return true;
}

export async function getQuestTeamMembers(questId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all accepted team members for a quest
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      level: users.level,
      xp: users.xp,
    })
    .from(questTeamInvitations)
    .innerJoin(users, eq(questTeamInvitations.invitedUserId, users.id))
    .where(
      and(
        eq(questTeamInvitations.status, "accepted"),
        sql`${questTeamInvitations.questProposalId} IN (SELECT id FROM ${questProposals} WHERE id = ${questId})`
      )
    );

  return members;
}
