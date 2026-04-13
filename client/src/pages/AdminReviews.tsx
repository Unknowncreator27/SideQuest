import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Check, LogIn, Shield, X, Video } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function AdminReviews() {
  const { isAuthenticated, user: authUser } = useAuth();
  const [, navigate] = useLocation();
  const { data: submissions, isLoading } = trpc.submission.pending.useQuery(undefined, {
    enabled: isAuthenticated && authUser?.role === "admin",
  });
  const reviewMutation = trpc.submission.review.useMutation();
  const utils = trpc.useUtils();

  const handleReview = async (submissionId: number, approved: boolean) => {
    try {
      const result = await reviewMutation.mutateAsync({
        submissionId,
        approved,
        reason: approved ? "Approved by admin" : "Rejected by admin",
      });
      await utils.submission.pending.invalidate();
      await utils.submission.mySubmissions.invalidate();
      await utils.user.profile.invalidate();
      await utils.unlockables.myUnlockables.invalidate();
      await utils.notification.list.invalidate();
      await utils.notification.unreadCount.invalidate();
      toast.success(
        approved
          ? `Submission ${submissionId} approved. ${result.xpAwarded} XP awarded.`
          : `Submission ${submissionId} rejected.`,
        { duration: 5000 }
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to review submission");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LogIn size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">You need an account to access admin reviews.</p>
          <a href="/login">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))", color: "oklch(0.08 0.01 260)" }}>
              SIGN IN
            </button>
          </a>
        </div>
      </div>
    );
  }

  if (authUser?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">Only admins can access this page.</p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))", color: "oklch(0.08 0.01 260)" }}
          >
            BACK HOME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black mb-2">Admin Reviews</h1>
            <p className="text-sm text-muted-foreground">Review pending quest submissions and award XP manually.</p>
          </div>
          <div className="rounded-3xl border border-border/50 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            Pending submissions: {submissions?.length ?? 0}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-28 rounded-3xl bg-border/40 animate-pulse" />
            ))}
          </div>
        ) : submissions && submissions.length > 0 ? (
          <div className="space-y-5">
            {submissions.map((item) => {
              const submission = item.submission;
              const isVideo = submission.mediaType === "video";
              const isPendingMedia = submission.mediaUrl?.startsWith("pending-review://");
              return (
                <motion.div
                  key={submission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="game-card p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Submission #{submission.id}</div>
                      <h2 className="text-xl font-black">{item.quest?.title ?? "Unknown Quest"}</h2>
                      <div className="text-sm text-muted-foreground">
                        Submitted by <span className="font-semibold text-foreground">{item.user?.name ?? "Unknown"}</span>
                        {submission.teamMemberIds ? " (Team Submission)" : ""}
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Difficulty: {item.quest?.difficulty ?? "unknown"} · {submission.status.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={reviewMutation.isPending}
                        onClick={() => handleReview(submission.id, false)}
                        className="rounded-full border border-destructive/20 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 transition"
                      >
                        <X size={16} /> Reject
                      </button>
                      <button
                        type="button"
                        disabled={reviewMutation.isPending}
                        onClick={() => handleReview(submission.id, true)}
                        className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-500 hover:bg-emerald-500/20 transition"
                      >
                        <Check size={16} /> Approve
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <div className="rounded-3xl border border-border/50 bg-background/80 p-4 text-sm text-muted-foreground">
                      <div className="font-semibold text-foreground">Proof media</div>
                      {isPendingMedia ? (
                        <div className="mt-3 rounded-3xl border border-dashed border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
                          <div className="font-semibold text-foreground">Media unavailable</div>
                          <div className="mt-2">This submission has no stored media file or the upload failed. Review manually or ask the user to resubmit.</div>
                        </div>
                      ) : isVideo ? (
                        <video src={submission.mediaUrl} controls className="mt-3 w-full max-h-72 rounded-3xl object-cover" />
                      ) : (
                        <img src={submission.mediaUrl} alt="Submission proof" className="mt-3 w-full max-h-72 rounded-3xl object-cover" />
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-3xl border border-border/50 bg-background/80 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Submitted</div>
                        <div className="mt-2 text-sm text-foreground">{new Date(submission.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="rounded-3xl border border-border/50 bg-background/80 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reward</div>
                        <div className="mt-2 text-sm text-foreground">{item.quest?.xpReward ?? 0} XP</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="game-card p-10 text-center text-sm text-muted-foreground">
            <Video size={34} className="mx-auto mb-4 text-muted-foreground/70" />
            <div className="font-bold text-lg mb-2">No pending reviews yet</div>
            <div>All submissions have been processed or there are no pending uploads.</div>
          </div>
        )}
      </div>
    </div>
  );
}
