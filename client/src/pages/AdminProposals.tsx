import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock,
  LogIn,
  Shield,
  Trash2,
  XCircle,
  Zap,
  Check,
  X,
  Save,
  Bookmark,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export default function AdminProposals() {
  const { isAuthenticated, user: authUser } = useAuth();
  const [, navigate] = useLocation();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkRejectMode, setBulkRejectMode] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [presetName, setPresetName] = useState<string>("");
  const [showPresetInput, setShowPresetInput] = useState(false);

  const { data: proposals, isLoading } = trpc.proposal.pending.useQuery(undefined, {
    enabled: isAuthenticated && authUser?.role === "admin",
  });

  const { data: stats } = trpc.proposal.stats.useQuery(undefined, {
    enabled: isAuthenticated && authUser?.role === "admin",
    refetchInterval: 60000,
  });

  const { data: presets } = trpc.proposal.getPresets.useQuery(undefined, {
    enabled: isAuthenticated && authUser?.role === "admin",
  });

  // Filter proposals
  const filteredProposals = useMemo(() => {
    if (!proposals) return [];
    return proposals.filter((item) => {
      const proposal = item.proposal;
      // Difficulty filter
      if (selectedDifficulties.size > 0 && !selectedDifficulties.has(proposal.difficulty)) {
        return false;
      }
      // Date range filter
      if (dateFrom || dateTo) {
        const proposalDate = new Date(proposal.createdAt).toISOString().split('T')[0];
        if (dateFrom && proposalDate < dateFrom) return false;
        if (dateTo && proposalDate > dateTo) return false;
      }
      return true;
    });
  }, [proposals, selectedDifficulties, dateFrom, dateTo]);

  const toggleDifficulty = (difficulty: string) => {
    const newDifficulties = new Set(selectedDifficulties);
    if (newDifficulties.has(difficulty)) {
      newDifficulties.delete(difficulty);
    } else {
      newDifficulties.add(difficulty);
    }
    setSelectedDifficulties(newDifficulties);
  };

  const clearFilters = () => {
    setSelectedDifficulties(new Set());
    setDateFrom("");
    setDateTo("");
  };

  const getProposalDurationLabel = (duration?: string | null) => {
    if (!duration || duration === "none") return "None";
    switch (duration) {
      case "1h": return "1 hr";
      case "6h": return "6 hrs";
      case "24h": return "24 hrs";
      case "7d": return "7 days";
      case "30d": return "30 days";
      default: return duration;
    }
  };

  const approveMutation = trpc.proposal.approve.useMutation();
  const rejectMutation = trpc.proposal.reject.useMutation();
  const bulkApproveMutation = trpc.proposal.bulkApprove.useMutation();
  const bulkRejectMutation = trpc.proposal.bulkReject.useMutation();
  const savePresetMutation = trpc.proposal.savePreset.useMutation();
  const deletePresetMutation = trpc.proposal.deletePreset.useMutation();
  const utils = trpc.useUtils();

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }
    try {
      await savePresetMutation.mutateAsync({
        name: presetName,
        difficulties: Array.from(selectedDifficulties),
        dateFrom,
        dateTo,
      });
      utils.proposal.getPresets.invalidate();
      setPresetName("");
      setShowPresetInput(false);
      toast.success("Preset saved!", { icon: "💾" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save preset");
    }
  };

  const handleLoadPreset = (preset: any) => {
    setSelectedDifficulties(new Set(preset.difficulties));
    setDateFrom(preset.dateFrom || "");
    setDateTo(preset.dateTo || "");
    toast.success(`Loaded preset: ${preset.name}`, { icon: "✅" });
  };

  const handleDeletePreset = async (presetId: number) => {
    try {
      await deletePresetMutation.mutateAsync({ presetId });
      utils.proposal.getPresets.invalidate();
      toast.success("Preset deleted", { icon: "🗑️" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete preset");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">You need to sign in</p>
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

  if (authUser?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">Only admins can access this page</p>
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

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (!proposals) return;
    if (selectedIds.size === proposals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(proposals.map(p => p.proposal.id)));
    }
  };

  const handleApprove = async (proposalId: number) => {
    try {
      await approveMutation.mutateAsync({ proposalId });
      utils.proposal.pending.invalidate();
      toast.success("Quest approved and published! User notified.", { icon: "✅" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to approve proposal");
    }
  };

  const handleReject = async (proposalId: number) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      await rejectMutation.mutateAsync({ proposalId, reason: rejectReason });
      utils.proposal.pending.invalidate();
      setRejectingId(null);
      setRejectReason("");
      toast.success("Proposal rejected. User notified.", { icon: "❌" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reject proposal");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select proposals to approve");
      return;
    }
    try {
      await bulkApproveMutation.mutateAsync({ proposalIds: Array.from(selectedIds) });
      utils.proposal.pending.invalidate();
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} proposals approved and published! Users notified.`, { icon: "✅" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to approve proposals");
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select proposals to reject");
      return;
    }
    if (!bulkRejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      await bulkRejectMutation.mutateAsync({ proposalIds: Array.from(selectedIds), reason: bulkRejectReason });
      utils.proposal.pending.invalidate();
      setSelectedIds(new Set());
      setBulkRejectMode(false);
      setBulkRejectReason("");
      toast.success(`${selectedIds.size} proposals rejected. Users notified.`, { icon: "❌" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reject proposals");
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
          >
            ← BACK TO DASHBOARD
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "oklch(0.72 0.22 165 / 0.15)", border: "1px solid oklch(0.72 0.22 165 / 0.3)" }}>
              <Zap size={22} style={{ color: "oklch(0.72 0.22 165)" }} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-wider">MANAGE PROPOSALS</h1>
              <p className="text-muted-foreground text-sm">Review and approve quest proposals from your community</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Dashboard */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="game-card p-4" style={{ background: "oklch(0.72 0.22 165 / 0.08)", border: "1px solid oklch(0.72 0.22 165 / 0.2)" }}>
              <div className="text-xs text-muted-foreground font-bold tracking-widest mb-2">TOTAL</div>
              <div className="text-3xl font-black" style={{ color: "oklch(0.72 0.22 165)" }}>{stats.total}</div>
            </div>
            <div className="game-card p-4" style={{ background: "oklch(0.65 0.22 240 / 0.08)", border: "1px solid oklch(0.65 0.22 240 / 0.2)" }}>
              <div className="text-xs text-muted-foreground font-bold tracking-widest mb-2">PENDING</div>
              <div className="text-3xl font-black" style={{ color: "oklch(0.65 0.22 240)" }}>{stats.pending}</div>
            </div>
            <div className="game-card p-4" style={{ background: "oklch(0.70 0.22 142 / 0.08)", border: "1px solid oklch(0.70 0.22 142 / 0.2)" }}>
              <div className="text-xs text-muted-foreground font-bold tracking-widest mb-2">APPROVAL RATE</div>
              <div className="text-3xl font-black" style={{ color: "oklch(0.70 0.22 142)" }}>{stats.approvalRate}%</div>
            </div>
            <div className="game-card p-4" style={{ background: "oklch(0.68 0.22 45 / 0.08)", border: "1px solid oklch(0.68 0.22 45 / 0.2)" }}>
              <div className="text-xs text-muted-foreground font-bold tracking-widest mb-2">AVG REVIEW TIME</div>
              <div className="text-3xl font-black" style={{ color: "oklch(0.68 0.22 45)" }}>{stats.avgReviewTime}h</div>
            </div>
          </motion.div>
        )}

        {/* Presets Panel */}
        {presets && presets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 game-card p-4"
            style={{ background: "oklch(0.65 0.22 240 / 0.08)", border: "1px solid oklch(0.65 0.22 240 / 0.2)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bookmark size={16} style={{ color: "oklch(0.65 0.22 240)" }} />
                <span className="text-xs font-bold tracking-widest text-muted-foreground">SAVED PRESETS</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{ background: "oklch(0.65 0.22 240 / 0.15)", border: "1px solid oklch(0.65 0.22 240 / 0.3)" }}>
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    {preset.name}
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Filter Panel */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 game-card p-4"
          style={{ background: "oklch(0.08 0.01 260 / 0.4)", border: "1px solid oklch(0.72 0.22 165 / 0.2)" }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-muted-foreground">FILTERS</span>
              <div className="flex items-center gap-2">
                {(selectedDifficulties.size > 0 || dateFrom || dateTo) && (
                  <>
                    <button
                      onClick={() => setShowPresetInput(!showPresetInput)}
                      className="text-xs text-primary hover:text-primary/80 transition-colors font-bold flex items-center gap-1"
                    >
                      <Save size={12} /> SAVE
                    </button>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors font-bold"
                    >
                      CLEAR ALL
                    </button>
                  </>
                )}
              </div>
            </div>

            {showPresetInput && (selectedDifficulties.size > 0 || dateFrom || dateTo) && (
              <div className="flex gap-2 items-center mt-3 pb-3 border-b border-border/30">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-background border border-border/50 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={savePresetMutation.isPending || !presetName.trim()}
                  className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "oklch(0.72 0.22 165)", color: "oklch(0.08 0.01 260)" }}
                >
                  {savePresetMutation.isPending ? "SAVING..." : "SAVE"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Difficulty Filter */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-2 block">DIFFICULTY</label>
                <div className="flex flex-wrap gap-2">
                  {["easy", "medium", "hard", "legendary"].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => toggleDifficulty(diff)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedDifficulties.has(diff)
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      style={{
                        background: selectedDifficulties.has(diff)
                          ? diff === "easy"
                            ? "oklch(0.70 0.22 142 / 0.3)"
                            : diff === "medium"
                            ? "oklch(0.68 0.22 45 / 0.3)"
                            : diff === "hard"
                            ? "oklch(0.65 0.25 25 / 0.3)"
                            : "oklch(0.60 0.25 0 / 0.3)"
                          : "oklch(0.08 0.01 260 / 0.3)",
                        border: selectedDifficulties.has(diff)
                          ? diff === "easy"
                            ? "1px solid oklch(0.70 0.22 142 / 0.5)"
                            : diff === "medium"
                            ? "1px solid oklch(0.68 0.22 45 / 0.5)"
                            : diff === "hard"
                            ? "1px solid oklch(0.65 0.25 25 / 0.5)"
                            : "1px solid oklch(0.60 0.25 0 / 0.5)"
                          : "1px solid oklch(0.72 0.22 165 / 0.2)",
                      }}
                    >
                      {diff.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date From */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-2 block">FROM DATE</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-background border border-border/50 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-2 block">TO DATE</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-background border border-border/50 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {(selectedDifficulties.size > 0 || dateFrom || dateTo) && (
              <div className="text-xs text-muted-foreground">
                Showing {filteredProposals.length} of {proposals?.length} proposals
              </div>
            )}
          </div>
        </motion.div>

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 game-card p-4 flex items-center justify-between gap-4"
            style={{ background: "oklch(0.72 0.22 165 / 0.08)", border: "1px solid oklch(0.72 0.22 165 / 0.2)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{selectedIds.size} selected</span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                (clear)
              </button>
            </div>

            {bulkRejectMode ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  placeholder="Rejection reason for all..."
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none border-b border-border/50 pb-1 focus:border-primary/50 transition-colors"
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              {bulkRejectMode ? (
                <>
                  <button
                    onClick={handleBulkReject}
                    disabled={bulkRejectMutation.isPending || !bulkRejectReason.trim()}
                    className="py-1.5 px-3 rounded-lg font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: "oklch(0.65 0.25 25)",
                      color: "oklch(0.08 0.01 260)",
                    }}
                  >
                    {bulkRejectMutation.isPending ? (
                      <>
                        <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
                        REJECTING...
                      </>
                    ) : (
                      <>
                        <X size={12} />
                        REJECT ALL
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setBulkRejectMode(false);
                      setBulkRejectReason("");
                    }}
                    className="py-1.5 px-3 rounded-lg font-bold text-xs transition-all"
                    style={{ background: "oklch(0.14 0.015 260)", color: "oklch(0.55 0.01 260)" }}
                  >
                    CANCEL
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkApproveMutation.isPending}
                    className="py-1.5 px-3 rounded-lg font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                      color: "oklch(0.08 0.01 260)",
                    }}
                  >
                    {bulkApproveMutation.isPending ? (
                      <>
                        <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
                        APPROVING...
                      </>
                    ) : (
                      <>
                        <Check size={12} />
                        APPROVE ALL
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setBulkRejectMode(true)}
                    className="py-1.5 px-3 rounded-lg font-bold text-xs transition-all"
                    style={{ background: "oklch(0.14 0.015 260)", color: "oklch(0.65 0.25 25)" }}
                  >
                    <X size={12} />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Select All Checkbox */}
        {!isLoading && proposals && proposals.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.size === proposals.length && proposals.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded cursor-pointer accent-primary"
            />
            <span className="text-xs text-muted-foreground font-semibold">
              {selectedIds.size === proposals.length ? "DESELECT ALL" : "SELECT ALL"}
            </span>
          </div>
        )}

        {/* Proposals List */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="game-card p-6 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : !proposals || proposals.length === 0 ? (
          <div className="text-center py-16 game-card">
            <CheckCircle size={40} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground mb-2">No Pending Proposals</h3>
            <p className="text-sm text-muted-foreground/60">All quest proposals have been reviewed!</p>
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="text-center py-16 game-card">
            <CheckCircle size={40} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground mb-2">No Matching Proposals</h3>
            <p className="text-sm text-muted-foreground/60">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredProposals.map((row, i) => {
              const proposal = row.proposal;
              const proposer = row.proposer;
              const isSelected = selectedIds.has(proposal.id);
              const isRejecting = rejectingId === proposal.id;

              return (
                <motion.div
                  key={proposal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="game-card p-6 flex gap-4"
                  style={{
                    background: isSelected ? "oklch(0.72 0.22 165 / 0.08)" : undefined,
                    borderColor: isSelected ? "oklch(0.72 0.22 165 / 0.3)" : undefined,
                  }}
                >
                  {/* Checkbox */}
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(proposal.id)}
                      className="w-4 h-4 rounded cursor-pointer accent-primary"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold">{proposal.title}</h3>
                          <span className={`badge-${proposal.difficulty}`}>
                            {proposal.difficulty.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{proposal.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Proposed by <strong>{proposer.name || "Unknown"}</strong></span>
                          <span>•</span>
                          <span>
                            {new Date(proposal.createdAt).toLocaleDateString()}
                          </span>
                          {proposal.duration != null && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="px-2 py-1 rounded-full border text-[11px] tracking-[0.2em] font-bold uppercase bg-emerald-500/10 text-emerald-300 border-emerald-500/20 cursor-help">
                                  TIME LIMIT
                                </span>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={4} className="bg-background text-foreground">
                                {getProposalDurationLabel(proposal.duration)}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>

                      {/* XP Badge */}
                      <div
                        className="text-2xl font-black flex-shrink-0"
                        style={{ fontFamily: "Orbitron, monospace", color: "oklch(0.72 0.22 165)" }}
                      >
                        +{proposal.xpReward} XP
                      </div>
                    </div>

                    {/* Rejection Form */}
                    {isRejecting ? (
                      <div className="mb-4 p-4 rounded-xl" style={{ background: "oklch(0.65 0.25 25 / 0.1)", border: "1px solid oklch(0.65 0.25 25 / 0.2)" }}>
                        <label className="block text-xs font-bold tracking-widest text-muted-foreground mb-2">
                          REJECTION REASON
                        </label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explain why this proposal was rejected..."
                          rows={2}
                          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none resize-none leading-relaxed border-b border-border/50 pb-2 focus:border-primary/50 transition-colors"
                        />
                      </div>
                    ) : null}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isRejecting ? (
                        <>
                          <button
                            onClick={() => handleReject(proposal.id)}
                            disabled={rejectMutation.isPending || !rejectReason.trim()}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: "oklch(0.65 0.25 25)",
                              color: "oklch(0.08 0.01 260)",
                            }}
                          >
                            {rejectMutation.isPending ? (
                              <>
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                REJECTING...
                              </>
                            ) : (
                              <>
                                <XCircle size={14} />
                                CONFIRM REJECT
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason("");
                            }}
                            className="py-2.5 px-4 rounded-xl font-bold text-sm transition-all"
                            style={{ background: "oklch(0.14 0.015 260)", color: "oklch(0.55 0.01 260)" }}
                          >
                            CANCEL
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(proposal.id)}
                            disabled={approveMutation.isPending}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                              color: "oklch(0.08 0.01 260)",
                            }}
                          >
                            {approveMutation.isPending ? (
                              <>
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                APPROVING...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={14} />
                                APPROVE & PUBLISH
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setRejectingId(proposal.id)}
                            className="py-2.5 px-4 rounded-xl font-bold text-sm transition-all"
                            style={{ background: "oklch(0.14 0.015 260)", color: "oklch(0.65 0.25 25)" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
