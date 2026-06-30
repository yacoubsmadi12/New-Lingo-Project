import passport from "passport";
import { Strategy as CustomStrategy } from "passport-custom";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User } from "@shared/schema";
import ldap from "ldapjs";

async function authenticateLDAP(username: string, password: string): Promise<any> {
  const settings = await storage.getLdapSettings();
  if (!settings) throw new Error("LDAP not configured");

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: settings.url });
    
    const userDn = `uid=${username},${settings.baseDn}`; // Example DN structure
    
    client.bind(userDn, password, (err) => {
      if (err) {
        client.destroy();
        return reject(err);
      }

      const opts: ldap.SearchOptions = {
        filter: `(uid=${username})`,
        scope: "sub",
        attributes: ["cn", "mail", "department", "memberOf"]
      };

      client.search(settings.baseDn, opts, (err, res) => {
        if (err) {
          client.destroy();
          return reject(err);
        }

        let userEntry: any = null;
        res.on("searchEntry", (entry) => {
          userEntry = (entry as any).object;
        });

        res.on("error", (err) => {
          client.destroy();
          reject(err);
        });

        res.on("end", () => {
          client.destroy();
          if (!userEntry) return reject(new Error("User not found in LDAP"));
          
          const isAdmin = Array.isArray(userEntry.memberOf) 
            ? userEntry.memberOf.some((g: string) => g.includes(settings.adminGroup))
            : typeof userEntry.memberOf === "string" && userEntry.memberOf.includes(settings.adminGroup);

          resolve({
            username: username,
            fullName: userEntry.cn,
            email: userEntry.mail,
            department: userEntry.department || "Unknown",
            role: isAdmin ? "admin" : "employee"
          });
        });
      });
    });
  });
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "zlingo_secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: app.get("env") === "production",
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    "ldap",
    new CustomStrategy(async (req, done) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) return done(null, false);

        // First try local database
        const localUser = await storage.getUserByUsername(username);
        if (localUser && localUser.password === password) {
          return done(null, localUser);
        }

        // Fallback to LDAP
    let ldapUser: any = null;
    try {
      ldapUser = await authenticateLDAP(username, password);
    } catch (ldapErr: any) {
      console.log("LDAP Auth skip/fail:", ldapErr.message);
    }
    
    if (!ldapUser) return done(null, false);
    
    let user = localUser;
    if (!user) {
          user = await storage.createUser({
            username: ldapUser.username,
            fullName: ldapUser.fullName,
            email: ldapUser.email,
            department: ldapUser.department,
            role: ldapUser.role
          });
        }
        
        return done(null, user);
      } catch (err) {
        console.error("Auth Error:", err);
        return done(null, false);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id as number);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("ldap", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.logIn(user, (err: any) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });
}
