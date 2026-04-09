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
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { questProposals } from "../drizzle/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

// ─── Routers ─────────────────────────────────────────────────────────────────

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
      if (row.quest.createdBy !== ctx.user.id && ctx.user.role !== "admin") {
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

      // Decode base64 and upload to S3
      const buffer = Buffer.from(input.mediaBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "bin";
      const fileKey = `submissions/user-${ctx.user.id}/quest-${input.questId}/${randomSuffix()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      const submissionId = await createSubmission({
        questId: input.questId,
        userId: ctx.user.id,
        mediaUrl: url,
        mediaType: input.mediaType,
        mediaKey: fileKey,
        status: "pending",
      });

      return { submissionId, mediaUrl: url };
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

      const questRow = await getQuestById(sub.questId);
      if (!questRow) throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found" });
      const quest = questRow.quest;

      // Build LLM message with vision
      const isVideo = sub.mediaType === "video";
      const systemPrompt = `You are an AI quest verification system for a gamified side quest platform. 
Your job is to verify whether a user has genuinely completed a quest based on their submitted media.
Be fair but strict. Look for clear evidence that the quest was actually completed.
Always respond with valid JSON matching the schema provided.`;

      const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string }; file_url?: { url: string; mime_type: string } }> = [
        {
          type: "text",
          text: `Quest Title: "${quest.title}"\nQuest Description: "${quest.description}"\nDifficulty: ${quest.difficulty}\n\nPlease analyze the submitted ${isVideo ? "video" : "image"} and determine if it genuinely proves the user completed this quest.`,
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

      await updateSubmission(input.submissionId, {
        status: approved ? "approved" : "rejected",
        aiVerified: aiResult.verified,
        aiConfidence: aiResult.confidence,
        aiReason: aiResult.reason,
        xpAwarded: approved ? quest.xpReward : 0,
      });

      let leveledUp = false;
      let newLevel = 1;
      let newXp = 0;

      if (approved) {
        await updateQuestCompletionCount(quest.id);
        const xpResult = await addXpToUser(ctx.user.id, quest.xpReward);
        leveledUp = xpResult.leveledUp;
        newLevel = xpResult.newLevel;
        newXp = xpResult.newXp;

        // Notify the submitter
        await createNotification({
          userId: ctx.user.id,
          type: "submission_verified",
          title: "Quest Completed! 🎉",
          message: `Your submission for "${quest.title}" was verified! You earned ${quest.xpReward} XP.`,
          metadata: JSON.stringify({ questId: quest.id, xpAwarded: quest.xpReward }),
        });

        await createNotification({
          userId: ctx.user.id,
          type: "xp_gained",
          title: `+${quest.xpReward} XP Earned`,
          message: `You gained ${quest.xpReward} XP for completing "${quest.title}".`,
          metadata: JSON.stringify({ xp: quest.xpReward }),
        });

        if (leveledUp) {
          await createNotification({
            userId: ctx.user.id,
            type: "level_up",
            title: `Level Up! You're now Level ${newLevel} 🚀`,
            message: `Incredible! You've reached Level ${newLevel}. Keep completing quests to level up further!`,
            metadata: JSON.stringify({ newLevel }),
          });
        }

        // Notify quest creator if different user
        if (quest.createdBy !== ctx.user.id) {
          const submitter = await getUserById(ctx.user.id);
          await createNotification({
            userId: quest.createdBy,
            type: "quest_completed",
            title: "Your quest was completed!",
            message: `${submitter?.name ?? "A player"} completed your quest "${quest.title}".`,
            metadata: JSON.stringify({ questId: quest.id, submitterId: ctx.user.id }),
          });
        }
      } else {
        await createNotification({
          userId: ctx.user.id,
          type: "submission_rejected",
          title: "Submission Not Verified",
          message: `Your submission for "${quest.title}" was not verified. ${aiResult.reason}`,
          metadata: JSON.stringify({ questId: quest.id }),
        });
      }

      return {
        approved,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
        xpAwarded: approved ? quest.xpReward : 0,
        leveledUp,
        newLevel,
        newXp,
      };
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
  submit: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(255),
        description: z.string().min(10),
        xpReward: z.number().min(10).max(5000),
        difficulty: z.enum(["easy", "medium", "hard", "legendary"]),
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
      });

      const user = await getUserById(ctx.user.id);
      await createNotification({
        userId: 1,
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

      const questId = await createQuest({
        title: proposal[0].title,
        description: proposal[0].description,
        xpReward: proposal[0].xpReward,
        difficulty: proposal[0].difficulty,
        createdBy: proposal[0].proposedBy,
        status: "active",
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

        const questId = await createQuest({
          title: proposal[0].title,
          description: proposal[0].description,
          xpReward: proposal[0].xpReward,
          difficulty: proposal[0].difficulty,
          createdBy: proposal[0].proposedBy,
          status: "active",
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
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  quest: questRouter,
  submission: submissionRouter,
  notification: notificationRouter,
  user: userRouter,
  proposal: proposalRouter,
  team: teamRouter,
});

export type AppRouter = typeof appRouter;
