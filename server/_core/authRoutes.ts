import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as bcrypt from "bcrypt";
import { z } from "zod";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert } from "firebase-admin/app";

// Initialize Firebase Admin
let firebaseAdminApp: any = null;
try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    firebaseAdminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log("[Firebase] Admin initialized successfully");
  } else {
    console.warn("[Firebase] Admin credentials not configured, Google sign-in will not work");
  }
} catch (error) {
  console.warn("[Firebase] Admin initialization failed:", error);
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

const googleSignInSchema = z.object({
  idToken: z.string(),
  user: z.object({
    uid: z.string(),
    email: z.string().email().optional(),
    displayName: z.string().optional(),
    photoURL: z.string().optional(),
  }),
});

export function registerAuthRoutes(app: Express) {
  // Register endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const data = registerSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Check if user already exists
      const existingUser = await db.getUserByOpenId(`email:${data.email}`);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }

      // Create new user
      const openId = `email:${data.email}`;
      await db.upsertUser({
        openId,
        name: data.name || data.email.split("@")[0],
        email: data.email,
        password: hashedPassword, // Store hashed password
        loginMethod: "email-password",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: data.name || data.email.split("@")[0],
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Account created and logged in successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues[0].message });
      } else {
        console.error("[Auth] Register failed", error);
        res.status(500).json({ error: "Registration failed" });
      }
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const data = registerSchema.pick({ email: true, password: true }).parse(req.body);
      const openId = `email:${data.email}`;
      const existingUser = await db.getUserByOpenId(openId);

      if (!existingUser || !existingUser.password) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(data.password, existingUser.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: existingUser.name || data.email.split("@")[0],
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Logged in successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues[0].message });
      } else {
        console.error("[Auth] Login failed", error);
        res.status(500).json({ error: "Login failed" });
      }
    }
  });

  // Google Sign-In endpoint
  app.post("/api/auth/google-signin", async (req: Request, res: Response) => {
    try {
      const data = googleSignInSchema.parse(req.body);
      console.log("[Auth] Google sign-in attempt for user:", data.user.email);

      if (!firebaseAdminApp) {
        console.error("[Auth] Firebase Admin not configured");
        return res.status(500).json({ error: "Firebase Admin not configured" });
      }

      // Verify the Firebase ID token
      const decodedToken = await getAuth(firebaseAdminApp).verifyIdToken(data.idToken);
      console.log("[Auth] Firebase token verified for:", decodedToken.email);

      // Create or update user in our database
      const openId = `firebase:${data.user.uid}`;
      await db.upsertUser({
        openId,
        name: data.user.displayName || data.user.email?.split("@")[0] || "User",
        email: data.user.email || null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });
      console.log("[Auth] User created/updated in database:", openId);

      const sessionToken = await sdk.createSessionToken(openId, {
        name: data.user.displayName || data.user.email?.split("@")[0] || "User",
        expiresInMs: ONE_YEAR_MS,
      });
      console.log("[Auth] Session token created");

      const cookieOptions = getSessionCookieOptions(req);
      console.log("[Auth] Setting cookie with options:", cookieOptions);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Signed in with Google successfully" });
      console.log("[Auth] Google sign-in successful");
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[Auth] Validation error:", error.issues);
        res.status(400).json({ error: error.issues[0].message });
      } else {
        console.error("[Auth] Google sign-in failed", error);
        res.status(500).json({ error: "Google sign-in failed" });
      }
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true, message: "Logged out" });
  });

  // Mock OAuth (for development)
  app.get("/app-auth", (req: Request, res: Response) => {
    const appId = getQueryParam(req, "appId");
    const redirectUri = getQueryParam(req, "redirectUri");
    const state = getQueryParam(req, "state");

    if (!appId || !redirectUri || !state) {
      res.status(400).json({ error: "appId, redirectUri, and state are required" });
      return;
    }

    const code = `dev-code-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);

    res.redirect(302, callbackUrl.toString());
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      if (code.startsWith("dev-code-")) {
        const openId = `dev-user-${code.slice(9)}`;
        
        await db.upsertUser({
          openId,
          name: "Dev User",
          email: "dev@localhost",
          loginMethod: "dev-mock",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name: "Dev User",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        res.redirect(302, "/");
        return;
      }

      // Production OAuth flow
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
