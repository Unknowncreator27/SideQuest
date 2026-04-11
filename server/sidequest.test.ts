import { describe, expect, it } from "vitest";
import { calculateLevel, xpForLevel, xpForNextLevel } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock context helpers ─────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      password: null,
      loginMethod: "manus",
      role: "user",
      xp: 0,
      level: 1,
      avatarUrl: null,
      emailVerified: false,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: {
      clearCookie: () => {},
    },
    ...overrides,
  } as unknown as TrpcContext;
}

// ─── XP / Level Calculation Tests ─────────────────────────────────────────────

describe("calculateLevel", () => {
  it("returns level 1 for 0 XP", () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it("returns level 2 at exactly 100 XP", () => {
    expect(calculateLevel(100)).toBe(2);
  });

  it("returns level 3 at exactly 250 XP", () => {
    expect(calculateLevel(250)).toBe(3);
  });

  it("returns level 4 at exactly 500 XP", () => {
    expect(calculateLevel(500)).toBe(4);
  });

  it("returns level 10 at 6000+ XP", () => {
    expect(calculateLevel(6000)).toBe(10);
    expect(calculateLevel(9999)).toBe(10);
  });

  it("returns correct level for mid-range XP", () => {
    expect(calculateLevel(150)).toBe(2);
    expect(calculateLevel(499)).toBe(3);
    expect(calculateLevel(900)).toBe(5);
  });
});

describe("xpForLevel", () => {
  it("returns 0 for level 1", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("returns 100 for level 2", () => {
    expect(xpForLevel(2)).toBe(100);
  });

  it("returns 6000 for level 10", () => {
    expect(xpForLevel(10)).toBe(6000);
  });
});

describe("xpForNextLevel", () => {
  it("returns 100 for level 1 (next is level 2)", () => {
    expect(xpForNextLevel(1)).toBe(100);
  });

  it("returns 250 for level 2", () => {
    expect(xpForNextLevel(2)).toBe(250);
  });
});

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const clearedCookies: string[] = [];
    const ctx = makeCtx({
      res: {
        clearCookie: (name: string) => clearedCookies.push(name),
      } as unknown as TrpcContext["res"],
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies).toContain("app_session_id");
  });
});

// ─── Quest Validation Tests ───────────────────────────────────────────────────

describe("quest.create input validation", () => {
  it("rejects quest with title too short", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quest.create({
        title: "Hi",
        description: "This is a valid description that is long enough",
        xpReward: 100,
        difficulty: "easy",
      })
    ).rejects.toThrow();
  });

  it("rejects quest with description too short", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quest.create({
        title: "Valid Quest Title",
        description: "Too short",
        xpReward: 100,
        difficulty: "easy",
      })
    ).rejects.toThrow();
  });

  it("rejects quest with XP reward below minimum", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quest.create({
        title: "Valid Quest Title",
        description: "This is a valid description that is long enough for the quest",
        xpReward: 5,
        difficulty: "easy",
      })
    ).rejects.toThrow();
  });

  it("rejects quest with XP reward above maximum", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quest.create({
        title: "Valid Quest Title",
        description: "This is a valid description that is long enough for the quest",
        xpReward: 99999,
        difficulty: "easy",
      })
    ).rejects.toThrow();
  });
});

// ─── Notification Tests ───────────────────────────────────────────────────────

describe("notification procedures require auth", () => {
  it("throws UNAUTHORIZED for unauthenticated list", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notification.list()).rejects.toThrow();
  });

  it("throws UNAUTHORIZED for unauthenticated markAllRead", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notification.markAllRead()).rejects.toThrow();
  });
});

// ─── User Profile Tests ───────────────────────────────────────────────────────

describe("user.profile requires auth", () => {
  it("throws UNAUTHORIZED for unauthenticated profile", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.user.profile()).rejects.toThrow();
  });
});
