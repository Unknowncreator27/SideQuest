import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const typeIcon: Record<string, string> = {
  xp_gained: "⚡",
  level_up: "🚀",
  quest_completed: "🎯",
  submission_verified: "✅",
  submission_rejected: "❌",
  milestone: "🏆",
  unlockable_earned: "🎁",
};

function formatMetadataValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
  return String(value);
}

function metadataEntries(metadata?: string) {
  if (!metadata) return [];
  try {
    const parsed = JSON.parse(metadata);
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed);
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export default function Notifications() {
  const [location, setLocation] = useLocation();
  const { data: notifications, isLoading } = trpc.notification.list.useQuery();
  const markRead = trpc.notification.markRead.useMutation();
  const markAllRead = trpc.notification.markAllRead.useMutation();
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const query = new URLSearchParams(location.split("?")[1] || "");
  const selectedIdFromQuery = query.get("selectedId") ? Number(query.get("selectedId")) : null;

  useEffect(() => {
    if (selectedIdFromQuery && selectedIdFromQuery !== selectedId) {
      setSelectedId(selectedIdFromQuery);
    }
  }, [selectedIdFromQuery, selectedId]);

  useEffect(() => {
    if (!selectedIdFromQuery || !notifications) return;
    const selectedNotification = notifications.find((n) => n.id === selectedIdFromQuery);
    if (selectedNotification && !selectedNotification.read) {
      markRead.mutate({ notificationId: selectedIdFromQuery }, {
        onSuccess: () => {
          utils.notification.list.invalidate();
          utils.notification.unreadCount.invalidate();
        },
      });
    }
  }, [selectedIdFromQuery, notifications, markRead, utils]);

  const selectedNotification = notifications?.find((n) => n.id === selectedId) ?? notifications?.[0] ?? null;

  const handleSelect = async (notificationId: number) => {
    setSelectedId(notificationId);
    setLocation(`/notifications?selectedId=${notificationId}`);
    await markRead.mutateAsync({ notificationId }, {
      onSuccess: () => {
        utils.notification.list.invalidate();
        utils.notification.unreadCount.invalidate();
      },
    });
  };

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm uppercase tracking-[0.35em] text-primary font-bold">Notification Wall</p>
                {notifications && notifications.filter((n) => !n.read).length > 0 && (
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
                    {notifications.filter((n) => !n.read).length} unread
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-black tracking-tight">All activity & alerts</h1>
            </div>
            <Link href="/dashboard">
              <button className="btn-game px-4 py-2 text-sm">Back to dashboard</button>
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-[320px_1fr]">
            <div className="game-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">Notifications</h2>
                  <p className="text-sm text-muted-foreground">Click any item to view details.</p>
                </div>
                <button
                  onClick={async () => {
                    await markAllRead.mutateAsync(undefined, {
                      onSuccess: () => {
                        utils.notification.list.invalidate();
                        utils.notification.unreadCount.invalidate();
                      },
                    });
                  }}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  Mark all read
                </button>
              </div>
              <div className="space-y-2">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-20 rounded-2xl bg-muted animate-pulse" />
                  ))
                ) : !notifications || notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nothing here yet. Complete quests or unlock rewards to see activity.
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const isActive = notification.id === selectedNotification?.id;
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleSelect(notification.id)}
                        className={`w-full rounded-3xl border px-4 py-3 text-left transition-colors ${
                          isActive ? "border-primary bg-primary/10" : "border-border/60 bg-background hover:bg-secondary"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{typeIcon[notification.type] ?? "📢"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm truncate">{notification.title}</span>
                              {!notification.read && (
                                <span className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{notification.message}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-2">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="game-card p-6"
            >
              {selectedNotification ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{typeIcon[selectedNotification.type] ?? "📢"}</span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-primary font-bold">
                        {selectedNotification.read ? "Read" : "Unread"}
                      </p>
                      <h2 className="text-2xl font-black">{selectedNotification.title}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 whitespace-pre-wrap">{selectedNotification.message}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-border p-4">
                      <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground mb-2">Received</p>
                      <p className="text-sm">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
                    </div>
                    {selectedNotification.metadata && (
                      <div className="rounded-3xl border border-border p-4">
                        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground mb-3">Details</p>
                        {metadataEntries(selectedNotification.metadata).length > 0 ? (
                          <div className="space-y-3">
                            {metadataEntries(selectedNotification.metadata).map(([key, value]) => (
                              <div key={key} className="rounded-2xl bg-background/90 p-3 border border-border">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">{key}</span>
                                  <span className="text-xs text-muted-foreground">{typeof value}</span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-foreground break-words">{formatMetadataValue(value)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <pre className="text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">{selectedNotification.metadata}</pre>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-14 text-center text-sm text-muted-foreground">
                  Select a notification to view full details.
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
