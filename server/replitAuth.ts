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

  // Auth routes - Demo authentication for testing
  app.get("/api/login", (req, res) => {
    // Create a demo user session to show the authenticated experience
    req.session.user = {
      id: "demo-user-123",
      email: "demo@replit.com",
      firstName: "Demo",
      lastName: "User"
    };
    
    console.log("Demo user logged in:", req.session.user);
    res.redirect("/");
  });

  app.get("/api/callback", async (req, res) => {
    // This would handle the real OAuth callback in production
    res.redirect("/");
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