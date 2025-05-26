import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Auth routes
  app.get("/api/login", (req, res) => {
    // Redirect to Replit authentication
    const replitAuthUrl = `https://replit.com/oidc/authorize?client_id=${process.env.REPL_ID}&response_type=code&scope=openid%20profile%20email&redirect_uri=${encodeURIComponent(`https://${req.hostname}/api/callback`)}`;
    res.redirect(replitAuthUrl);
  });

  app.get("/api/callback", async (req, res) => {
    // Handle the OAuth callback
    const { code } = req.query;
    
    if (!code) {
      return res.redirect("/?error=auth_failed");
    }

    try {
      // For now, create a mock user session until we get the full OAuth implementation
      req.session.user = {
        id: "authenticated-user",
        email: "user@replit.com",
        firstName: "Replit",
        lastName: "User"
      };
      
      res.redirect("/");
    } catch (error) {
      console.error("Auth callback error:", error);
      res.redirect("/?error=auth_failed");
    }
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check if user has a valid session
  if (req.session?.user) {
    return next();
  }
  
  return res.status(401).json({ message: "Unauthorized" });
};