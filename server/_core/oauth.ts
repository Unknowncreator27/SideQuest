import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Mock OAuth login page for development
  app.get("/app-auth", (req: Request, res: Response) => {
    const appId = getQueryParam(req, "appId");
    const redirectUri = getQueryParam(req, "redirectUri");
    const state = getQueryParam(req, "state");

    if (!appId || !redirectUri || !state) {
      res.status(400).json({ error: "appId, redirectUri, and state are required" });
      return;
    }

    // For development, auto-generate a fake code and redirect back
    // In production, this would be a real login page
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
      // For dev mock OAuth, create a session directly
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

