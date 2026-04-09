import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Clock,
  LogIn,
  Plus,
  Search,
  Shield,
  Swords,
  X,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Difficulty = "easy" | "medium" | "hard" | "legendary";

const DIFFICULTY_INFO: Record<Difficulty, { label: string; xpRange: string; desc: string; color: string }> = {
  easy: {
    label: "EASY",
    xpRange: "10–100 XP",
    desc: "Simple, everyday tasks anyone can do",
    color: "oklch(0.72 0.22 165)",
  },
  medium: {
    label: "MEDIUM",
    xpRange: "100–500 XP",
    desc: "Requires some effort and commitment",
    color: "oklch(0.72 0.22 50)",
  },
  hard: {
    label: "HARD",
    xpRange: "500–1500 XP",
    desc: "Challenging feats that push your limits",
    color: "oklch(0.65 0.25 25)",
  },
  legendary: {
    label: "LEGENDARY",
    xpRange: "1500–5000 XP",
    desc: "Epic challenges for the truly brave",
    color: "oklch(0.65 0.25 290)",
  },
};

export default function CreateQuest() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [xpReward, setXpReward] = useState(100);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [requirementType, setRequirementType] = useState<"individual" | "team">("individual");
  const [requiredMediaCount, setRequiredMediaCount] = useState(1);
  const [duration, setDuration] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: number; name: string | null; avatarUrl: string | null; level: number; xp: number }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string | null; avatarUrl: string | null; level: number; xp: number }>>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const DURATION_OPTIONS = [
    { value: "1h", label: "1 Hour" },
    { value: "6h", label: "6 Hours" },
    { value: "24h", label: "24 Hours" },
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
  ];

  const submitProposal = trpc.proposal.submit.useMutation();
  const inviteTeamMember = trpc.team.inviteTeamMember.useMutation();
  const utils = trpc.useUtils();

  const searchUsers = trpc.team.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 && requirementType === "team" }
  );

  // Update search results when query changes
  useEffect(() => {
    if (searchUsers.data) {
      setSearchResults(
        searchUsers.data.filter((user) => !teamMembers.some((member) => member.id === user.id))
      );
    }
  }, [searchUsers.data, teamMembers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (requirementType === "team" && teamMembers.length === 0) {
      toast.error("Please add at least one team member");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitProposal.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        xpReward,
        difficulty,
      });

      // Invite team members if it's a team quest
      if (requirementType === "team" && result.proposalId) {
        for (const member of teamMembers) {
          try {
            await inviteTeamMember.mutateAsync({
              questProposalId: result.proposalId,
              invitedUserId: member.id,
            });
          } catch (err) {
            console.error(`Failed to invite ${member.name}:`, err);
          }
        }
      }

      utils.proposal.myProposals.invalidate();
      toast.success("Quest proposal submitted! Awaiting approval from the owner.", { icon: "📬" });
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const addTeamMember = (user: { id: number; name: string | null; avatarUrl: string | null; level: number; xp: number }) => {
    if (!teamMembers.some((member) => member.id === user.id)) {
      setTeamMembers([...teamMembers, user]);
      setSearchQuery("");
      setShowSearchDropdown(false);
    }
  };

  const removeTeamMember = (userId: number) => {
    setTeamMembers(teamMembers.filter((member) => member.id !== userId));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">You need to sign in to propose quests</p>
          <a href="/login">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))", color: "oklch(0.08 0.01 260)" }}>
              <LogIn size={14} />
              SIGN IN
            </button>
          </a>
        </div>
      </div>
    );
  }

  const diffInfo = DIFFICULTY_INFO[difficulty];

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "oklch(0.72 0.22 165 / 0.15)", border: "1px solid oklch(0.72 0.22 165 / 0.3)" }}>
              <Plus size={22} style={{ color: "oklch(0.72 0.22 165)" }} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-wider">PROPOSE QUEST</h1>
              <p className="text-muted-foreground text-sm">Submit your quest idea for owner approval</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Title */}
            <div className="game-card p-5">
              <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-2">
                QUEST TITLE *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Do 100 push-ups in one session"
                maxLength={255}
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 text-lg font-bold focus:outline-none border-b border-border/50 pb-2 focus:border-primary/50 transition-colors"
              />
              <div className="text-xs text-muted-foreground mt-1 text-right">{title.length}/255</div>
            </div>

            {/* Description */}
            <div className="game-card p-5">
              <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-2">
                DESCRIPTION *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what needs to be done and what counts as valid proof..."
                rows={4}
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Difficulty */}
            <div className="game-card p-5">
              <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-3">
                DIFFICULTY
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => {
                  const info = DIFFICULTY_INFO[d];
                  const isSelected = difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className="p-3 rounded-xl text-center transition-all duration-200"
                      style={{
                        background: isSelected ? `${info.color}20` : "oklch(0.14 0.015 260)",
                        border: `1px solid ${isSelected ? info.color : "oklch(0.2 0.02 260)"}`,
                        boxShadow: isSelected ? `0 0 12px ${info.color}40` : "none",
                      }}
                    >
                      <div className="text-xs font-black mb-1" style={{ color: info.color }}>
                        {info.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{info.xpRange}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{diffInfo.desc}</p>
            </div>

            {/* Requirement Type */}
            <div className="game-card p-5">
              <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-3">
                REQUIREMENT TYPE
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "individual" as const, label: "Individual", desc: "Solo completion" },
                  { value: "team" as const, label: "Team", desc: "Multiple players" },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setRequirementType(type.value)}
                    className="p-3 rounded-xl text-center transition-all duration-200"
                    style={{
                      background: requirementType === type.value ? "oklch(0.72 0.22 165 / 0.2)" : "oklch(0.14 0.015 260)",
                      border: `1px solid ${requirementType === type.value ? "oklch(0.72 0.22 165)" : "oklch(0.2 0.02 260)"}`,
                    }}
                  >
                    <div className="text-xs font-bold mb-1" style={{ color: requirementType === type.value ? "oklch(0.72 0.22 165)" : "inherit" }}>
                      {type.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Required Media Count */}
            <div className="game-card p-5">
              <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-3">
                REQUIRED MEDIA FILES
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={requiredMediaCount}
                  onChange={(e) => setRequiredMediaCount(parseInt(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <div className="text-lg font-bold w-12 text-center" style={{ color: "oklch(0.72 0.22 165)" }}>
                  {requiredMediaCount}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Players must upload {requiredMediaCount} photo(s) or video(s) as proof</p>
            </div>

            {/* Team Members (only for team quests) */}
            {requirementType === "team" && (
              <div className="game-card p-5">
                <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-3">
                  TEAM MEMBERS
                </label>

                {/* Search Input */}
                <div className="relative mb-4">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-muted-foreground/50" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder="Search players to invite..."
                      className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none border border-border/50 rounded-lg pl-9 pr-3 py-2 focus:border-primary/50 transition-colors"
                    />
                  </div>

                  {/* Search Dropdown */}
                  {showSearchDropdown && searchQuery && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border/50 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addTeamMember(user)}
                          className="w-full px-3 py-2 text-left hover:bg-primary/10 transition-colors flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {user.avatarUrl && (
                              <img
                                src={user.avatarUrl}
                                alt={user.name || "User avatar"}
                                className="w-6 h-6 rounded-full flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-xs truncate">{user.name}</div>
                              <div className="text-xs text-muted-foreground">Level {user.level}</div>
                            </div>
                          </div>
                          <Plus size={14} className="flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Team Members */}
                {teamMembers.length > 0 && (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-lg"
                        style={{ background: "oklch(0.72 0.22 165 / 0.1)", border: "1px solid oklch(0.72 0.22 165 / 0.2)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {member.avatarUrl && (
                            <img
                              src={member.avatarUrl}
                              alt={member.name || "User avatar"}
                              className="w-6 h-6 rounded-full flex-shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-xs truncate">{member.name}</div>
                            <div className="text-xs text-muted-foreground">Level {member.level}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTeamMember(member.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  {teamMembers.length === 0
                    ? "Add team members who will collaborate on this quest"
                    : `${teamMembers.length} member${teamMembers.length !== 1 ? "s" : ""} invited`}
                </p>
              </div>
            )}

            {/* Duration */}
            <div className="game-card p-5">
              <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-3">
                TIME LIMIT (Optional)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setDuration(null)}
                  className="p-2 rounded-lg text-xs font-bold transition-all duration-200"
                  style={{
                    background: duration === null ? "oklch(0.72 0.22 165 / 0.2)" : "oklch(0.14 0.015 260)",
                    border: `1px solid ${duration === null ? "oklch(0.72 0.22 165)" : "oklch(0.2 0.02 260)"}`,
                    color: duration === null ? "oklch(0.72 0.22 165)" : "inherit",
                  }}
                >
                  UNLIMITED
                </button>
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    className="p-2 rounded-lg text-xs font-bold transition-all duration-200"
                    style={{
                      background: duration === opt.value ? "oklch(0.72 0.22 165 / 0.2)" : "oklch(0.14 0.015 260)",
                      border: `1px solid ${duration === opt.value ? "oklch(0.72 0.22 165)" : "oklch(0.2 0.02 260)"}`,
                      color: duration === opt.value ? "oklch(0.72 0.22 165)" : "inherit",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* XP Reward */}
            <div className="game-card p-5">
              <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-3">
                XP REWARD
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={10}
                  max={5000}
                  step={10}
                  value={xpReward}
                  onChange={(e) => setXpReward(parseInt(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <div
                  className="text-2xl font-black w-24 text-right"
                  style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
                >
                  {xpReward} XP
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>10 XP</span>
                <span>5000 XP</span>
              </div>
            </div>

            {/* Info Box */}
            <div className="game-card p-5 border-primary/20"
              style={{ background: "oklch(0.72 0.22 165 / 0.04)" }}>
              <div className="flex gap-3">
                <div className="text-lg flex-shrink-0">📧</div>
                <div>
                  <div className="text-xs font-bold tracking-widest text-muted-foreground mb-1">APPROVAL PROCESS</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your quest proposal will be sent to the owner for review. Once approved, it will be published and available for all players to complete.
                  </p>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="game-card p-5 border-primary/20"
              style={{ background: "oklch(0.72 0.22 165 / 0.04)" }}>
              <div className="text-xs font-bold tracking-widest text-muted-foreground mb-3">PREVIEW</div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge-${difficulty}`}>{difficulty.toUpperCase()}</span>
                    {requirementType === "team" && (
                      <span className="badge-team">TEAM</span>
                    )}
                  </div>
                  <div className="font-bold text-sm">{title || "Your quest title..."}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {description || "Your quest description..."}
                  </div>
                </div>
                <div className="text-lg font-black flex-shrink-0"
                  style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}>
                  +{xpReward} XP
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim() || (requirementType === "team" && teamMembers.length === 0)}
              className="py-4 rounded-xl font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                color: "oklch(0.08 0.01 260)",
                boxShadow: "0 0 20px oklch(0.72 0.22 165 / 0.3)",
              }}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  SUBMITTING...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  SUBMIT PROPOSAL
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
