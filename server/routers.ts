import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addXpToUser,
  createNotification,
  createQuest,
  createQuestProposal,
  createSubmission,
  createTeamInvitation,
  deleteFilterPreset,
  getQuestTeamMemberIds,
  deleteQuest,
  getFilterPresets,
  getLeaderboard,
  getNotificationsByUser,
  getPendingQuestProposals,
  getProposalStats,
  getQuestById,
  getQuests,
  getQuestProposalsByUser,
  getSubmissionById,
  getSubmissionsByQuest,
  getSubmissionsByUser,
  getUnreadNotificationCount,
  getTeamInvitationsByUser,
  getUserById,
  getDb,
  getQuestTeamMembers,
  getAllUsers,
  getUnlockables,
  getUserUnlockables,
  createUnlockables,
  grantUnlockable,
  getUserUnlockable,
  getDailyChallenges,
  getUserDailyChallenges,
  completeDailyChallenge,
  getUserCompletedQuestCount,
  getUserCompletedQuestDifficultyCounts,
  getUserCompletedQuestDifficultySet,
  getUserCompletedLegendaryQuestCount,
  awardDailyStreakUnlockablesForUser,
  countAdmins,
  updateUserRole,
  hasUserCompletedQuest,
  markNotificationsRead,
  saveFilterPreset,
  searchUsers,
  updateQuest,
  updateQuestCompletionCount,
  updateQuestProposal,
  updateSubmission,
  updateTeamInvitationStatus,
  xpForLevel,
  xpForNextLevel,
  getPendingSubmissions,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { eq } from "drizzle-orm";
import { questProposals, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import bcrypt from "bcrypt";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

function getProposalDurationMs(duration?: string | null, createdAt?: Date | string | null, expiresAt?: Date | string | null) {
  if (duration && duration !== "none") {
    switch (duration) {
      case "1h": return 60 * 60 * 1000;
      case "6h": return 6 * 60 * 60 * 1000;
      case "24h": return 24 * 60 * 60 * 1000;
      case "7d": return 7 * 24 * 60 * 60 * 1000;
      case "30d": return 30 * 24 * 60 * 60 * 1000;
    }
  }

  if (createdAt && expiresAt) {
    const start = new Date(createdAt).getTime();
    const end = new Date(expiresAt).getTime();
    const diff = end - start;
    return diff > 0 ? diff : undefined;
  }

  return undefined;
}

async function awardUnlockablesForUser(
  userId: number,
  quest: { id: number; difficulty: string; title: string },
  completionCount: number,
  newLevel: number,
  isLegendary: boolean,
  difficultyCounts: { easy: number; medium: number; hard: number; legendary: number }
) {
  const unlockables = await getUnlockables();
  const awarded: Array<{ id: number; title: string; description: string }> = [];

  for (const unlockable of unlockables) {
    const existing = await getUserUnlockable(userId, unlockable.id);
    if (existing) continue;

    let qualifies = false;
    const currentDifficultyCount = (difficultyCounts as any)[quest.difficulty] ?? 0;
    const newDifficultyCount = { ...difficultyCounts, [quest.difficulty]: currentDifficultyCount + 1 };
    const completedDifficulties = new Set(
      Object.keys(difficultyCounts).filter((diff) => (difficultyCounts as any)[diff] > 0)
    );
    completedDifficulties.add(quest.difficulty);

    switch (unlockable.criteria) {
      case "first_quest_completed":
        qualifies = completionCount === 1;
        break;
      case "first_medium_quest_completed":
        qualifies = quest.difficulty === "medium" && newDifficultyCount.medium === 1;
        break;
      case "first_hard_quest_completed":
        qualifies = quest.difficulty === "hard" && newDifficultyCount.hard === 1;
        break;
      case "quest_variety_completed":
        qualifies = ["easy", "medium", "hard"].every((diff) => completedDifficulties.has(diff));
        break;
      case "five_quests_completed":
        qualifies = completionCount >= 5;
        break;
      case "ten_quests_completed":
        qualifies = completionCount >= 10;
        break;
      case "legendary_quest_completed":
        qualifies = isLegendary;
        break;
      case "reach_level_5":
        qualifies = newLevel >= 5;
        break;
      case "reach_level_10":
        qualifies = newLevel >= 10;
        break;
      default:
        break;
    }

    if (!qualifies) continue;

    const unlock = await grantUnlockable(userId, unlockable.id, JSON.stringify({ questId: quest.id, level: newLevel }));
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
      metadata: JSON.stringify({ unlockableId: unlockable.id, questId: quest.id }),
    });
  }

  return awarded;
}

async function syncUnlockablesForUser(userId: number) {
  const unlockables = await getUnlockables();
  const completedCount = await getUserCompletedQuestCount(userId);
  const legendaryCount = await getUserCompletedLegendaryQuestCount(userId);
  const user = await getUserById(userId);
  if (!user) return [];

  const awarded: Array<{ id: number; title: string; description: string }> = [];

  for (const unlockable of unlockables) {
    const existing = await getUserUnlockable(userId, unlockable.id);
    if (existing) continue;

    let qualifies = false;
    switch (unlockable.criteria) {
      case "first_quest_completed":
        qualifies = completedCount >= 1;
        break;
      case "five_quests_completed":
        qualifies = completedCount >= 5;
        break;
      case "ten_quests_completed":
        qualifies = completedCount >= 10;
        break;
      case "legendary_quest_completed":
        qualifies = legendaryCount >= 1;
        break;
      case "reach_level_5":
        qualifies = user.level >= 5;
        break;
      case "reach_level_10":
        qualifies = user.level >= 10;
        break;
      default:
        break;
    }

    if (!qualifies) continue;

    const unlock = await grantUnlockable(userId, unlockable.id, JSON.stringify({ synced: true }));
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
      metadata: JSON.stringify({ unlockableId: unlockable.id, synced: true }),
    });
  }

  return awarded;
}

async function processSubmissionReview(
  ctx: any,
  sub: any,
  approved: boolean,
  reason: string,
  confidence: number | null
) {
  const teamMemberIds: number[] = sub.teamMemberIds ? JSON.parse(sub.teamMemberIds) : [];
  const questRow = await getQuestById(sub.questId);
  if (!questRow) throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
  const quest = questRow.quest;
  const submitterId = sub.userId;

  let leveledUp = false;
  let newLevel = 1;
  let newXp = 0;
  let submitterXpAwarded = 0;
  let newUnlockables: Array<{ id: number; title: string; description: string }> = [];

  if (approved) {
    await updateQuestCompletionCount(quest.id);

    const allParticipantIds = Array.from(new Set([sub.userId, ...teamMemberIds]));

    for (const participantId of allParticipantIds) {
      if (await hasUserCompletedQuest(participantId, quest.id)) {
        continue;
      }

      const previousCompletionCount = await getUserCompletedQuestCount(participantId);
      const difficultyCounts = await getUserCompletedQuestDifficultyCounts(participantId);
      const difficultyBonus = (() => {
        if (quest.difficulty === "medium" && difficultyCounts.medium === 0) return 20;
        if (quest.difficulty === "hard" && difficultyCounts.hard === 0) return 40;
        if (quest.difficulty === "legendary" && difficultyCounts.legendary === 0) return 100;
        return 0;
      })();
      const totalXpAwarded = quest.xpReward + difficultyBonus;
      const xpResult = await addXpToUser(participantId, totalXpAwarded);

      if (participantId === submitterId) {
        leveledUp = xpResult.leveledUp;
        newLevel = xpResult.newLevel;
        newXp = xpResult.newXp;
        submitterXpAwarded = totalXpAwarded;
      }

      await createNotification({
        userId: participantId,
        type: "submission_verified",
        title: "Quest Completed! 🎉",
        message: `Your submission for "${quest.title}" was verified! You earned ${totalXpAwarded} XP.`,
        metadata: JSON.stringify({ questId: quest.id, xpAwarded: totalXpAwarded, bonusXp: difficultyBonus }),
      });

      await createNotification({
        userId: participantId,
        type: "xp_gained",
        title: `+${totalXpAwarded} XP Earned`,
        message: `You gained ${totalXpAwarded} XP for completing "${quest.title}"${difficultyBonus ? ` (+${difficultyBonus} bonus)` : ""}.`,
        metadata: JSON.stringify({ xp: totalXpAwarded, bonusXp: difficultyBonus }),
      });

      const awardedUnlockables = await awardUnlockablesForUser(
        participantId,
        { id: quest.id, difficulty: quest.difficulty, title: quest.title },
        previousCompletionCount + 1,
        xpResult.newLevel,
        quest.difficulty === "legendary",
        difficultyCounts
      );

      if (participantId === submitterId && awardedUnlockables.length > 0) {
        newUnlockables = awardedUnlockables;
      }

      if (participantId !== submitterId) {
        await createNotification({
          userId: participantId,
          type: "milestone",
          title: "Team Quest Complete!",
          message: `Your team submission for "${quest.title}" was verified!`,
          metadata: JSON.stringify({ questId: quest.id }),
        });
      }
    }

    if (leveledUp) {
      await createNotification({
        userId: submitterId,
        type: "level_up",
        title: `Level Up! You're now Level ${newLevel} 🚀`,
        message: `Incredible! You've reached Level ${newLevel}. Keep completing quests to level up further!`,
        metadata: JSON.stringify({ newLevel }),
      });
    }

    if (quest.createdBy !== submitterId) {
      const submitter = await getUserById(submitterId);
      await createNotification({
        userId: quest.createdBy,
        type: "quest_completed",
        title: "Your quest was completed!",
        message: `${submitter?.name ?? "A player"} completed your quest "${quest.title}".`,
        metadata: JSON.stringify({ questId: quest.id, submitterId }),
      });
    }
  } else {
    await createNotification({
      userId: sub.userId,
      type: "submission_rejected",
      title: "Submission Not Verified",
      message: `Your submission for "${quest.title}" was rejected. ${reason}`,
      metadata: JSON.stringify({ questId: quest.id }),
    });
  }

  await updateSubmission(sub.id, {
    status: approved ? "approved" : "rejected",
    aiVerified: false,
    aiConfidence: confidence ?? undefined,
    aiReason: reason,
    xpAwarded: approved ? submitterXpAwarded : 0,
  });

  return {
    xpAwarded: approved ? submitterXpAwarded : 0,
    leveledUp,
    newLevel,
    newXp,
    newUnlockables,
  };
}

// ─── Routers ───────────────────────────────────────────────────────────────────────────────────

const questRouter = router({
  list: publicProcedure
    .input(
      z.object({
        difficulty: z.enum(["easy", "medium", "hard", "legendary"]).optional(),
        status: z.enum(["active", "expired", "archived"]).optional(),
        createdBy: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return getQuests(input ?? {});
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const row = await getQuestById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      return row;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(255),
        description: z.string().min(10),
        xpReward: z.number().min(10).max(5000),
        difficulty: z.enum(["easy", "medium", "hard", "legendary"]),
        expiresAt: z.string().optional(),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createQuest({
        title: input.title,
        description: input.description,
        xpReward: input.xpReward,
        difficulty: input.difficulty,
        createdBy: ctx.user.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        imageUrl: input.imageUrl,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(3).max(255).optional(),
        description: z.string().min(10).optional(),
        xpReward: z.number().min(10).max(5000).optional(),
        difficulty: z.enum(["easy", "medium", "hard", "legendary"]).optional(),
        status: z.enum(["active", "expired", "archived"]).optional(),
        expiresAt: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await getQuestById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.quest.createdBy !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { id, expiresAt, ...rest } = input;
      await updateQuest(id, {
        ...rest,
        expiresAt: expiresAt === null ? undefined : expiresAt ? new Date(expiresAt) : undefined,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const row = await getQuestById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await deleteQuest(input.id);
      return { success: true };
    }),
});

const submissionRouter = router({
  // Upload media and create a pending submission
  uploadMedia: protectedProcedure
    .input(
      z.object({
        questId: z.number(),
        mediaBase64: z.string(),
        mediaType: z.enum(["image", "video"]),
        mimeType: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const quest = await getQuestById(input.questId);
      if (!quest) throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      if (quest.quest.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quest is not active" });
      }

      const alreadyDone = await hasUserCompletedQuest(ctx.user.id, input.questId);
      if (alreadyDone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You already completed this quest" });
      }

      const buffer = Buffer.from(input.mediaBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "bin";
      const fileKey = "submissions/user-" + ctx.user.id + "/quest-" + input.questId + "/" + randomSuffix() + "." + ext;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      let teamMemberIds: number[] | undefined;
      if (quest.quest.requirementType === "team") {
        const memberIds = await getQuestTeamMemberIds(quest.quest.id);
        if (!memberIds.includes(ctx.user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only invited team members can submit for this quest." });
        }
        teamMemberIds = memberIds;
      }

      const submissionId = await createSubmission({
        questId: input.questId,
        userId: ctx.user.id,
        mediaUrl: url,
        mediaType: input.mediaType,
        mediaKey: fileKey,
        status: "pending",
        teamMemberIds,
      });

      return { submissionId, mediaUrl: url };  
      
    }),

    createPendingSubmission: protectedProcedure
  .input(
    z.object({
      questId: z.number(),
      mediaType: z.enum(["image", "video"]),
      note: z.string().optional().default("Media upload skipped - awaiting admin review"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const quest = await getQuestById(input.questId);
    if (!quest) throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
    if (quest.quest.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Quest is not active" });
    }

    const alreadyDone = await hasUserCompletedQuest(ctx.user.id, input.questId);
    if (alreadyDone) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You already completed this quest" });
    }

    // Team check
    let teamMemberIds: number[] | undefined;
    if (quest.quest.requirementType === "team") {
      const memberIds = await getQuestTeamMemberIds(quest.quest.id);
      if (!memberIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only invited team members can submit for this quest." });
      }
      teamMemberIds = memberIds;
    }

    const placeholderUrl = `pending-review://quest-${input.questId}/user-${ctx.user.id}/${Date.now()}`;
    const placeholderKey = `pending/${ctx.user.id}/quest-${input.questId}/${randomSuffix()}`;

    const submissionId = await createSubmission({
      questId: input.questId,
      userId: ctx.user.id,
      mediaUrl: placeholderUrl,
      mediaType: input.mediaType,
      mediaKey: placeholderKey,
      status: "pending",
      teamMemberIds,
      // note: input.note,        // Remove this line if your createSubmission doesn't support 'note'
    });

    // Notify admin/owner
    await createNotification({
      userId: 1,
      type: "milestone",                    // Better type for admin alert
      title: "New Pending Submission (No Media)",
      message: `User submitted for quest ${input.questId} without media (storage issue). Please review manually.`,
      metadata: JSON.stringify({ 
        questId: input.questId,
        note: input.note 
      }),
    });

    return { submissionId };
  }),
  // AI verification of a submission
  verify: protectedProcedure
    .input(z.object({ submissionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubmissionById(input.submissionId);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
      if (sub.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (sub.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Submission already processed" });
      }

      const teamMemberIds: number[] = sub.teamMemberIds ? JSON.parse(sub.teamMemberIds) : [];

      const questRow = await getQuestById(sub.questId);
      if (!questRow) throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      const quest = questRow.quest;

      const isVideo = sub.mediaType === "video";
      const systemPrompt = "You are an AI quest verification system for a gamified side quest platform. Your job is to verify whether a user has genuinely completed a quest based on their submitted media. Be fair but strict. Look for clear evidence that the quest was actually completed. Always respond with valid JSON matching the schema provided.";

      const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string }; file_url?: { url: string; mime_type: string } }> = [
        {
          type: "text",
          text:
            "Quest Title: \"" + quest.title + "\"\n" +
            "Quest Description: \"" + quest.description + "\"\n" +
            "Difficulty: " + quest.difficulty + "\n\n" +
            "Please analyze the submitted " + (isVideo ? "video" : "image") +
            " and determine if it genuinely proves the user completed this quest.",
        },
      ];

      if (isVideo) {
        userContent.push({
          type: "file_url",
          file_url: { url: sub.mediaUrl, mime_type: "video/mp4" },
        });
      } else {
        userContent.push({
          type: "image_url",
          image_url: { url: sub.mediaUrl, detail: "high" },
        });
      }

      let aiResult: { verified: boolean; confidence: number; reason: string };
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent as any },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "verification_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  verified: { type: "boolean", description: "Whether the quest was genuinely completed" },
                  confidence: { type: "number", description: "Confidence score from 0.0 to 1.0" },
                  reason: { type: "string", description: "Brief explanation of the verification decision" },
                },
                required: ["verified", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        aiResult = typeof content === "string" ? JSON.parse(content) : content;
      } catch (err) {
        console.error("[AI Verification] Failed:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI verification failed" });
      }

      const approved = aiResult.verified && aiResult.confidence >= 0.6;

      let leveledUp = false;
      let newLevel = 1;
      let newXp = 0;
      let submitterXpAwarded = 0;
      let newUnlockables: Array<{ id: number; title: string; description: string }> = [];
      const submitterId = sub.userId;

      if (approved) {
        await updateQuestCompletionCount(quest.id);

        const allParticipantIds = Array.from(new Set([sub.userId, ...teamMemberIds]));

        for (const participantId of allParticipantIds) {
          if (await hasUserCompletedQuest(participantId, quest.id)) {
            continue;
          }

          const previousCompletionCount = await getUserCompletedQuestCount(participantId);
          const difficultyCounts = await getUserCompletedQuestDifficultyCounts(participantId);
          const difficultyBonus = (() => {
            if (quest.difficulty === "medium" && difficultyCounts.medium === 0) return 20;
            if (quest.difficulty === "hard" && difficultyCounts.hard === 0) return 40;
            if (quest.difficulty === "legendary" && difficultyCounts.legendary === 0) return 100;
            return 0;
          })();
          const totalXpAwarded = quest.xpReward + difficultyBonus;
          const xpResult = await addXpToUser(participantId, totalXpAwarded);

          if (participantId === submitterId) {
            leveledUp = xpResult.leveledUp;
            newLevel = xpResult.newLevel;
            newXp = xpResult.newXp;
            submitterXpAwarded = totalXpAwarded;
          }

          await createNotification({
            userId: participantId,
            type: "submission_verified",
            title: "Quest Completed! 🎉",
            message: "Your submission for \"" + quest.title + "\" was verified! You earned " + totalXpAwarded + " XP.",
            metadata: JSON.stringify({ questId: quest.id, xpAwarded: totalXpAwarded, bonusXp: difficultyBonus }),
          });

          await createNotification({
            userId: participantId,
            type: "xp_gained",
            title: "+" + totalXpAwarded + " XP Earned",
            message: "You gained " + totalXpAwarded + " XP for completing \"" + quest.title + "\"" + (difficultyBonus ? " (+" + difficultyBonus + " bonus)" : "") + ".",
            metadata: JSON.stringify({ xp: totalXpAwarded, bonusXp: difficultyBonus }),
          });

          const awardedUnlockables = await awardUnlockablesForUser(
            participantId,
            { id: quest.id, difficulty: quest.difficulty, title: quest.title },
            previousCompletionCount + 1,
            xpResult.newLevel,
            quest.difficulty === "legendary",
            difficultyCounts
          );

          if (participantId === submitterId && awardedUnlockables.length > 0) {
            newUnlockables = awardedUnlockables;
          }

          if (participantId !== submitterId) {
            await createNotification({
              userId: participantId,
              type: "milestone",
              title: "Team Quest Complete!",
              message: "Your team submission for \"" + quest.title + "\" was verified!",
              metadata: JSON.stringify({ questId: quest.id }),
            });
          }
        }

        if (leveledUp) {
          await createNotification({
            userId: submitterId,
            type: "level_up",
            title: "Level Up! You're now Level " + newLevel + " 🚀",
            message: "Incredible! You've reached Level " + newLevel + ". Keep completing quests to level up further!",
            metadata: JSON.stringify({ newLevel }),
          });
        }

        if (quest.createdBy !== submitterId) {
          const submitter = await getUserById(submitterId);
          await createNotification({
            userId: quest.createdBy,
            type: "quest_completed",
            title: "Your quest was completed!",
            message: (submitter?.name ?? "A player") + " completed your quest \"" + quest.title + "\".",
            metadata: JSON.stringify({ questId: quest.id, submitterId }),
          });
        }
      } else {
        await createNotification({
          userId: submitterId,
          type: "submission_rejected",
          title: "Submission Not Verified",
          message: "Your submission for \"" + quest.title + "\" was not verified. " + aiResult.reason,
          metadata: JSON.stringify({ questId: quest.id }),
        });
      }

      await updateSubmission(input.submissionId, {
        status: approved ? "approved" : "rejected",
        aiVerified: aiResult.verified,
        aiConfidence: aiResult.confidence,
        aiReason: aiResult.reason,
        xpAwarded: approved ? submitterXpAwarded : 0,
      });

      return {
        approved,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
        xpAwarded: approved ? submitterXpAwarded : 0,
        leveledUp,
        newLevel,
        newXp,
        newUnlockables,
      };
    }),

  review: adminProcedure
    .input(
      z.object({
        submissionId: z.number(),
        approved: z.boolean(),
        reason: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubmissionById(input.submissionId);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
      if (sub.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Submission already processed" });
      }
      return processSubmissionReview(
        ctx,
        sub,
        input.approved,
        input.reason ?? (input.approved ? "Approved by admin" : "Rejected by admin"),
        input.approved ? 1 : 0
      );
    }),

  pending: adminProcedure.query(async () => {
    return getPendingSubmissions();
  }),

  mySubmissions: protectedProcedure.query(async ({ ctx }) => {
    return getSubmissionsByUser(ctx.user.id);
  }),

  questSubmissions: protectedProcedure
    .input(z.object({ questId: z.number() }))
    .query(async ({ ctx, input }) => {
      const quest = await getQuestById(input.questId);
      if (!quest) throw new TRPCError({ code: "NOT_FOUND" });
      if (quest.quest.createdBy !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getSubmissionsByQuest(input.questId);
    }),
});

const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getNotificationsByUser(ctx.user.id);
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return getUnreadNotificationCount(ctx.user.id);
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});

const unlockablesRouter = router({
  list: publicProcedure.query(async () => {
    return getUnlockables();
  }),

  myUnlockables: protectedProcedure.query(async ({ ctx }) => {
    await syncUnlockablesForUser(ctx.user.id);
    return getUserUnlockables(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        category: z.enum(["badge", "cosmetic", "title", "boost"]),
        criteria: z.string().min(1),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const id = await createUnlockables(input);
      return { id };
    }),

  grant: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        unlockableId: z.number(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const existing = await getUserUnlockable(input.userId, input.unlockableId);
      if (existing) {
        return { success: false, message: "Unlockable already granted" };
      }
      const unlock = await grantUnlockable(input.userId, input.unlockableId, input.metadata);
      return { success: !!unlock, unlock };
    }),
});

const dailyRouter = router({
  list: publicProcedure.query(async () => {
    return getDailyChallenges();
  }),

  myStatus: protectedProcedure.query(async ({ ctx }) => {
    return getUserDailyChallenges(ctx.user.id);
  }),

  complete: protectedProcedure
    .input(z.object({ challengeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return completeDailyChallenge(ctx.user.id, input.challengeId);
    }),
});

const userRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const currentLevelXp = xpForLevel(user.level);
    const nextLevelXp = xpForNextLevel(user.level);
    return {
      ...user,
      currentLevelXp,
      nextLevelXp,
      xpProgress: user.xp - currentLevelXp,
      xpNeeded: nextLevelXp - currentLevelXp,
    };
  }),

  leaderboard: publicProcedure.query(async () => {
    return getLeaderboard(50);
  }),

  listAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllUsers();
  }),

  setRole: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const targetUser = await getUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (targetUser.openId === ENV.ownerOpenId && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The owner account must remain an admin" });
      }

      if (targetUser.role === input.role) {
        return { success: true };
      }

      if (targetUser.role === "admin" && input.role === "user") {
        const adminCount = await countAdmins();
        if (adminCount <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the last admin" });
        }
      }

      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),
});

const teamRouter = router({
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return searchUsers(input.query, ctx.user.id, 10);
    }),

  inviteTeamMember: protectedProcedure
    .input(
      z.object({
        questProposalId: z.number(),
        invitedUserId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the user is the proposal creator
      const proposal = await getQuestProposalsByUser(ctx.user.id);
      const isOwner = proposal.some((p) => p.id === input.questProposalId);
      if (!isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only invite members to your own proposals" });
      }

      const invitationId = await createTeamInvitation(
        input.questProposalId,
        input.invitedUserId,
        ctx.user.id
      );

      // Notify the invited user
      const invitedUser = await getUserById(input.invitedUserId);
      const proposal_data = await getQuestProposalsByUser(ctx.user.id);
      const proposal_title = proposal_data.find((p) => p.id === input.questProposalId)?.title;

      if (invitedUser) {
        await createNotification({
          userId: input.invitedUserId,
          type: "milestone",
          title: "Team Invitation",
          message: `You've been invited to join a team quest: "${proposal_title}"`,
          metadata: JSON.stringify({ invitationId, questProposalId: input.questProposalId }),
        });
      }

      return { invitationId, success: true };
    }),

  myInvitations: protectedProcedure.query(async ({ ctx }) => {
    return getTeamInvitationsByUser(ctx.user.id);
  }),

  proposalMembers: protectedProcedure
    .input(z.object({ questProposalId: z.number() }))
    .query(async ({ input }) => {
      return getQuestTeamMembers(input.questProposalId);
    }),

  respondToInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.number(),
        accepted: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the invitation belongs to the user
      const invitations = await getTeamInvitationsByUser(ctx.user.id);
      const invitation = invitations.find((i) => i.id === input.invitationId);
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }

      const status = input.accepted ? "accepted" : "declined";
      await updateTeamInvitationStatus(input.invitationId, status);

      // Notify the inviter
      const inviter = await getUserById(invitation.invitedBy);
      if (inviter) {
        const action = input.accepted ? "accepted" : "declined";
        const user = await getUserById(ctx.user.id);
        await createNotification({
          userId: invitation.invitedBy,
          type: "milestone",
          title: `Team Invitation ${action.charAt(0).toUpperCase() + action.slice(1)}`,
          message: `${user?.name} has ${action} your team invitation for "${invitation.questProposal.title}".`,
          metadata: JSON.stringify({ invitationId: input.invitationId }),
        });
      }

      return { success: true };
    }),
});

const proposalRouter = router({
  // Inside proposalRouter
submit: protectedProcedure
  .input(
    z.object({
      title: z.string().min(3).max(255),
      description: z.string().min(10),
      xpReward: z.number().min(10).max(5000),
      difficulty: z.enum(["easy", "medium", "hard", "legendary"]),
      duration: z.enum(["none", "1h", "6h", "24h", "7d", "30d"]).default("24h"),
      requirementType: z.enum(["individual", "team"]).default("individual"), // optional
      requiredMediaCount: z.number().min(1).max(5).default(1),               // optional
    })
  )
  .mutation(async ({ ctx, input }) => {
    const proposalId = await createQuestProposal({
      title: input.title,
      description: input.description,
      xpReward: input.xpReward,
      difficulty: input.difficulty,
      proposedBy: ctx.user.id,
      status: "pending",
      duration: input.duration,
      requirementType: input.requirementType,     // optional
      requiredMediaCount: input.requiredMediaCount, // optional
    });

    const user = await getUserById(ctx.user.id);
    await createNotification({
      userId: 1, // owner
      type: "milestone",
      title: "New Quest Proposal",
      message: `${user?.name || "A user"} proposed: "${input.title}" (${input.difficulty}, ${input.xpReward} XP)`,
      metadata: JSON.stringify({ proposalId, proposedBy: ctx.user.id }),
    });

    return { proposalId, success: true };
  }),

  myProposals: protectedProcedure.query(async ({ ctx }) => {
    return getQuestProposalsByUser(ctx.user.id);
  }),

  pending: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return getPendingQuestProposals();
  }),

  approve: protectedProcedure
    .input(z.object({ proposalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const proposal = await db
        .select()
        .from(questProposals)
        .where(eq(questProposals.id, input.proposalId))
        .limit(1);

      if (!proposal[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (proposal[0].status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is not pending" });
      }

      const durationMs = getProposalDurationMs(proposal[0].duration, proposal[0].createdAt, proposal[0].expiresAt);
      const questExpiresAt = durationMs ? new Date(Date.now() + durationMs) : undefined;

      const questId = await createQuest({
        title: proposal[0].title,
        description: proposal[0].description,
        xpReward: proposal[0].xpReward,
        difficulty: proposal[0].difficulty,
        createdBy: proposal[0].proposedBy,
        status: "active",
        expiresAt: questExpiresAt,
        requirementType: proposal[0].requirementType,
        requiredMediaCount: proposal[0].requiredMediaCount,
        questProposalId: input.proposalId,
      });

      await updateQuestProposal(input.proposalId, { status: "approved" });

      await createNotification({
        userId: proposal[0].proposedBy,
        type: "quest_completed",
        title: "Quest Approved! 🎉",
        message: `Your quest proposal "${proposal[0].title}" has been approved and is now live!`,
        metadata: JSON.stringify({ questId, proposalId: input.proposalId }),
      });

      return { success: true, questId };
    }),

  reject: protectedProcedure
    .input(
      z.object({
        proposalId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const proposal = await db
        .select()
        .from(questProposals)
        .where(eq(questProposals.id, input.proposalId))
        .limit(1);

      if (!proposal[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (proposal[0].status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is not pending" });
      }

      await updateQuestProposal(input.proposalId, {
        status: "rejected",
        rejectionReason: input.reason,
      });

      await createNotification({
        userId: proposal[0].proposedBy,
        type: "submission_rejected",
        title: "Quest Proposal Rejected",
        message: `Your quest proposal "${proposal[0].title}" was not approved.${input.reason ? ` Reason: ${input.reason}` : ""}`,
        metadata: JSON.stringify({ proposalId: input.proposalId }),
      });

      return { success: true };
    }),

  bulkApprove: protectedProcedure
    .input(z.object({ proposalIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const results = [];
      for (const proposalId of input.proposalIds) {
        const proposal = await db
          .select()
          .from(questProposals)
          .where(eq(questProposals.id, proposalId))
          .limit(1);

        if (!proposal[0] || proposal[0].status !== "pending") continue;

        const durationMs = getProposalDurationMs(proposal[0].duration, proposal[0].createdAt, proposal[0].expiresAt);
        const questExpiresAt = durationMs ? new Date(Date.now() + durationMs) : undefined;

        const questId = await createQuest({
          title: proposal[0].title,
          description: proposal[0].description,
          xpReward: proposal[0].xpReward,
          difficulty: proposal[0].difficulty,
          createdBy: proposal[0].proposedBy,
          status: "active",
          expiresAt: questExpiresAt,
          requirementType: proposal[0].requirementType,
          requiredMediaCount: proposal[0].requiredMediaCount,
          questProposalId: proposalId,
        });

        await updateQuestProposal(proposalId, { status: "approved" });

        await createNotification({
          userId: proposal[0].proposedBy,
          type: "quest_completed",
          title: "Quest Approved! 🎉",
          message: `Your quest proposal "${proposal[0].title}" has been approved and is now live!`,
          metadata: JSON.stringify({ questId, proposalId }),
        });

        results.push({ proposalId, questId, success: true });
      }

      return { success: true, approved: results.length };
    }),

  bulkReject: protectedProcedure
    .input(
      z.object({
        proposalIds: z.array(z.number()).min(1),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const results = [];
      for (const proposalId of input.proposalIds) {
        const proposal = await db
          .select()
          .from(questProposals)
          .where(eq(questProposals.id, proposalId))
          .limit(1);

        if (!proposal[0] || proposal[0].status !== "pending") continue;

        await updateQuestProposal(proposalId, {
          status: "rejected",
          rejectionReason: input.reason,
        });

        await createNotification({
          userId: proposal[0].proposedBy,
          type: "submission_rejected",
          title: "Quest Proposal Rejected",
          message: `Your quest proposal "${proposal[0].title}" was not approved.${input.reason ? ` Reason: ${input.reason}` : ""}`,
          metadata: JSON.stringify({ proposalId }),
        });

        results.push({ proposalId, success: true });
      }

      return { success: true, rejected: results.length };
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const stats = await getProposalStats();
    return stats;
  }),

  savePreset: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Preset name required"),
        difficulties: z.array(z.string()),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await saveFilterPreset(
        ctx.user.id,
        input.name,
        input.difficulties,
        input.dateFrom || "",
        input.dateTo || ""
      );
      return { success: true };
    }),

  getPresets: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getFilterPresets(ctx.user.id);
  }),

  deletePreset: protectedProcedure
    .input(z.object({ presetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await deleteFilterPreset(input.presetId, ctx.user.id);
      return { success: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  unlockables: unlockablesRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      return { success: true } as const;
    }),
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Find user by verification token
        const allUsers = await db.select().from(users);
        const user = allUsers.find((u: any) => u.emailVerificationToken === input.token);

        if (!user) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid verification token",
          });
        }

        if (user.emailVerified) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Email already verified",
          });
        }

        // Update user to mark email as verified
        await db
          .update(users)
          .set({
            emailVerified: true,
            emailVerificationToken: null,
          })
          .where(eq(users.id, user.id));

        return { success: true };
      }),
    resetPassword: publicProcedure
      .input(z.object({ token: z.string(), newPassword: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Find user by reset token
        const allUsers = await db.select().from(users);
        const user = allUsers.find((u: any) => u.passwordResetToken === input.token);

        if (!user) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid reset token",
          });
        }

        // Check if token is expired (1 hour)
        const now = new Date();
        if (user.passwordResetExpires && now > user.passwordResetExpires) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Reset token has expired",
          });
        }

        // Hash new password and update user
        const hashedPassword = await bcrypt.hash(input.newPassword, 10);
        await db
          .update(users)
          .set({
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
          })
          .where(eq(users.id, user.id));

        return { success: true };
      }),
  }),
  quest: questRouter,
  submission: submissionRouter,
  notification: notificationRouter,
  daily: dailyRouter,
  user: userRouter,
  proposal: proposalRouter,
  team: teamRouter,
});

export type AppRouter = typeof appRouter;
