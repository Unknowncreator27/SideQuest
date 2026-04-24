import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { BarChart3, Shield, X } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function AdminMetrics() {
  const { isAuthenticated, user: authUser } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading, error, refetch } = trpc.system.adminMetrics.useQuery(undefined, {
    enabled: isAuthenticated && authUser?.role === "admin",
  });

  useEffect(() => {
    if (isAuthenticated && authUser?.role === "admin") {
      void refetch();
    }
  }, [authUser, isAuthenticated, refetch]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">This admin metrics panel is hidden behind a secret keyboard shortcut.</p>
          <a href="/login">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))", color: "oklch(0.08 0.01 260)" }}>
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
          <p className="text-muted-foreground mb-6">Only admin users can open this hidden dashboard.</p>
          <button
            onClick={() => setLocation("/")}
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
    <div className="min-h-screen py-10">
      <div className="container max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border/50 bg-background/90 p-6 shadow-2xl"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                <BarChart3 size={14} /> HIDDEN METRICS
              </div>
              <h1 className="mt-4 text-3xl font-black">Admin Metrics</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                This dashboard is hidden from normal navigation and unlocked with Ctrl+Shift+F. It tracks users, quests, completed submissions, pending reviews, visitor traffic, and top performers.
              </p>
            </div>
            <button
              onClick={() => setLocation("/")}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition"
            >
              <X size={16} /> Close
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 9 }, (_, index) => (
                <div key={index} className="h-32 rounded-3xl bg-border/40 animate-pulse" />
              ))
            ) : error ? (
              <div className="col-span-full rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
                Failed to load admin metrics. {error.message}
              </div>
            ) : (
              [
                { label: "Total users", value: data?.totalUsers ?? 0 },
                { label: "Active users (30d)", value: data?.activeUsersLast30Days ?? 0 },
                { label: "Total admins", value: data?.totalAdmins ?? 0 },
                { label: "Total quests", value: data?.totalQuests ?? 0 },
                { label: "Approved submissions", value: data?.totalApprovedSubmissions ?? 0 },
                { label: "Pending reviews", value: data?.totalPendingReviews ?? 0 },
                { label: "Total requests", value: data?.network?.totalRequests ?? 0 },
                { label: "Unique visitors", value: data?.network?.uniqueVisitors ?? 0 },
                { label: "Review turnaround (hrs)", value: data?.avgReviewTurnaroundHours ?? 0 },
                { label: "Request error rate", value: `${data?.network?.requestErrorRate ?? 0}%` },
              ].map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-border/50 bg-background/80 p-5">
                  <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{metric.label}</div>
                  <div className="mt-4 text-3xl font-black">{metric.value}</div>
                </div>
              ))
            )}
          </div>

          {!isLoading && !error && data && (
            <div className="mt-8 grid gap-4 xl:grid-cols-3">
              <div className="col-span-full rounded-3xl border border-border/50 bg-background/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">Daily active users</h2>
                    <p className="text-sm text-muted-foreground">Last 7 days of signed-in activity</p>
                  </div>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.dailyActiveUsers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--muted-foreground)/15" />
                      <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)" }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="col-span-full rounded-3xl border border-border/50 bg-background/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">New signups</h2>
                    <p className="text-sm text-muted-foreground">New users created in the last 7 days</p>
                  </div>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.dailySignups}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--muted-foreground)/15" />
                      <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)" }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-border/50 bg-background/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">Request status breakdown</h2>
                    <p className="text-sm text-muted-foreground">Success vs client/server errors</p>
                  </div>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.network.requestsByStatus || {}).map(([status, value]) => ({ name: status, value }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        fill="#8884d8"
                        label
                      >
                        {Object.keys(data.network.requestsByStatus || {}).map((status, index) => (
                          <Cell key={status} fill={['#6366f1', '#0ea5e9', '#34d399', '#f59e0b', '#f97316'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-border/50 bg-background/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">Top quests by completions</h2>
                    <p className="text-sm text-muted-foreground">Most approved quest submissions</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {data.topQuestCompletions.length === 0 ? (
                    <div className="rounded-3xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
                      No quest completion data available.
                    </div>
                  ) : (
                    data.topQuestCompletions.map((quest, index) => (
                      <div key={quest.questId} className="flex items-center justify-between gap-4 rounded-3xl border border-border/50 bg-background p-4">
                        <div className="min-w-0">
                          <div className="text-sm text-muted-foreground">#{index + 1}</div>
                          <div className="truncate font-semibold text-foreground">{quest.title}</div>
                        </div>
                        <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                          {quest.completedCount}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border/50 bg-background/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">Completion difficulty spread</h2>
                    <p className="text-sm text-muted-foreground">Approved quest difficulty distribution</p>
                  </div>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(data.completionsByDifficulty).map(([difficulty, count]) => ({ difficulty, count }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--muted-foreground)/15" />
                      <XAxis dataKey="difficulty" tick={{ fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)" }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-border/50 bg-background/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">Network endpoints</h2>
                    <p className="text-sm text-muted-foreground">Highest request volume</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {data.network.topPaths.length === 0 ? (
                    <div className="rounded-3xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
                      No endpoint traffic yet.
                    </div>
                  ) : (
                    data.network.topPaths.map((row) => (
                      <div key={row.path} className="rounded-3xl border border-border/50 bg-background p-4">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="truncate">{row.path}</span>
                          <span className="font-semibold">{row.requests}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">{row.bytesTransferred.toLocaleString()} bytes</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
