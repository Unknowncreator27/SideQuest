import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Brain,
  CheckCircle,
  Clock,
  Image,
  LogIn,
  Swords,
  Trophy,
  Upload,
  Users,
  Video,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

function QuestCountdown({ expiresAt }: { expiresAt: Date | null }) {
  if (!expiresAt) return null;
  const now = new Date();
  const diff = new Date(expiresAt).getTime() - now.getTime();
  if (diff <= 0) return (
    <div className="flex items-center gap-1.5 text-destructive text-sm font-semibold">
      <Clock size={14} /> QUEST EXPIRED
    </div>
  );
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const isUrgent = diff < 3600000 * 2;
  return (
    <div className={`flex items-center gap-1.5 text-sm font-semibold ${isUrgent ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
      <Clock size={14} />
      Expires in {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
    </div>
  );
}

type VerifyResult = {
  approved: boolean;
  confidence: number;
  reason: string;
  xpAwarded: number;
  leveledUp: boolean;
  newLevel: number;
  newXp: number;
};

export default function QuestDetail() {
  const params = useParams<{ id: string }>();
  const questId = parseInt(params.id ?? "0");
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: questRow, isLoading } = trpc.quest.get.useQuery(
    { id: questId },
    { enabled: !!questId }
  );
  const { data: mySubmissions } = trpc.submission.mySubmissions.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const uploadMedia = trpc.submission.uploadMedia.useMutation();
  const verifySubmission = trpc.submission.verify.useMutation();
  const utils = trpc.useUtils();

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const alreadyCompleted = mySubmissions?.some(
    (s) => s.submission.questId === questId && s.submission.status === "approved"
  );
  const pendingSubmission = mySubmissions?.find(
    (s) => s.submission.questId === questId && s.submission.status === "pending"
  );

  const handleFile = useCallback((f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      toast.error("File too large. Max 50MB.");
      return;
    }
    if (!questRow) return;
    const maxFiles = questRow.quest.requiredMediaCount || 1;
    if (files.length >= maxFiles) {
      toast.error(`Maximum ${maxFiles} file(s) allowed for this quest`);
      return;
    }
    setFiles([...files, f]);
    setVerifyResult(null);
    const url = URL.createObjectURL(f);
    setPreviews([...previews, url]);
  }, [files, previews, questRow]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      Array.from(e.dataTransfer.files).forEach(f => handleFile(f));
    },
    [handleFile]
  );

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleSubmit = async () => {
    if (files.length === 0 || !questRow) return;
    const maxFiles = questRow.quest.requiredMediaCount || 1;
    if (files.length !== maxFiles) {
      toast.error(`Please upload exactly ${maxFiles} file(s)`);
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round((i / files.length) * 100));
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        const isVid = file.type.startsWith("video/");
        const { submissionId } = await uploadMedia.mutateAsync({
          questId,
          mediaBase64: base64,
          mediaType: isVid ? "video" : "image",
          mimeType: file.type,
          fileName: file.name,
        });
        if (i === files.length - 1) {
          setUploadProgress(100);
        }
      }
      setUploading(false);
      setVerifying(true);
      const result = await verifySubmission.mutateAsync({ submissionId: 0 });
      setVerifyResult(result);
      utils.submission.mySubmissions.invalidate();
      utils.user.profile.invalidate();
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();

        if (result.approved) {
          toast.success(`Quest verified! +${result.xpAwarded} XP earned!`, {
            duration: 5000,
            icon: "⚡",
          });
          if (result.leveledUp) {
            setTimeout(() => {
              toast.success(`LEVEL UP! You're now Level ${result.newLevel}! 🚀`, {
                duration: 6000,
                icon: "🚀",
              });
            }, 1500);
          }
          setFiles([]);
          setPreviews([]);
        } else {
          toast.error("Submission not verified. Try again with better proof!", {
            duration: 5000,
          });
        }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setUploading(false);
      setVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container max-w-2xl">
          <div className="game-card p-8 animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4" />
            <div className="h-6 bg-muted rounded mb-2" />
            <div className="h-4 bg-muted rounded w-4/5 mb-1" />
            <div className="h-4 bg-muted rounded w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!questRow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Swords size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Quest Not Found</h2>
          <button onClick={() => navigate("/quests")} className="btn-game px-5 py-2 text-sm mt-4">
            BACK TO QUESTS
          </button>
        </div>
      </div>
    );
  }

  const quest = questRow.quest;
  const creator = questRow.creator;
  const isExpired = quest.status === "expired";

  return (
    <div className="min-h-screen py-8">
      <div className="container max-w-2xl">
        {/* Back */}
        <button
          onClick={() => navigate("/quests")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        >
          ← BACK TO QUESTS
        </button>

        {/* Quest Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="game-card p-6 mb-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge-${quest.difficulty}`}>{quest.difficulty.toUpperCase()}</span>
              {isExpired && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                  EXPIRED
                </span>
              )}
            </div>
            <div
              className="text-2xl font-black"
              style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
            >
              +{quest.xpReward} XP
            </div>
          </div>

          <h1 className="text-3xl font-black mb-3">{quest.title}</h1>
          <p className="text-muted-foreground leading-relaxed mb-4">{quest.description}</p>

          {/* Requirements */}
          <div className="flex items-center gap-3 mb-4 text-xs">
            {quest.requirementType === "team" && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <Users size={12} />
                TEAM QUEST
              </span>
            )}
            {quest.requirementType === "individual" && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30">
                <Swords size={12} />
                SOLO QUEST
              </span>
            )}
            {quest.requiredMediaCount && quest.requiredMediaCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                📸 {quest.requiredMediaCount} FILE{quest.requiredMediaCount > 1 ? "S" : ""} REQUIRED
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t border-border/50">
            {creator?.name && (
              <span className="flex items-center gap-1.5">
                <Users size={13} /> Created by {creator.name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Trophy size={13} /> {quest.completionCount} completions
            </span>
            {quest.expiresAt && <QuestCountdown expiresAt={quest.expiresAt} />}
          </div>
        </motion.div>

        {/* Already completed */}
        {alreadyCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-xl mb-6 flex items-center gap-3"
            style={{ background: "oklch(0.72 0.22 165 / 0.1)", border: "1px solid oklch(0.72 0.22 165 / 0.3)" }}
          >
            <CheckCircle size={24} style={{ color: "oklch(0.72 0.22 165)" }} />
            <div>
              <div className="font-bold text-sm" style={{ color: "oklch(0.72 0.22 165)" }}>Quest Completed!</div>
              <div className="text-xs text-muted-foreground">You've already verified this quest.</div>
            </div>
          </motion.div>
        )}

        {/* Verification Result */}
        <AnimatePresence>
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-6 rounded-xl mb-6"
              style={{
                background: verifyResult.approved
                  ? "oklch(0.72 0.22 165 / 0.1)"
                  : "oklch(0.65 0.25 25 / 0.1)",
                border: `1px solid ${verifyResult.approved ? "oklch(0.72 0.22 165 / 0.4)" : "oklch(0.65 0.25 25 / 0.4)"}`,
              }}
            >
              <div className="flex items-start gap-3">
                {verifyResult.approved ? (
                  <CheckCircle size={28} style={{ color: "oklch(0.72 0.22 165)" }} className="flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={28} style={{ color: "oklch(0.65 0.25 25)" }} className="flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-black text-lg mb-1">
                    {verifyResult.approved ? "QUEST VERIFIED! 🎉" : "NOT VERIFIED"}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{verifyResult.reason}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Brain size={13} className="text-muted-foreground" />
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-bold">{Math.round(verifyResult.confidence * 100)}%</span>
                    </span>
                    {verifyResult.approved && (
                      <span className="flex items-center gap-1.5" style={{ color: "oklch(0.72 0.22 165)" }}>
                        <Zap size={13} />
                        <span className="font-black">+{verifyResult.xpAwarded} XP</span>
                      </span>
                    )}
                  </div>
                  {verifyResult.leveledUp && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-3 p-3 rounded-lg text-center font-black text-lg"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.65 0.25 290 / 0.2), oklch(0.72 0.22 165 / 0.2))",
                        border: "1px solid oklch(0.65 0.25 290 / 0.4)",
                        color: "oklch(0.65 0.25 290)",
                      }}
                    >
                      🚀 LEVEL UP! You're now Level {verifyResult.newLevel}!
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Section */}
        {!alreadyCompleted && !isExpired && isAuthenticated && !verifyResult?.approved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="game-card p-6"
          >
            <h2 className="text-xl font-black tracking-wider mb-2">SUBMIT PROOF</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Upload {questRow?.quest.requiredMediaCount || 1} photo(s) or video(s) proving you completed this quest. Our AI will verify your submission.
            </p>

            {/* Upload Progress */}
            {files.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                <div className="text-xs font-bold mb-2">UPLOADED: {files.length} of {questRow?.quest.requiredMediaCount || 1}</div>
                <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(files.length / (questRow?.quest.requiredMediaCount || 1)) * 100}%`,
                      background: "linear-gradient(90deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                    onChange={(e) => {
                    Array.from(e.target.files || []).forEach(f => handleFile(f));
                  }}
                  multiple
                />

                {previews.length > 0 ? (
                  <div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {previews.map((preview, idx) => {
                        const isVid = files[idx]?.type.startsWith("video/");
                        return (
                          <div key={idx} className="relative group">
                            {isVid ? (
                              <video
                                src={preview}
                                className="w-full h-32 rounded-lg object-cover"
                              />
                            ) : (
                              <img
                                src={preview}
                                alt={`Preview ${idx + 1}`}
                                className="w-full h-32 rounded-lg object-cover"
                              />
                            )}
                            <button
                              onClick={() => removeFile(idx)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {previews.map((_, idx) => `${((files[idx]?.size ?? 0) / 1024 / 1024).toFixed(1)} MB`).join(" + ")}
                    </div>
                    <div className="text-xs text-primary mt-1">Click to add more files</div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-center gap-3 mb-3 text-muted-foreground">
                      <Image size={24} />
                      <Video size={24} />
                    </div>
                    <div className="font-bold text-sm mb-1">Drop your proof here</div>
                    <div className="text-xs text-muted-foreground">
                      Supports images and videos up to 50MB
                    </div>
                  </div>
                )}
            </div>

            {/* Submit Button */}
            {files.length > 0 && !uploading && !verifying && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleSubmit}
                className="w-full mt-4 py-3 rounded-xl font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all"
                style={{
                  background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                  color: "oklch(0.08 0.01 260)",
                  boxShadow: "0 0 20px oklch(0.72 0.22 165 / 0.3)",
                }}
              >
                <Upload size={16} />
                SUBMIT FOR VERIFICATION
              </motion.button>
            )}

            {/* Loading States */}
            {uploading && (
              <div className="mt-4 py-3 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center gap-3">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold text-primary">Uploading proof to secure storage...</span>
              </div>
            )}

            {verifying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 py-4 rounded-xl border border-accent/30 bg-accent/10 flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-3">
                  <Brain size={20} style={{ color: "oklch(0.65 0.25 290)" }} className="animate-pulse" />
                  <span className="text-sm font-bold" style={{ color: "oklch(0.65 0.25 290)" }}>
                    AI is analyzing your submission...
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">This may take a few seconds</div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: "oklch(0.65 0.25 290)" }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Expired message */}
        {isExpired && (
          <div className="game-card p-6 text-center">
            <Clock size={32} className="mx-auto text-destructive/50 mb-3" />
            <h3 className="text-lg font-bold text-muted-foreground mb-1">Quest Expired</h3>
            <p className="text-sm text-muted-foreground/60">This quest is no longer accepting submissions.</p>
          </div>
        )}

        {/* Login prompt */}
        {!isAuthenticated && !isExpired && (
          <div className="game-card p-6 text-center">
            <LogIn size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-bold mb-2">Sign In to Complete This Quest</h3>
            <p className="text-sm text-muted-foreground mb-4">You need an account to submit proof and earn XP</p>
            <a href={getLoginUrl()}>
              <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))", color: "oklch(0.08 0.01 260)" }}>
                <Zap size={14} />
                SIGN IN TO PLAY
              </button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
