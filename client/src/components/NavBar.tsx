import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Check,
  Compass,
  Crown,
  LogIn,
  Menu,
  Plus,
  Settings,
  Shield,
  Swords,
  User,
  X,
  Zap,
  ClipboardList,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return <span className={`badge-${difficulty}`}>{difficulty.toUpperCase()}</span>;
}

function XPBar({ xp, level, currentLevelXp, nextLevelXp }: { xp: number; level: number; currentLevelXp: number; nextLevelXp: number }) {
  const progress = nextLevelXp > currentLevelXp
    ? ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
    : 100;

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-mono text-primary font-bold">LV.{level}</div>
      <div className="w-20 xp-bar">
        <div className="xp-bar-fill" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <div className="text-xs text-muted-foreground font-mono">{xp} XP</div>
    </div>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications } = trpc.notification.list.useQuery();
  const markRead = trpc.notification.markAllRead.useMutation();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const handleMarkRead = () => {
    markRead.mutate(undefined, {
      onSuccess: () => utils.notification.list.invalidate(),
    });
  };

  const typeIcon: Record<string, string> = {
    xp_gained: "⚡",
    level_up: "🚀",
    quest_completed: "🎯",
    submission_verified: "✅",
    submission_rejected: "❌",
    milestone: "🏆",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden"
      style={{ boxShadow: "0 8px 32px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.72 0.22 165 / 0.1)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display font-bold text-sm tracking-wide">NOTIFICATIONS</span>
        <button
          onClick={handleMarkRead}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Mark all read
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {!notifications || notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setLocation(`/notifications?selectedId=${n.id}`);
                onClose();
              }}
              className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${
                !n.read ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{typeIcon[n.type] ?? "📢"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">{n.title}</span>
                    {!n.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: profile } = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });
  const { data: pendingProposals } = trpc.proposal.pending.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 30000,
  });
  const { data: pendingReviewCount } = trpc.submission.pending.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 30000,
    select: (data) => data.length,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const shopUnlocked = isAuthenticated && profile?.level != null && profile.level >= 5;

  const navLinks = [
    { href: "/quests", label: "QUESTS", icon: <Compass size={15} /> },
    { href: "/leaderboard", label: "RANKINGS", icon: <Crown size={15} /> },
    ...(isAuthenticated ? [
      { href: "/dashboard", label: "DASHBOARD", icon: <User size={15} /> },
      ...(shopUnlocked ? [{ href: "/shop", label: "SHOP", icon: <Zap size={15} /> }] : []),
      { href: "/notifications", label: "NOTIFS", icon: <Bell size={15} /> },
    ] : []),
    ...(isAuthenticated && user?.role === "admin" ? [
      { href: "/admin/proposals", label: "PROPOSALS", icon: <ClipboardList size={15} /> },
      { href: "/admin/reviews", label: "REVIEWS", icon: <Check size={15} /> },
      { href: "/admin/users", label: "ADMINS", icon: <Shield size={15} /> },
    ] : []),
  ];

  const isActive = (href: string) => location === href || (href !== "/" && location.startsWith(href));

  return (
    <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 group">
              <div className="relative">
                <Swords
                  size={22}
                  className="text-primary transition-transform group-hover:rotate-12 duration-300"
                />
                <div className="absolute inset-0 blur-sm opacity-60 text-primary">
                  <Swords size={22} className="text-primary" />
                </div>
              </div>
              <span
                className="text-xl font-bold tracking-wider"
                style={{
                  fontFamily: "Orbitron, monospace",
                  background: "linear-gradient(135deg, oklch(0.72 0.22 165), oklch(0.65 0.22 240))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                SIDE QUEST
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const pendingCount =
                link.href === "/admin/proposals"
                  ? (pendingProposals?.length ?? 0)
                  : link.href === "/admin/reviews"
                  ? (pendingReviewCount ?? 0)
                  : 0;
              return (
                <Link key={link.href} href={link.href}>
                  <div
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-all duration-200 ${
                      isActive(link.href)
                        ? "text-primary bg-primary/10 border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                    {pendingCount > 0 && (
                      <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated && profile && (
              <div className="hidden sm:block">
                <XPBar
                  xp={profile.xp ?? 0}
                  level={profile.level ?? 1}
                  currentLevelXp={profile.currentLevelXp}
                  nextLevelXp={profile.nextLevelXp}
                />
              </div>
            )}

            {isAuthenticated && user?.role === "admin" && (pendingProposals?.length ?? 0) > 0 && (
              <Link href="/admin/proposals">
                <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:flex items-center">
                  <ClipboardList size={18} />
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {(pendingProposals?.length ?? 0) > 99 ? "99+" : pendingProposals?.length}
                  </span>
                </button>
              </Link>
            )}
            {isAuthenticated && user?.role === "admin" && (pendingReviewCount ?? 0) > 0 && (
              <Link href="/admin/reviews">
                <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:flex items-center">
                  <Check size={18} />
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {(pendingReviewCount ?? 0) > 99 ? "99+" : pendingReviewCount}
                  </span>
                </button>
              </Link>
            )}

            {isAuthenticated && (
              <>
                <Link href="/create-quest">
                  <button className="btn-game hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs">
                    <Plus size={14} />
                    CREATE
                  </button>
                </Link>

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Bell size={18} />
                    {(unreadCount ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {(unreadCount ?? 0) > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => setLocation("/settings")}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Settings"
                >
                  <Settings size={16} />
                </button>
              </>
            )}

            {!isAuthenticated && (
              <a href="/login">
                <button className="btn-game flex items-center gap-1.5 px-4 py-2 text-xs">
                  <LogIn size={14} />
                  SIGN IN
                </button>
              </a>
            )}

            {/* Mobile menu */}
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="container py-4 flex flex-col gap-2">
              {isAuthenticated && profile && (
                <div className="pb-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <Zap size={14} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{user?.name}</div>
                      <XPBar
                        xp={profile.xp ?? 0}
                        level={profile.level ?? 1}
                        currentLevelXp={profile.currentLevelXp}
                        nextLevelXp={profile.nextLevelXp}
                      />
                    </div>
                  </div>
                </div>
              )}
              {navLinks.map((link) => {
                const pendingCount =
                  link.href === "/admin/proposals"
                    ? (pendingProposals?.length ?? 0)
                    : link.href === "/admin/reviews"
                    ? (pendingReviewCount ?? 0)
                    : 0;
                return (
                  <Link key={link.href} href={link.href}>
                    <div
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold tracking-wider transition-all ${
                        isActive(link.href)
                          ? "text-primary bg-primary/10 border border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {link.icon}
                        {link.label}
                        {pendingCount > 0 && (
                          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                            {pendingCount > 99 ? "99+" : pendingCount}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={14} />
                    </div>
                  </Link>
                );
              })}
              {isAuthenticated && (
                <Link href="/create-quest">
                  <div
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-primary border border-primary/30 bg-primary/10"
                  >
                    <Plus size={14} />
                    CREATE QUEST
                  </div>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
