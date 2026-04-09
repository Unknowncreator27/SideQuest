import { drizzle } from "drizzle-orm/mysql2";
import { quests, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const DEFAULT_QUESTS = [
  {
    title: "Touch Grass",
    description: "Go outside and touch actual grass. Take a photo of your hand on the grass to prove it. Bonus points if you look like you're having a spiritual moment.",
    xpReward: 50,
    difficulty: "easy" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "Cold Shower Challenge",
    description: "Take a full cold shower for at least 2 minutes. Record a short video of yourself stepping into the cold water and surviving the experience.",
    xpReward: 150,
    difficulty: "medium" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "100 Push-Ups",
    description: "Complete 100 push-ups in a single session. Record a video of yourself doing them — they must be proper form. No cheating.",
    xpReward: 300,
    difficulty: "hard" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "Eat Something Weird",
    description: "Eat something you've never eaten before that most people would find unusual. Take a photo of you eating it with a clear view of the food.",
    xpReward: 75,
    difficulty: "easy" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "Talk to a Stranger",
    description: "Start a genuine conversation with a complete stranger and get their name. Take a photo of you both (with their permission) or a selfie right after.",
    xpReward: 200,
    difficulty: "medium" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "Sunrise Witness",
    description: "Wake up before sunrise and watch it from start to finish. Take a photo of the sunrise with you in the frame to prove you were there.",
    xpReward: 120,
    difficulty: "medium" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "The Plunge",
    description: "Jump into a body of water — ocean, lake, river, or pool. Record a video of the jump and your reaction. Must be a real jump, not a gentle wade in.",
    xpReward: 250,
    difficulty: "hard" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "Random Act of Kindness",
    description: "Do something genuinely kind for a stranger without being asked. Take a photo or video of the act (with permission if involving others).",
    xpReward: 100,
    difficulty: "easy" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "Eat Alone at a Restaurant",
    description: "Go to a sit-down restaurant and eat a full meal completely alone — no phone scrolling. Take a photo of your meal at the table.",
    xpReward: 180,
    difficulty: "medium" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "LEGENDARY: 24-Hour No Phone",
    description: "Go 24 hours without using your smartphone at all. Take a photo of your phone in a drawer at the start, and another 24 hours later. Your crew must vouch for you.",
    xpReward: 2000,
    difficulty: "legendary" as const,
    requirementType: "team" as const,
    requiredMediaCount: 2,
    expiresAt: null,
  },
  {
    title: "Compliment 10 People",
    description: "Give genuine, specific compliments to 10 different people in one day. Record a short video of yourself describing each compliment you gave.",
    xpReward: 90,
    difficulty: "easy" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 1,
    expiresAt: null,
  },
  {
    title: "Cook a Full Meal From Scratch",
    description: "Cook a complete meal (starter, main, dessert) entirely from scratch — no pre-made ingredients. Take photos of each dish you prepared.",
    xpReward: 350,
    difficulty: "hard" as const,
    requirementType: "individual" as const,
    requiredMediaCount: 3,
    expiresAt: null,
  },
];

export async function seedDefaultQuests(ownerId: number) {
  const db = drizzle(process.env.DATABASE_URL!);

  // Check if quests already exist
  const existing = await db.select().from(quests).limit(1);
  if (existing.length > 0) {
    console.log("[Seed] Quests already exist, skipping seed.");
    return;
  }

  console.log("[Seed] Seeding default quests...");
  for (const quest of DEFAULT_QUESTS) {
    await db.insert(quests).values({
      ...quest,
      createdBy: ownerId,
    });
  }
  console.log(`[Seed] Seeded ${DEFAULT_QUESTS.length} quests.`);
}
