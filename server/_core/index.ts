import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./authRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { users, quests, unlockables, dailyChallenges } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { ENV } from "./env";
import { recordRequest } from "./metrics";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Validate required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'VITE_APP_ID',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('[Startup] All required environment variables are set');

  const app = express();
  app.set("trust proxy", true);
  const server = createServer(app);
  // Track request traffic so admin metrics can report visitor network usage.
  app.use((req, res, next) => {
    const startIn = req.socket.bytesRead;
    const startOut = req.socket.bytesWritten;
    const visitorIp =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    res.on("finish", () => {
      const bytesIn = req.socket.bytesRead - startIn;
      const bytesOut = req.socket.bytesWritten - startOut;
      recordRequest({
        path: req.originalUrl || req.url,
        method: req.method,
        status: res.statusCode,
        bytesIn: bytesIn > 0 ? bytesIn : 0,
        bytesOut: bytesOut > 0 ? bytesOut : 0,
        visitorIp,
      });
    });

    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Auth routes (OAuth, login, register, logout)
  registerAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

async function seedOwnerAdmin() {
  try {
    const db = await getDb();
    if (!db) return;

    const ownerOpenId = ENV.ownerOpenId || "owner";
    const ownerEmail = ownerOpenId.startsWith("email:") ? ownerOpenId.split(":")[1] : null;
    const adminPassword = process.env.ADMIN_PASSWORD;

    const ownerValues: any = {
      openId: ownerOpenId,
      name: "Quest Master",
      role: "admin",
    };

    if (ownerEmail) {
      ownerValues.email = ownerEmail;
      ownerValues.loginMethod = "email-password";
      ownerValues.emailVerified = true;
    }

    if (adminPassword) {
      ownerValues.password = await bcrypt.hash(adminPassword, 10);
    }

    await db.insert(users).values(ownerValues).onDuplicateKeyUpdate({
      set: {
        name: ownerValues.name,
        role: ownerValues.role,
        email: ownerValues.email ?? null,
        loginMethod: ownerValues.loginMethod ?? null,
        emailVerified: ownerValues.emailVerified ?? false,
        ...(ownerValues.password ? { password: ownerValues.password } : {}),
      },
    });
  } catch (err) {
    console.warn("[Seed] Failed to seed owner admin:", err);
  }
}

async function seedDefaultQuestsIfEmpty() {
  try {
    const db = await getDb();
    if (!db) return;
    const existing = await db.select().from(quests).limit(1);
    if (existing.length > 0) return;
    let owner = (await db.select().from(users).where(eq(users.openId, ENV.ownerOpenId || "owner")).limit(1))[0];
    if (!owner) {
      console.warn("[Seed] Owner admin not found yet; skipping quest seeding.");
      return;
    }
    const DEFAULT_QUESTS = [
      { title: "Touch Grass", description: "Go outside and touch actual grass. Take a photo of your hand on the grass to prove it. Bonus points if you look like you're having a spiritual moment.", xpReward: 50, difficulty: "easy" as const },
      { title: "Cold Shower Challenge", description: "Take a full cold shower for at least 2 minutes. Record a short video of yourself stepping into the cold water and surviving the experience.", xpReward: 150, difficulty: "medium" as const },
      { title: "100 Push-Ups", description: "Complete 100 push-ups in a single session. Record a video of yourself doing them — they must be proper form. No cheating.", xpReward: 300, difficulty: "hard" as const },
      { title: "Eat Something Weird", description: "Eat something you've never eaten before that most people would find unusual. Take a photo of you eating it with a clear view of the food.", xpReward: 75, difficulty: "easy" as const },
      { title: "Talk to a Stranger", description: "Start a genuine conversation with a complete stranger and get their name. Take a photo of you both (with their permission) or a selfie right after.", xpReward: 200, difficulty: "medium" as const },
      { title: "Sunrise Witness", description: "Wake up before sunrise and watch it from start to finish. Take a photo of the sunrise with you in the frame to prove you were there.", xpReward: 120, difficulty: "medium" as const },
      { title: "The Plunge", description: "Jump into a body of water — ocean, lake, river, or pool. Record a video of the jump and your reaction. Must be a real jump, not a gentle wade in.", xpReward: 250, difficulty: "hard" as const },
      { title: "Random Act of Kindness", description: "Do something genuinely kind for a stranger without being asked. Take a photo or video of the act (with permission if involving others).", xpReward: 100, difficulty: "easy" as const },
      { title: "Eat Alone at a Restaurant", description: "Go to a sit-down restaurant and eat a full meal completely alone — no phone scrolling. Take a photo of your meal at the table.", xpReward: 180, difficulty: "medium" as const },
      { title: "LEGENDARY: 24-Hour No Phone", description: "Go 24 hours without using your smartphone at all. Take a photo of your phone in a drawer at the start, and another 24 hours later. Your crew must vouch for you.", xpReward: 2000, difficulty: "legendary" as const },
      { title: "Compliment 10 People", description: "Give genuine, specific compliments to 10 different people in one day. Record a short video of yourself describing each compliment you gave.", xpReward: 90, difficulty: "easy" as const },
      { title: "Cook a Full Meal From Scratch", description: "Cook a complete meal (starter, main, dessert) entirely from scratch — no pre-made ingredients. Take photos of each dish you prepared.", xpReward: 350, difficulty: "hard" as const },
    ];
    for (const q of DEFAULT_QUESTS) {
      await db.insert(quests).values({ ...q, createdBy: owner.id });
    }
    console.log(`[Seed] Seeded ${DEFAULT_QUESTS.length} default quests.`);
  } catch (err) {
    console.warn("[Seed] Failed to seed quests:", err);
  }
}

async function seedDefaultUnlockablesIfEmpty() {
  try {
    const db = await getDb();
    if (!db) return;
    const existing = await db.select().from(unlockables).limit(1);
    if (existing.length > 0) return;

    const DEFAULT_UNLOCKABLES = [
      {
        title: "Rookie Adventurer",
        description: "Complete your first quest.",
        category: "badge" as const,
        criteria: "first_quest_completed",
        imageUrl: null,
      },
      {
        title: "Legend Seeker",
        description: "Complete your first legendary quest.",
        category: "cosmetic" as const,
        criteria: "legendary_quest_completed",
        imageUrl: null,
      },
      {
        title: "Neon Visor",
        description: "A glowing visor to show off during quests.",
        category: "cosmetic" as const,
        criteria: "shop_purchase_neon_visor",
        priceXp: 200,
        imageUrl: null,
      },
      {
        title: "Shadow Cloak",
        description: "A stealthy cloak that adds a mysterious edge.",
        category: "cosmetic" as const,
        criteria: "shop_purchase_shadow_cloak",
        priceXp: 400,
        imageUrl: null,
      },
      {
        title: "Golden Frame",
        description: "A gilded frame to highlight your profile badge.",
        category: "cosmetic" as const,
        criteria: "shop_purchase_golden_frame",
        priceXp: 300,
        imageUrl: null,
      },
      {
        title: "Five Quests Master",
        description: "Complete five quests.",
        category: "title" as const,
        criteria: "five_quests_completed",
        imageUrl: null,
      },
      {
        title: "Level 5 Champ",
        description: "Reach Level 5.",
        category: "title" as const,
        criteria: "reach_level_5",
        imageUrl: null,
      },
    ];

    for (const unlockable of DEFAULT_UNLOCKABLES) {
      await db.insert(unlockables).values({ ...unlockable, isActive: true });
    }
    console.log(`[Seed] Seeded ${DEFAULT_UNLOCKABLES.length} default unlockables.`);
  } catch (err) {
    console.warn("[Seed] Failed to seed unlockables:", err);
  }
}

async function seedDefaultDailyChallengesIfEmpty() {
  try {
    const db = await getDb();
    if (!db) return;
    const existing = await db.select().from(dailyChallenges).limit(1);
    if (existing.length > 0) return;

    const DEFAULT_DAILY_CHALLENGES = [
      {
        title: "Daily Quest Runner",
        description: "Complete one quest today.",
        challengeType: "complete_quest" as const,
        target: 1,
        rewardXp: 75,
        active: true,
      },
      {
        title: "Legendary Seeker",
        description: "Complete a legendary quest today.",
        challengeType: "legendary_quest" as const,
        target: 1,
        rewardXp: 150,
        active: true,
      },
      {
        title: "Daily Habit",
        description: "Submit proof for any quest today.",
        challengeType: "submit_media" as const,
        target: 1,
        rewardXp: 50,
        active: true,
      },
    ];

    for (const challenge of DEFAULT_DAILY_CHALLENGES) {
      await db.insert(dailyChallenges).values(challenge);
    }
    console.log(`[Seed] Seeded ${DEFAULT_DAILY_CHALLENGES.length} default daily challenges.`);
  } catch (err) {
    console.warn("[Seed] Failed to seed daily challenges:", err);
  }
}

startServer().catch(console.error);

// Seed owner admin, default quests, default unlockables, and default daily challenges after a short delay to allow DB to be ready
setTimeout(() => {
  seedOwnerAdmin();
  seedDefaultQuestsIfEmpty();
  seedDefaultUnlockablesIfEmpty();
  seedDefaultDailyChallengesIfEmpty();
}, 3000);
