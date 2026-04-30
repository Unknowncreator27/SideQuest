import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  filterPresets,
  InsertFilterPreset,
  InsertNotification,
  InsertQuest,
  InsertQuestProposal,
  InsertSubmission,
  InsertTeamMember,
  InsertUnlockable,
  InsertUser,
  InsertQuestTeamInvitation,
  InsertUserUnlockable,
  InsertDailyChallenge,
  InsertUserDailyChallenge,
  notifications,
  Quest,
  questProposals,
  questTeamInvitations,
  quests,
  submissions,
  teamMembers,
  unlockables,
  userUnlockables,
  dailyChallenges,
  userDailyChallenges,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getNetworkMetrics } from "./_core/metrics";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const connection = await mysql.createConnection({
        uri: process.env.DATABASE_URL,
        ssl: true, // Enable SSL for Aiven
      });
      _db = drizzle(connection);
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

export async function getAdminMetrics() {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      totalAdmins: 0,
      activeUsersLast30Days: 0,
      totalQuests: 0,
      totalApprovedSubmissions: 0,
      totalPendingReviews: 0,
      totalPendingProposals: 0,
      completionsLast7Days: 0,
      averageApprovedSubmissionsPerUser: 0,
      dailyActiveUsers: [] as Array<{ date: string; count: number }>,
      dailySignups: [] as Array<{ date: string; count: number }>,
      topQuestCompletions: [] as Array<{ questId: number; title: string; completedCount: number }>,
      avgReviewTurnaroundHours: 0,
      topCompleters: [] as Array<{ userId: number; name: string; completedCount: number }>,
      completionsByDifficulty: { easy: 0, medium: 0, hard: 0, legendary: 0 },
      network: {
        totalRequests: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
        totalTrafficBytes: 0,
        uniqueVisitors: 0,
        topPaths: [],
        requestsByMethod: {},
        requestsByStatus: {},
        requestErrorRate: 0,
        averageRequestSize: 0,
        averageResponseSize: 0,
      },
    };
  }

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const dateKeys = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
    return day.toISOString().slice(0, 10);
  });
  const activeUsersByDay = new Map(dateKeys.map((date) => [date, 0]));
  const signupsByDay = new Map(dateKeys.map((date) => [date, 0]));

  const [totalUsersResult, totalAdminsResult, activeUsersResult, totalQuestsResult, totalApprovedResult, totalPendingReviewsResult, totalPendingProposalsResult, completionsLast7DaysResult, uniqueSubmittersResult, activeUsersRows, signupsRows, topQuestRows, reviewTimeRows] =
    await Promise.all([
      db.select({ count: sql`COUNT(*)` }).from(users).limit(1),
      db.select({ count: sql`COUNT(*)` }).from(users).where(eq(users.role, "admin")).limit(1),
      db.select({ count: sql`COUNT(*)` })
        .from(users)
        .where(gt(users.lastSignedIn, monthAgo))
        .limit(1),
      db.select({ count: sql`COUNT(*)` }).from(quests).limit(1),
      db.select({ count: sql`COUNT(*)` }).from(submissions).where(eq(submissions.status, "approved")).limit(1),
      db.select({ count: sql`COUNT(*)` }).from(submissions).where(eq(submissions.status, "pending")).limit(1),
      db.select({ count: sql`COUNT(*)` }).from(questProposals).where(eq(questProposals.status, "pending")).limit(1),
      db.select({ count: sql`COUNT(*)` })
        .from(submissions)
        .where(and(eq(submissions.status, "approved"), gt(submissions.createdAt, weekAgo)))
        .limit(1),
      db.select({ count: sql`COUNT(DISTINCT ${submissions.userId})` })
        .from(submissions)
        .where(eq(submissions.status, "approved"))
        .limit(1),
      db
        .select({ date: sql`DATE(${users.lastSignedIn})`, count: sql`COUNT(*)` })
        .from(users)
        .where(gt(users.lastSignedIn, weekAgo))
        .groupBy(sql`DATE(${users.lastSignedIn})`)
        .orderBy(sql`DATE(${users.lastSignedIn})`),
      db
        .select({ date: sql`DATE(${users.createdAt})`, count: sql`COUNT(*)` })
        .from(users)
        .where(gt(users.createdAt, weekAgo))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`),
      db
        .select({ questId: submissions.questId, title: quests.title, completedCount: sql`COUNT(*)` })
        .from(submissions)
        .leftJoin(quests, eq(submissions.questId, quests.id))
        .where(eq(submissions.status, "approved"))
        .groupBy(submissions.questId)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(5),
      db
        .select({ avgSeconds: sql`AVG(TIMESTAMPDIFF(SECOND, ${submissions.createdAt}, ${submissions.updatedAt}))` })
        .from(submissions)
        .where(and(eq(submissions.status, "approved"), gt(submissions.updatedAt, weekAgo))),
    ]);

  for (const row of activeUsersRows) {
    const date = String((row as any).date ?? "");
    if (date && activeUsersByDay.has(date)) {
      activeUsersByDay.set(date, Number((row as any).count ?? 0));
    }
  }
  for (const row of signupsRows) {
    const date = String((row as any).date ?? "");
    if (date && signupsByDay.has(date)) {
      signupsByDay.set(date, Number((row as any).count ?? 0));
    }
  }

  const completionRows = await db
    .select({ difficulty: quests.difficulty, count: sql`COUNT(*)` })
    .from(submissions)
    .leftJoin(quests, eq(submissions.questId, quests.id))
    .where(eq(submissions.status, "approved"))
    .groupBy(quests.difficulty);

  const topCompletersRows = await db
    .select({ userId: submissions.userId, name: users.name, completedCount: sql`COUNT(*)` })
    .from(submissions)
    .leftJoin(users, eq(submissions.userId, users.id))
    .where(eq(submissions.status, "approved"))
    .groupBy(submissions.userId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5);

  const completionsByDifficulty = {
    easy: 0,
    medium: 0,
    hard: 0,
    legendary: 0,
  };
  for (const row of completionRows) {
    const diff = row.difficulty;
    if (diff && diff in completionsByDifficulty) {
      completionsByDifficulty[diff as keyof typeof completionsByDifficulty] = Number((row as any).count ?? 0);
    }
  }

  const totalUsers = Number(totalUsersResult[0]?.count ?? 0);
  const totalApprovedSubmissions = Number(totalApprovedResult[0]?.count ?? 0);
  const totalApprovedUsers = Number(uniqueSubmittersResult[0]?.count ?? 0) || 1;
  const avgReviewSeconds = Number(reviewTimeRows[0]?.avgSeconds ?? 0);

  return {
    totalUsers,
    totalAdmins: Number(totalAdminsResult[0]?.count ?? 0),
    activeUsersLast30Days: Number(activeUsersResult[0]?.count ?? 0),
    totalQuests: Number(totalQuestsResult[0]?.count ?? 0),
    totalApprovedSubmissions: Number(totalApprovedResult[0]?.count ?? 0),
    totalPendingReviews: Number(totalPendingReviewsResult[0]?.count ?? 0),
    totalPendingProposals: Number(totalPendingProposalsResult[0]?.count ?? 0),
    completionsLast7Days: Number(completionsLast7DaysResult[0]?.count ?? 0),
    averageApprovedSubmissionsPerUser: totalUsers > 0 ? Number((totalApprovedSubmissions / totalUsers).toFixed(2)) : 0,
    dailyActiveUsers: dateKeys.map((date) => ({ date, count: activeUsersByDay.get(date) ?? 0 })),
    dailySignups: dateKeys.map((date) => ({ date, count: signupsByDay.get(date) ?? 0 })),
    topQuestCompletions: topQuestRows.map((row) => ({
      questId: Number((row as any).questId ?? 0),
      title: row.title ?? "Untitled",
      completedCount: Number((row as any).completedCount ?? 0),
    })),
    avgReviewTurnaroundHours: Number((avgReviewSeconds / 3600).toFixed(2)),
    topCompleters: topCompletersRows.map((row) => ({
      userId: row.userId,
      name: row.name ?? `User ${row.userId}`,
      completedCount: Number((row as any).completedCount ?? 0),
    })),
    completionsByDifficulty,
    network: getNetworkMetrics(),
  };
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

// ─── Create Unlockables ─────────────────────────────────────────────────────────────
export async function createUnlockables(unlockable: InsertUnlockable) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const result = await db.insert(unlockables).values(unlockable);
  return (result[0] as { insertId: number }).insertId;
}

export async function getPendingSubmissions() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      submission: submissions,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
      quest: {
        id: quests.id,
        title: quests.title,
        xpReward: quests.xpReward,
        difficulty: quests.difficulty,
      },
    })
    .from(submissions)
    .leftJoin(users, eq(submissions.userId, users.id))
    .leftJoin(quests, eq(submissions.questId, quests.id))
    .where(eq(submissions.status, "pending"))
    .orderBy(desc(submissions.createdAt));
}

export async function getUnlockables() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: unlockables.id,
      title: unlockables.title,
      description: unlockables.description,
      category: unlockables.category,
      criteria: unlockables.criteria,
      priceXp: unlockables.priceXp,
      imageUrl: unlockables.imageUrl,
      isActive: unlockables.isActive,
      createdAt: unlockables.createdAt,
      updatedAt: unlockables.updatedAt,
    })
    .from(unlockables)
    .where(eq(unlockables.isActive, true))
    .orderBy(desc(unlockables.createdAt));
}

export async function getUnlockableById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      id: unlockables.id,
      title: unlockables.title,
      description: unlockables.description,
      category: unlockables.category,
      criteria: unlockables.criteria,
      priceXp: unlockables.priceXp,
      imageUrl: unlockables.imageUrl,
      isActive: unlockables.isActive,
      createdAt: unlockables.createdAt,
      updatedAt: unlockables.updatedAt,
    })
    .from(unlockables)
    .where(eq(unlockables.id, id))
    .limit(1);

  return rows[0] || null;
}

export async function getShopItems() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: unlockables.id,
      title: unlockables.title,
      description: unlockables.description,
      category: unlockables.category,
      criteria: unlockables.criteria,
      priceXp: unlockables.priceXp,
      imageUrl: unlockables.imageUrl,
      isActive: unlockables.isActive,
      createdAt: unlockables.createdAt,
      updatedAt: unlockables.updatedAt,
    })
    .from(unlockables)
    .where(and(eq(unlockables.isActive, true), gt(unlockables.priceXp, 0)))
    .orderBy(desc(unlockables.createdAt));
}

export async function getUserShopItems(userId: number) {
  const allItems = await getUserUnlockables(userId);
  return allItems.filter((item) => item.unlockable.priceXp > 0);
}

export async function purchaseShopItem(userId: number, unlockableId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const unlockable = await getUnlockableById(unlockableId);
  if (!unlockable) {
    return { success: false, message: "Shop item not found." };
  }

  if (!unlockable.isActive) {
    return { success: false, message: "This item is not available in the shop." };
  }

  if (unlockable.priceXp <= 0) {
    return { success: false, message: "This item is not available in the shop." };
  }

  const existing = await getUserUnlockable(userId, unlockableId);
  if (existing) {
    return { success: false, message: "You already own this item." };
  }

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  if ((user.xp ?? 0) < unlockable.priceXp) {
    return { success: false, message: "Not enough XP to purchase this item." };
  }

  const xpResult = await addXpToUser(userId, -unlockable.priceXp);
  const unlock = await grantUnlockable(userId, unlockableId, JSON.stringify({ purchasedForXp: unlockable.priceXp }));
  if (!unlock) {
    return { success: false, message: "Failed to grant shop item." };
  }

  await createNotification({
    userId,
    type: "unlockable_earned",
    title: `Purchased ${unlockable.title}`,
    message: `You spent ${unlockable.priceXp} XP to unlock ${unlockable.title}.`,
    metadata: JSON.stringify({ unlockableId, priceXp: unlockable.priceXp }),
  });

  return {
    success: true,
    xpSpent: unlockable.priceXp,
    newXp: xpResult.newXp,
    unlockable,
  };
}

export async function getUserUnlockables(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: userUnlockables.id,
      userId: userUnlockables.userId,
      unlockableId: userUnlockables.unlockableId,
      earnedAt: userUnlockables.earnedAt,
      metadata: userUnlockables.metadata,
      unlockable: {
        id: unlockables.id,
        title: unlockables.title,
        description: unlockables.description,
        category: unlockables.category,
        criteria: unlockables.criteria,
        priceXp: unlockables.priceXp,
        imageUrl: unlockables.imageUrl,
      },
    })
    .from(userUnlockables)
    .innerJoin(unlockables, eq(userUnlockables.unlockableId, unlockables.id))
    .where(eq(userUnlockables.userId, userId))
    .orderBy(desc(userUnlockables.earnedAt));
}

export async function awardLevelUnlockablesForUser(
  userId: number,
  newLevel: number,
  metadata?: Record<string, unknown>
) {
  const unlockablesList = await getUnlockables();
  const awarded: Array<{ id: number; title: string; description: string }> = [];

  for (const unlockable of unlockablesList) {
    const existing = await getUserUnlockable(userId, unlockable.id);
    if (existing) continue;

    let qualifies = false;
    if (unlockable.criteria === "reach_level_5") {
      qualifies = newLevel >= 5;
    } else if (unlockable.criteria === "reach_level_10") {
      qualifies = newLevel >= 10;
    }

    if (!qualifies) continue;

    const unlock = await grantUnlockable(
      userId,
      unlockable.id,
      metadata ? JSON.stringify(metadata) : undefined
    );
    if (!unlock) continue;

    awarded.push({
      id: unlockable.id,
      title: unlockable.title,
      description: unlockable.description,
    });

    await createNotification({
      userId,
      type: "unlockable_earned",
      title: `Unlockable earned: ${unlockable.title}`,
      message: unlockable.description,
      metadata: JSON.stringify({ unlockableId: unlockable.id, ...metadata }),
    });
  }

  return awarded;
}

function getDateString(date?: Date | string | null) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

export function getStreakState(lastCompletedAt: Date | string | null, now: Date = new Date()) {
  const today = getDateString(now);
  const yesterday = getDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const lastDate = getDateString(lastCompletedAt);
  return {
    lastDate,
    isToday: lastDate === today,
    isYesterday: lastDate === yesterday,
    shouldReset: lastDate !== today && lastDate !== yesterday,
  };
}

export async function getDailyChallenges() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: dailyChallenges.id,
      title: dailyChallenges.title,
      description: dailyChallenges.description,
      challengeType: dailyChallenges.challengeType,
      target: dailyChallenges.target,
      rewardXp: dailyChallenges.rewardXp,
      active: dailyChallenges.active,
      createdAt: dailyChallenges.createdAt,
      updatedAt: dailyChallenges.updatedAt,
    })
    .from(dailyChallenges)
    .where(eq(dailyChallenges.active, true))
    .orderBy(desc(dailyChallenges.createdAt));
}

export async function getUserDailyChallenges(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const today = getDateString(new Date());

  const rows = await db
    .select({
      challenge: dailyChallenges,
      status: {
        id: userDailyChallenges.id,
        progress: userDailyChallenges.progress,
        streakCount: userDailyChallenges.streakCount,
        lastCompletedAt: userDailyChallenges.lastCompletedAt,
        completedAt: userDailyChallenges.completedAt,
      },
    })
    .from(dailyChallenges)
    .leftJoin(
      userDailyChallenges,
      and(
        eq(userDailyChallenges.challengeId, dailyChallenges.id),
        eq(userDailyChallenges.userId, userId)
      )
    )
    .where(eq(dailyChallenges.active, true));

  return rows.map((row) => {
    const status = row.status ?? {
      id: null,
      progress: 0,
      streakCount: 0,
      lastCompletedAt: null,
      completedAt: null,
    };
    const streakState = getStreakState(status.lastCompletedAt);
    return {
      challenge: row.challenge,
      progress: status.progress ?? 0,
      streakCount: streakState.isToday || streakState.isYesterday ? status.streakCount ?? 0 : 0,
      lastCompletedAt: status.lastCompletedAt ?? null,
      completedAt: status.completedAt ?? null,
      completedToday: streakState.isToday,
      streakExpired: status.streakCount > 0 && streakState.shouldReset,
    };
  });
}

export async function getUserDailyChallenge(userId: number, challengeId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(userDailyChallenges)
    .where(
      and(
        eq(userDailyChallenges.userId, userId),
        eq(userDailyChallenges.challengeId, challengeId)
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function getDailyChallengeById(challengeId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(dailyChallenges)
    .where(eq(dailyChallenges.id, challengeId))
    .limit(1);

  return rows[0] || null;
}

export async function completeDailyChallenge(userId: number, challengeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const challenge = await getDailyChallengeById(challengeId);
  if (!challenge) throw new Error("Daily challenge not found");
  if (!challenge.active) throw new Error("Daily challenge is not active");

  const now = new Date();
  const today = getDateString(now);
  const yesterday = getDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const existing = await getUserDailyChallenge(userId, challengeId);
  const streakState = getStreakState(existing?.lastCompletedAt ?? null, now);
  const alreadyCompleted = streakState.isToday;
  if (alreadyCompleted) {
    return {
      success: false,
      alreadyCompleted: true,
      streakCount: existing?.streakCount ?? 0,
      totalXp: 0,
    };
  }

  const previousStreak = streakState.isYesterday ? existing?.streakCount ?? 0 : 0;
  const streakCount = previousStreak + 1;
  const streakBonus = streakCount > 1 ? Math.min(10 * streakCount, 50) : 0;
  const totalXp = challenge.rewardXp + streakBonus;

  if (existing) {
    await db
      .update(userDailyChallenges)
      .set({
        progress: challenge.target,
        streakCount,
        lastCompletedAt: now,
        completedAt: now,
        updatedAt: new Date(),
      })
      .where(eq(userDailyChallenges.id, existing.id));
  } else {
    await db.insert(userDailyChallenges).values({
      userId,
      challengeId,
      progress: challenge.target,
      streakCount,
      lastCompletedAt: now,
      completedAt: now,
    });
  }

  const xpResult = await addXpToUser(userId, totalXp);
  const levelUnlockables = await awardLevelUnlockablesForUser(userId, xpResult.newLevel, { challengeId });
  const streakUnlockables = await awardDailyStreakUnlockablesForUser(userId, streakCount);
  const newUnlockables = [...levelUnlockables, ...streakUnlockables];

  await createNotification({
    userId,
    type: "xp_gained",
    title: `Daily challenge completed! +${totalXp} XP`,
    message: `${challenge.title} complete. Streak: ${streakCount} day${streakCount !== 1 ? "s" : ""}.`,
    metadata: JSON.stringify({ challengeId, streakCount, streakBonus }),
  });

  if (existing?.streakCount && streakState.shouldReset) {
    await createNotification({
      userId,
      type: "milestone",
      title: `Streak reset`,
      message: `Your previous ${existing.streakCount}-day streak ended after missing a day. You're back to day 1.`,
      metadata: JSON.stringify({ previousStreak: existing.streakCount, challengeId }),
    });
  }

  if (streakCount > 1) {
    await createNotification({
      userId,
      type: "level_up",
      title: `Streak bonus! ${streakBonus} XP`,
      message: `Your ${streakCount}-day streak is active. Keep it going!`,
      metadata: JSON.stringify({ streakCount, streakBonus }),
    });
  }

  return {
    success: true,
    alreadyCompleted: false,
    streakCount,
    totalXp,
    streakBonus,
    newUnlockables,
  };
}

// export async function createUnlockables(unlockable: InsertUnlockable) {
//   const db = await getDb();
//   if (!db) throw new Error("DB unavailable");

//   const result = await db.insert(unlockables).values(unlockable);
//   return (result[0] as { insertId: number }).insertId;
// }

export async function grantUnlockable(
  userId: number,
  unlockableId: number,
  metadata?: string
) {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(userUnlockables)
    .where(
      and(
        eq(userUnlockables.userId, userId),
        eq(userUnlockables.unlockableId, unlockableId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db.insert(userUnlockables).values({
    userId,
    unlockableId,
    metadata: metadata || undefined,
  });

  const insertId = (result[0] as { insertId: number }).insertId;
  const rows = await db
    .select({
      id: userUnlockables.id,
      userId: userUnlockables.userId,
      unlockableId: userUnlockables.unlockableId,
      earnedAt: userUnlockables.earnedAt,
      metadata: userUnlockables.metadata,
    })
    .from(userUnlockables)
    .where(eq(userUnlockables.id, insertId))
    .limit(1);

  return rows[0] || null;
}

export async function purchaseCosmeticUnlockable(userId: number, unlockableId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const unlockable = await getUnlockableById(unlockableId);
  if (!unlockable) {
    throw new Error("Unlockable not found");
  }

  if (unlockable.category !== "cosmetic" || unlockable.priceXp <= 0) {
    throw new Error("This item is not available in the cosmetic shop.");
  }

  const existing = await getUserUnlockable(userId, unlockableId);
  if (existing) {
    return { success: false, message: "You already own this cosmetic." };
  }

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  if ((user.xp ?? 0) < unlockable.priceXp) {
    return { success: false, message: "Not enough XP to purchase this cosmetic." };
  }

  const xpResult = await addXpToUser(userId, -unlockable.priceXp);
  const unlock = await grantUnlockable(userId, unlockableId, JSON.stringify({ purchasedForXp: unlockable.priceXp }));
  if (!unlock) {
    return { success: false, message: "Failed to grant cosmetic." };
  }

  await createNotification({
    userId,
    type: "unlockable_earned",
    title: `Purchased ${unlockable.title}`,
    message: `You spent ${unlockable.priceXp} XP to unlock ${unlockable.title}.`,
    metadata: JSON.stringify({ unlockableId, priceXp: unlockable.priceXp }),
  });

  return {
    success: true,
    xpSpent: unlockable.priceXp,
    newXp: xpResult.newXp,
    unlockable,
  };
}

export async function getUserUnlockable(userId: number, unlockableId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      id: userUnlockables.id,
      userId: userUnlockables.userId,
      unlockableId: userUnlockables.unlockableId,
      earnedAt: userUnlockables.earnedAt,
      metadata: userUnlockables.metadata,
      unlockable: {
        id: unlockables.id,
        title: unlockables.title,
        description: unlockables.description,
        category: unlockables.category,
        criteria: unlockables.criteria,
        priceXp: unlockables.priceXp,
        imageUrl: unlockables.imageUrl,
      },
    })
    .from(userUnlockables)
    .innerJoin(unlockables, eq(userUnlockables.unlockableId, unlockables.id))
    .where(
      and(
        eq(userUnlockables.userId, userId),
        eq(userUnlockables.unlockableId, unlockableId)
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function getUserCompletedQuestCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql`COUNT(*)` })
    .from(submissions)
    .where(
      and(
        eq(submissions.status, "approved"),
        or(
          eq(submissions.userId, userId),
          sql`JSON_CONTAINS(${submissions.teamMemberIds}, JSON_QUOTE(${userId}))`
        )
      )
    )
    .limit(1);

  return Number(result[0]?.count ?? 0);
}

export async function getUserCompletedQuestDifficultyCounts(userId: number) {
  const db = await getDb();
  if (!db) return { easy: 0, medium: 0, hard: 0, legendary: 0 };

  const rows = await db
    .select({ difficulty: quests.difficulty, count: sql`COUNT(*)` })
    .from(submissions)
    .leftJoin(quests, eq(submissions.questId, quests.id))
    .where(
      and(
        eq(submissions.status, "approved"),
        or(
          eq(submissions.userId, userId),
          sql`JSON_CONTAINS(${submissions.teamMemberIds}, JSON_QUOTE(${userId}))`
        )
      )
    )
    .groupBy(quests.difficulty);

  const counts = { easy: 0, medium: 0, hard: 0, legendary: 0 };
  for (const row of rows) {
    const difficulty = row.difficulty;
    if (difficulty && difficulty in counts) {
      counts[difficulty as keyof typeof counts] = Number((row as any).count ?? 0);
    }
  }
  return counts;
}

export async function getUserCompletedQuestDifficultySet(userId: number) {
  const db = await getDb();
  if (!db) return new Set<string>();

  const rows = await db
    .select({ difficulty: quests.difficulty })
    .from(submissions)
    .leftJoin(quests, eq(submissions.questId, quests.id))
    .where(
      and(
        eq(submissions.status, "approved"),
        or(
          eq(submissions.userId, userId),
          sql`JSON_CONTAINS(${submissions.teamMemberIds}, JSON_QUOTE(${userId}))`
        )
      )
    )
    .groupBy(quests.difficulty);

  return new Set(rows.map((row) => row.difficulty));
}

export async function awardDailyStreakUnlockablesForUser(userId: number, streakCount: number) {
  const unlockablesList = await getUnlockables();
  const awarded: Array<{ id: number; title: string; description: string }> = [];

  for (const unlockable of unlockablesList) {
    const existing = await getUserUnlockable(userId, unlockable.id);
    if (existing) continue;

    let qualifies = false;
    if (unlockable.criteria === "daily_streak_3") {
      qualifies = streakCount >= 3;
    } else if (unlockable.criteria === "daily_streak_7") {
      qualifies = streakCount >= 7;
    }

    if (!qualifies) continue;

    const unlock = await grantUnlockable(userId, unlockable.id, JSON.stringify({ streakCount }));
    if (!unlock) continue;

    awarded.push({
      id: unlockable.id,
      title: unlockable.title,
      description: unlockable.description,
    });

    await createNotification({
      userId,
      type: "unlockable_earned",
      title: `Unlockable earned: ${unlockable.title}`,
      message: unlockable.description,
      metadata: JSON.stringify({ unlockableId: unlockable.id, streakCount }),
    });
  }

  return awarded;
}

export async function getUserCompletedLegendaryQuestCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql`COUNT(*)` })
    .from(submissions)
    .leftJoin(quests, eq(submissions.questId, quests.id))
    .where(
      and(
        eq(submissions.status, "approved"),
        eq(quests.difficulty, "legendary"),
        or(
          eq(submissions.userId, userId),
          sql`JSON_CONTAINS(${submissions.teamMemberIds}, JSON_QUOTE(${userId}))`
        )
      )
    )
    .limit(1);

  return Number(result[0]?.count ?? 0);
}

export async function getUserApprovedQuestIds(userId: number) {
  const db = await getDb();
  if (!db) return new Set<number>();

  const rows = await db
    .select({ questId: submissions.questId })
    .from(submissions)
    .where(
      and(
        eq(submissions.status, "approved"),
        or(
          eq(submissions.userId, userId),
          sql`JSON_CONTAINS(${submissions.teamMemberIds}, JSON_QUOTE(${userId}))`
        )
      )
    );

  return new Set(rows.map((row) => Number((row as any).questId ?? 0)));
}

export async function getUserJourney(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      currentLevel: 0,
      currentXp: 0,
      xpToNextLevel: 0,
      xpProgressPercent: 0,
      streakCount: 0,
      streakTarget: 0,
      dailyChallenge: null,
      nextUnlockables: [] as Array<{
        id: number;
        title: string;
        criteria: string;
        progress: number;
        current: number;
        needed: number;
        label: string;
      }> ,
      recommendedQuests: [] as Array<{
        id: number;
        title: string;
        difficulty: string;
        xpReward: number;
        reason: string;
      }> ,
      milestoneHints: [] as string[],
      availableQuestCount: 0,
      completionCount: 0,
    };
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForNextLevel(user.level);
  const totalCompleted = await getUserCompletedQuestCount(userId);
  const difficultyCounts = await getUserCompletedQuestDifficultyCounts(userId);
  const legendaryCount = await getUserCompletedLegendaryQuestCount(userId);
  const dailyStatuses = await getUserDailyChallenges(userId);
  const todayChallenge = dailyStatuses[0] ?? null;
  const streakCount = todayChallenge?.streakCount ?? 0;
  const completedQuestIds = await getUserApprovedQuestIds(userId);
  const allUnlockables = await getUnlockables();
  const earnedUnlockables = await getUserUnlockables(userId);
  const earnedUnlockableIds = new Set(earnedUnlockables.map((unlock) => unlock.unlockable.id));
  const availableQuestRows = await getQuests({ status: "active" });
  const availableQuests = availableQuestRows.filter((row) => !completedQuestIds.has(row.quest.id));

  const difficultySet = new Set(
    Object.entries(difficultyCounts)
      .filter(([, count]) => count > 0)
      .map(([difficulty]) => difficulty)
  );
  const missingDifficulties = ["easy", "medium", "hard"].filter((difficulty) => !difficultySet.has(difficulty));

  const unlockableProgress = allUnlockables
    .filter((unlockable) => !earnedUnlockableIds.has(unlockable.id))
    .map((unlockable) => {
      let label = unlockable.title;
      let current = 0;
      let needed = 1;

      switch (unlockable.criteria) {
        case "first_quest_completed":
          label = "Complete your first quest";
          current = totalCompleted;
          needed = 1;
          break;
        case "first_medium_quest_completed":
          label = "Complete your first medium quest";
          current = difficultyCounts.medium;
          needed = 1;
          break;
        case "first_hard_quest_completed":
          label = "Complete your first hard quest";
          current = difficultyCounts.hard;
          needed = 1;
          break;
        case "quest_variety_completed":
          label = "Complete easy, medium, and hard quests";
          current = ["easy", "medium", "hard"].filter((difficulty) => difficultySet.has(difficulty)).length;
          needed = 3;
          break;
        case "five_quests_completed":
          label = "Complete 5 quests";
          current = Math.min(totalCompleted, 5);
          needed = 5;
          break;
        case "ten_quests_completed":
          label = "Complete 10 quests";
          current = Math.min(totalCompleted, 10);
          needed = 10;
          break;
        case "legendary_quest_completed":
          label = "Complete a legendary quest";
          current = Math.min(legendaryCount, 1);
          needed = 1;
          break;
        case "reach_level_5":
          label = "Reach level 5";
          current = Math.min(user.level, 5);
          needed = 5;
          break;
        case "reach_level_10":
          label = "Reach level 10";
          current = Math.min(user.level, 10);
          needed = 10;
          break;
        case "daily_streak_3":
          label = "Keep a 3-day streak";
          current = Math.min(streakCount, 3);
          needed = 3;
          break;
        case "daily_streak_7":
          label = "Keep a 7-day streak";
          current = Math.min(streakCount, 7);
          needed = 7;
          break;
        default:
          label = unlockable.title;
          current = 0;
          needed = 1;
      }

      return {
        id: unlockable.id,
        title: unlockable.title,
        criteria: unlockable.criteria,
        progress: Math.min(1, current / Math.max(1, needed)),
        current,
        needed,
        label,
      };
    })
    .sort((a, b) => a.progress - b.progress || a.needed - b.needed);

  const nextUnlockables = unlockableProgress.slice(0, 3);

  const milestones = [
    {
      id: "quests_5",
      title: "Novice Quester",
      description: "Complete 5 quests",
      icon: "Trophy",
      current: totalCompleted,
      target: 5,
      rewardXp: 250,
    },
    {
      id: "quests_10",
      title: "Dedicated Adventurer",
      description: "Complete 10 quests",
      icon: "Swords",
      current: totalCompleted,
      target: 10,
      rewardXp: 500,
    },
    {
      id: "level_5",
      title: "Rising Star",
      description: "Reach Level 5",
      icon: "Zap",
      current: user.level,
      target: 5,
      rewardXp: 300,
    },
    {
      id: "level_10",
      title: "Elite Warrior",
      description: "Reach Level 10",
      icon: "Crown",
      current: user.level,
      target: 10,
      rewardXp: 1000,
    },
    {
      id: "streak_3",
      title: "Consistent",
      description: "Keep a 3-day streak",
      icon: "Flame",
      current: streakCount,
      target: 3,
      rewardXp: 150,
    },
    {
      id: "legendary_1",
      title: "Giant Slayer",
      description: "Complete a Legendary quest",
      icon: "Shield",
      current: legendaryCount,
      target: 1,
      rewardXp: 500,
    },
  ].map(m => ({
    ...m,
    progress: Math.min(100, Math.round((m.current / m.target) * 100)),
    isCompleted: m.current >= m.target
  }));

  const recommendedQuests: Array<{
    id: number;
    title: string;
    difficulty: string;
    xpReward: number;
    reason: string;
  }> = [];
  const selectedQuestIds = new Set<number>();

  const addRecommendedQuest = (row: { quest: Quest } | null | undefined, reason: string) => {
    if (!row) return;
    const id = row.quest.id;
    if (!id || selectedQuestIds.has(id)) return;
    selectedQuestIds.add(id);
    recommendedQuests.push({
      id,
      title: row.quest.title,
      difficulty: row.quest.difficulty,
      xpReward: row.quest.xpReward,
      reason,
    });
  };

  const findQuestByDifficulty = (difficulty: Quest["difficulty"]) =>
    availableQuests.find((row) => row.quest.difficulty === difficulty);
  const highestXpQuest = () =>
    [...availableQuests].sort((a, b) => b.quest.xpReward - a.quest.xpReward)[0] ?? null;
  const easiestQuest = () =>
    [...availableQuests].sort((a, b) => a.quest.xpReward - b.quest.xpReward)[0] ?? null;
  const leastPlayedDifficulty = () => {
    const counts = [
      { difficulty: "easy", count: difficultyCounts.easy },
      { difficulty: "medium", count: difficultyCounts.medium },
      { difficulty: "hard", count: difficultyCounts.hard },
    ];
    counts.sort((a, b) => a.count - b.count);
    return findQuestByDifficulty(counts[0].difficulty as Quest["difficulty"]);
  };

  const primaryTarget = nextUnlockables[0];
  if (primaryTarget) {
    let targetQuest = null;
    switch (primaryTarget.criteria) {
      case "first_medium_quest_completed":
        targetQuest = findQuestByDifficulty("medium");
        break;
      case "first_hard_quest_completed":
        targetQuest = findQuestByDifficulty("hard");
        break;
      case "legendary_quest_completed":
        targetQuest = findQuestByDifficulty("legendary");
        break;
      case "quest_variety_completed":
        targetQuest = findQuestByDifficulty(missingDifficulties[0] as Quest["difficulty"] || "easy");
        break;
      case "five_quests_completed":
      case "ten_quests_completed":
      case "reach_level_5":
      case "reach_level_10":
        targetQuest = highestXpQuest();
        break;
      case "daily_streak_3":
      case "daily_streak_7":
        targetQuest = easiestQuest();
        break;
      case "first_quest_completed":
        targetQuest = availableQuests[0] ?? null;
        break;
      default:
        targetQuest = highestXpQuest();
    }

    addRecommendedQuest(targetQuest, `Move toward: ${primaryTarget.label}`);
  }

  if (availableQuests.length > 0) {
    addRecommendedQuest(leastPlayedDifficulty(), "Balance your progress with a new difficulty");
    addRecommendedQuest(highestXpQuest(), "Earn more XP toward your next level");
  }

  const milestoneHints: string[] = [];
  if (nextUnlockables.length > 0) {
    milestoneHints.push(`Next unlockable: ${nextUnlockables[0].title} (${nextUnlockables[0].current}/${nextUnlockables[0].needed})`);
  }
  if (streakCount > 0 && todayChallenge && !todayChallenge.completedToday) {
    milestoneHints.push(`Keep the streak alive today for +${todayChallenge.challenge.rewardXp} XP`);
  }
  if (user.xp - currentLevelXp > 0) {
    milestoneHints.push(`${nextLevelXp - user.xp} XP to reach level ${user.level + 1}`);
  }
  if (recommendedQuests.length === 0 && availableQuests.length > 0) {
    milestoneHints.push("Explore active quests to keep your adventure moving.");
  }

  return {
    currentLevel: user.level,
    currentXp: user.xp,
    xpToNextLevel: nextLevelXp - currentLevelXp,
    xpProgressPercent: currentLevelXp < nextLevelXp ? Math.round(((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100) : 100,
    streakCount,
    streakTarget: todayChallenge ? todayChallenge.streakCount + 1 : 0,
    dailyChallenge: todayChallenge
      ? {
          title: todayChallenge.challenge.title,
          completedToday: todayChallenge.completedToday,
          rewardXp: todayChallenge.challenge.rewardXp,
        }
      : null,
    nextUnlockables,
    recommendedQuests,
    milestoneHints,
    availableQuestCount: availableQuests.length,
    completionCount: totalCompleted,
    milestones,
  };
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
  const result = await db.insert(quests).values({
    ...quest,
    expiresAt: quest.expiresAt || undefined,
    status: quest.status || "active",
    repeatable: quest.repeatable ?? false,
  });
  return (result[0] as { insertId: number }).insertId;
}

export async function getQuestTeamMemberIds(questId: number) {
  const db = await getDb();
  if (!db) return [];

  const questRow = await db
    .select({ quest: quests })
    .from(quests)
    .where(eq(quests.id, questId))
    .limit(1);

  if (!questRow[0]) return [];

  const ownerId = questRow[0].quest.createdBy;
  const proposalId = questRow[0].quest.questProposalId;
  const memberIds = new Set<number>([ownerId]);

  if (proposalId) {
    const acceptedInvites = await db
      .select({ invitedUserId: questTeamInvitations.invitedUserId })
      .from(questTeamInvitations)
      .where(
        and(
          eq(questTeamInvitations.questProposalId, proposalId),
          eq(questTeamInvitations.status, "accepted")
        )
      );

    acceptedInvites.forEach((row) => memberIds.add(row.invitedUserId));
  }

  return Array.from(memberIds);
}

async function expirePastQuests(db: any) {
  await db
    .update(quests)
    .set({ status: "expired" })
    .where(
      and(
        eq(quests.status, "active"),
        lt(quests.expiresAt, new Date())
      )
    );
}

export async function getQuests(filters?: {
  difficulty?: Quest["difficulty"];
  status?: Quest["status"];
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await expirePastQuests(db);

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
  await expirePastQuests(db);
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

export async function createSubmission(sub: Omit<InsertSubmission, "teamMemberIds"> & { teamMemberIds?: number[] | string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const submissionRow: InsertSubmission = {
    ...sub,
    teamMemberIds: sub.teamMemberIds ? JSON.stringify(sub.teamMemberIds) : undefined,
  };
  const result = await db.insert(submissions).values(submissionRow);
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
        eq(submissions.questId, questId),
        eq(submissions.status, "approved"),
        or(
          eq(submissions.userId, userId),
          sql`JSON_CONTAINS(${submissions.teamMemberIds}, JSON_QUOTE(${userId}))`
        )
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

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId)));
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

export async function createQuestProposal(data: {
  title: string;
  description: string;
  xpReward: number;
  difficulty: "easy" | "medium" | "hard" | "legendary";
  proposedBy: number;
  status: "pending" | "approved" | "rejected";
  duration?: "none" | "1h" | "6h" | "24h" | "7d" | "30d";
  expiresAt?: Date;
  requirementType?: "individual" | "team";
  requiredMediaCount?: number;
  repeatable?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const proposalRow: InsertQuestProposal = {
    title: data.title,
    description: data.description,
    xpReward: data.xpReward,
    difficulty: data.difficulty,
    proposedBy: data.proposedBy,
    status: data.status,
    duration: data.duration ?? "none",
    requirementType: data.requirementType ?? "individual",
    requiredMediaCount: data.requiredMediaCount ?? 1,
    rejectionReason: null,
    repeatable: data.repeatable ?? false,
  };

  const result = await db.insert(questProposals).values(proposalRow);
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

export async function getQuestTeamMembers(questProposalId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all accepted team members for a quest proposal
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
        eq(questTeamInvitations.questProposalId, questProposalId)
      )
    );

  return members;
}

// ─── Global Activity ──────────────────────────────────────────────────────────

export async function getGlobalActivity(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  // Fetch approved, public submissions with user and quest info
  const recentSubmissions = await db
    .select({
      id: submissions.id,
      type: sql<string>`'quest_completion'`,
      createdAt: submissions.createdAt,
      userName: users.name,
      userAvatar: users.avatarUrl,
      questTitle: quests.title,
      xpAwarded: submissions.xpAwarded,
      difficulty: quests.difficulty,
      mediaUrl: submissions.mediaUrl,
      mediaType: submissions.mediaType,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .innerJoin(quests, eq(submissions.questId, quests.id))
    .where(and(eq(submissions.status, "approved"), eq(submissions.isPublic, true)))
    .orderBy(desc(submissions.createdAt))
    .limit(limit);

  // Fetch recent notifications that represent level ups or milestones
  // We'll filter for public-facing types
  const recentNotifications = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      createdAt: notifications.createdAt,
      userName: users.name,
      title: notifications.title,
      message: notifications.message,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .where(
      or(
        eq(notifications.type, "level_up"),
        eq(notifications.type, "unlockable_earned")
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  // Combine and sort
  const combined = [
    ...recentSubmissions.map((s) => ({
      id: `sub-${s.id}`,
      type: "quest_completion",
      createdAt: s.createdAt,
      userName: s.userName || "Adventurer",
      userAvatar: s.userAvatar,
      title: s.questTitle,
      detail: `${s.xpAwarded} XP · ${s.difficulty.toUpperCase()}`,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
    })),
    ...recentNotifications.map((n) => ({
      id: `notif-${n.id}`,
      type: n.type,
      createdAt: n.createdAt,
      userName: n.userName || "Adventurer",
      title: n.title,
      detail: n.message,
    })),
  ]
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, limit);

  return combined;
}
