import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Shield, LogIn, UserPlus, ShieldCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function AdminUsers() {
  const { isAuthenticated, user: authUser } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = trpc.user.listAll.useQuery(undefined, {
    enabled: isAuthenticated && authUser?.role === "admin",
  });
  const setRoleMutation = trpc.user.setRole.useMutation();
  const utils = trpc.useUtils();

  const filteredUsers = (users ?? []).filter((user) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      String(user.id).includes(term)
    );
  });

  const handleRoleToggle = async (userId: number, currentRole: string) => {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    const confirmMessage =
      nextRole === "admin"
        ? "Promote this user to admin?"
        : "Remove admin rights from this user?";

    if (!window.confirm(confirmMessage)) return;

    try {
      await setRoleMutation.mutateAsync({ userId, role: nextRole as "user" | "admin" });
      toast.success(`Role updated to ${nextRole}`);
      utils.user.listAll.invalidate();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update role");
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
              <LogIn size={14} /> SIGN IN
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
          <p className="text-muted-foreground mb-6">Only admins can manage admin accounts</p>
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
      <div className="container max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin Users</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Promote trusted users to admin and remove admin access when needed. Only admins can perform this action.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row items-stretch sm:items-center">
              <button
                onClick={() => navigate("/admin/proposals")}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid oklch(0.72 0.22 165 / 0.25)", color: "white" }}
              >
                <ShieldCheck size={16} /> Review Proposals
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, or ID"
                className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground">Admin controls</div>
              <div className="mt-2 flex items-center gap-2">
                <UserPlus size={16} /> Promote to admin
              </div>
              <div className="mt-2 flex items-center gap-2">
                <UserX size={16} /> Remove admin access
              </div>
            </div>
          </div>
        </motion.div>

        <div className="overflow-hidden rounded-3xl border border-border bg-background/80 shadow-2xl">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="px-4 py-4 font-medium">ID</th>
                <th className="px-4 py-4 font-medium">Name</th>
                <th className="px-4 py-4 font-medium">Email</th>
                <th className="px-4 py-4 font-medium">Role</th>
                <th className="px-4 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isOwner = user.email === "admin@sidequest.local";
                  const isCurrentAdmin = user.role === "admin";
                  return (
                    <tr key={user.id} className="border-t border-border/50">
                      <td className="px-4 py-4 text-xs text-muted-foreground">{user.id}</td>
                      <td className="px-4 py-4 font-semibold">{user.name || "Unnamed"}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{user.email || "—"}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                          isCurrentAdmin ? "bg-primary/10 text-primary" : "bg-foreground/5 text-muted-foreground"
                        }`}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleRoleToggle(user.id, user.role)}
                          disabled={isOwner || setRoleMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold transition-colors"
                          style={{
                            background: isCurrentAdmin ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                            color: isCurrentAdmin ? "rgb(248 113 113)" : "rgb(134 239 172)",
                          }}
                        >
                          {isCurrentAdmin ? <UserX size={14} /> : <UserPlus size={14} />}
                          {isCurrentAdmin ? "Revoke" : "Promote"}
                        </button>
                        {isOwner && (
                          <div className="mt-2 text-[11px] text-muted-foreground">Owner account</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
