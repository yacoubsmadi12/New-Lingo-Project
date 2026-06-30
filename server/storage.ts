import { db } from "./db";
import { users, terms, quizzes, badges, userBadges, ldapSettings, rewards, userRewards, dailyContent, userLearnedTerms, monthlyPuzzles, userPuzzleAttempts, type User, type InsertUser, type Term, type InsertTerm, type Quiz, type InsertQuiz, type Badge, type InsertBadge, type UserBadge, type LdapSettings, type InsertLdapSettings, type Reward, type InsertReward, type UserReward, type UserLearnedTerm, type MonthlyPuzzle, type UserPuzzleAttempt } from "@shared/schema";
import { eq, desc, sql, and, notInArray, inArray } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { z } from "zod";
import { insertMonthlyPuzzleSchema, insertUserPuzzleAttemptSchema } from "@shared/schema";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: string; fullName?: string; email?: string }): Promise<User>;
  updateUserStats(userId: number, points: number, wordsLearned: number): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Terms
  getTerms(department?: string): Promise<Term[]>;
  createTerm(term: InsertTerm): Promise<Term>;

  // Quizzes
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  getQuizHistory(userId: number): Promise<Quiz[]>;

  // Daily Content
  getDailyContent(department: string, date: string): Promise<typeof dailyContent.$inferSelect | undefined>;
  createDailyContent(content: { department: string; date: string; termId: number; quizData: any }): Promise<typeof dailyContent.$inferSelect>;

  // Leaderboard
  getLeaderboard(): Promise<User[]>;

  // Badges
  getBadges(): Promise<Badge[]>;
  createBadge(badge: InsertBadge): Promise<Badge>;
  getUserBadges(userId: number): Promise<UserBadge[]>;
  awardBadge(userId: number, badgeId: number): Promise<UserBadge>;
  
  // LDAP Settings
  getLdapSettings(): Promise<LdapSettings | undefined>;
  updateLdapSettings(settings: InsertLdapSettings): Promise<LdapSettings>;

  // Rewards
  getRewards(): Promise<Reward[]>;
  createReward(reward: InsertReward): Promise<Reward>;
  awardReward(userId: number, rewardId: number): Promise<UserReward>;
  getUserRewards(userId: number): Promise<UserReward[]>;

  // Learned Terms
  getUserLearnedTerms(userId: number): Promise<UserLearnedTerm[]>;
  getUserLearnedTermIds(userId: number): Promise<number[]>;
  markTermAsLearned(userId: number, termId: number): Promise<UserLearnedTerm>;
  hasUserLearnedTerm(userId: number, termId: number): Promise<boolean>;
  getUnlearnedTermsForDepartment(userId: number, department: string): Promise<Term[]>;
  getUserLearnedTermsWithDetails(userId: number): Promise<(UserLearnedTerm & { term: Term })[]>;
  addPoints(userId: number, points: number, reason: string): Promise<User>;
  checkAndAwardPointsBadges(userId: number): Promise<void>;

  // Monthly Puzzles
  getMonthlyPuzzle(department: string, month: string): Promise<MonthlyPuzzle | undefined>;
  createMonthlyPuzzle(puzzle: z.infer<typeof insertMonthlyPuzzleSchema>): Promise<MonthlyPuzzle>;
  getPuzzleAttempt(userId: number, puzzleId: number): Promise<UserPuzzleAttempt | undefined>;
  createPuzzleAttempt(attempt: z.infer<typeof insertUserPuzzleAttemptSchema>): Promise<UserPuzzleAttempt>;
  solvePuzzle(userId: number, puzzleId: number): Promise<void>;

  // Mini Games
  getRandomTerms(limit: number): Promise<Term[]>;

  // Cron specific
  getUniqueDepartments(): Promise<string[]>;

  // Session
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUniqueDepartments(): Promise<string[]> {
    const result = await db.selectDistinct({ department: users.department }).from(users);
    return result.map(r => r.department);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { role?: string; fullName?: string; email?: string; password?: string }): Promise<User> {
    const { username, department, role, fullName, email, password } = insertUser;
    const [user] = await db.insert(users).values({
      username,
      password,
      department,
      role: role || "employee",
      fullName: fullName || null,
      email: email || null,
    }).returning();
    return user;
  }

  async updateUserStats(userId: number, points: number, wordsLearned: number): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error("User not found");

    const [updatedUser] = await db.update(users)
      .set({ 
        points: sql`points + ${points}`,
        streak: points > 0 ? sql`streak + 1` : sql`streak`,
        wordsLearned: sql`words_learned + ${wordsLearned}`,
        avgQuizScore: Math.floor(((user.avgQuizScore || 0) + (points > 0 ? 100 : 0)) / 2),
        lastLoginDate: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // Term methods
  async getTerms(department?: string): Promise<Term[]> {
    if (department) {
      return db.select().from(terms).where(eq(terms.department, department));
    }
    return db.select().from(terms);
  }

  async createTerm(term: InsertTerm): Promise<Term> {
    const [newTerm] = await db.insert(terms).values(term).returning();
    return newTerm;
  }

  // Quiz methods
  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    const [newQuiz] = await db.insert(quizzes).values(quiz).returning();
    return newQuiz;
  }

  async getQuizHistory(userId: number): Promise<Quiz[]> {
    return db.select().from(quizzes).where(eq(quizzes.userId, userId)).orderBy(desc(quizzes.date));
  }

  // Daily Content
  async getDailyContent(department: string, date: string) {
    const [content] = await db.select().from(dailyContent).where(
      and(
        eq(dailyContent.department, department),
        eq(dailyContent.date, date)
      )
    );
    return content;
  }

  async createDailyContent(content: { department: string; date: string; termId: number; quizData: any }) {
    const [newContent] = await db.insert(dailyContent).values(content).returning();
    return newContent;
  }

  // Leaderboard
  async getLeaderboard(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.points)).limit(50);
  }

  // Badges
  async getBadges(): Promise<Badge[]> {
    return db.select().from(badges);
  }

  async createBadge(badge: InsertBadge): Promise<Badge> {
    const [newBadge] = await db.insert(badges).values(badge).returning();
    return newBadge;
  }

  async getUserBadges(userId: number): Promise<UserBadge[]> {
    return db.select().from(userBadges).where(eq(userBadges.userId, userId));
  }

  async awardBadge(userId: number, badgeId: number): Promise<UserBadge> {
    const [badge] = await db.insert(userBadges).values({ userId, badgeId }).returning();
    return badge;
  }

  // LDAP Settings
  async getLdapSettings(): Promise<LdapSettings | undefined> {
    const [settings] = await db.select().from(ldapSettings).limit(1);
    return settings;
  }

  async updateLdapSettings(settings: InsertLdapSettings): Promise<LdapSettings> {
    const existing = await this.getLdapSettings();
    if (existing) {
      const [updated] = await db.update(ldapSettings).set(settings).where(eq(ldapSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(ldapSettings).values(settings).returning();
    return created;
  }

  // Rewards
  async getRewards(): Promise<Reward[]> {
    return db.select().from(rewards);
  }

  async createReward(reward: InsertReward): Promise<Reward> {
    const [newReward] = await db.insert(rewards).values(reward).returning();
    return newReward;
  }

  async awardReward(userId: number, rewardId: number): Promise<UserReward> {
    const [userReward] = await db.insert(userRewards).values({ userId, rewardId }).returning();
    return userReward;
  }

  async getUserRewards(userId: number): Promise<UserReward[]> {
    return db.select().from(userRewards).where(eq(userRewards.userId, userId));
  }

  // Learned Terms methods
  async getUserLearnedTerms(userId: number): Promise<UserLearnedTerm[]> {
    return db.select().from(userLearnedTerms).where(eq(userLearnedTerms.userId, userId)).orderBy(desc(userLearnedTerms.learnedAt));
  }

  async getUserLearnedTermIds(userId: number): Promise<number[]> {
    const learned = await db.select({ termId: userLearnedTerms.termId }).from(userLearnedTerms).where(eq(userLearnedTerms.userId, userId));
    return learned.map(l => l.termId);
  }

  async markTermAsLearned(userId: number, termId: number): Promise<UserLearnedTerm> {
    // Check if already learned to avoid duplicates
    const existing = await db.select().from(userLearnedTerms).where(
      and(eq(userLearnedTerms.userId, userId), eq(userLearnedTerms.termId, termId))
    );
    if (existing.length > 0) {
      return existing[0];
    }
    const [learned] = await db.insert(userLearnedTerms).values({ userId, termId }).returning();
    
    // Update user's wordsLearned count
    const learnedTerms = await this.getUserLearnedTermIds(userId);
    await db.update(users)
      .set({ wordsLearned: learnedTerms.length })
      .where(eq(users.id, userId));

    return learned;
  }

  async hasUserLearnedTerm(userId: number, termId: number): Promise<boolean> {
    const [existing] = await db.select().from(userLearnedTerms).where(
      and(eq(userLearnedTerms.userId, userId), eq(userLearnedTerms.termId, termId))
    );
    return !!existing;
  }

  async getUnlearnedTermsForDepartment(userId: number, department: string): Promise<Term[]> {
    const learnedIds = await this.getUserLearnedTermIds(userId);
    if (learnedIds.length === 0) {
      return db.select().from(terms).where(eq(terms.department, department));
    }
    return db.select().from(terms).where(
      and(eq(terms.department, department), notInArray(terms.id, learnedIds))
    );
  }

  async getUserLearnedTermsWithDetails(userId: number): Promise<(UserLearnedTerm & { term: Term })[]> {
    const learnedTerms = await this.getUserLearnedTerms(userId);
    if (learnedTerms.length === 0) return [];
    
    const termIds = learnedTerms.map(lt => lt.termId);
    const termsList = await db.select().from(terms).where(inArray(terms.id, termIds));
    const termsMap = new Map(termsList.map(t => [t.id, t]));
    
    return learnedTerms.map(lt => ({
      ...lt,
      term: termsMap.get(lt.termId)!
    })).filter(lt => lt.term); // Filter out any with missing terms
  }

  async addPoints(userId: number, points: number, reason: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ 
        points: sql`points + ${points}`,
        lastPointsUpdate: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    await this.checkAndAwardPointsBadges(userId);
    return user;
  }

  async checkAndAwardPointsBadges(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const userBadgesList = await this.getUserBadges(userId);
    const badgeIds = new Set(userBadgesList.map(ub => ub.badgeId));

    const allBadges = await this.getBadges();
    
    const pointBadges = [
      { points: 300, name: "Shield" },
      { points: 500, name: "Medium Shield" },
      { points: 1000, name: "Bronze Shield" }
    ];

    for (const pb of pointBadges) {
      if (user.points >= pb.points) {
        const badge = allBadges.find(b => b.name === pb.name);
        if (badge && !badgeIds.has(badge.id)) {
          await this.awardBadge(userId, badge.id);
        }
      }
    }
  }

  async getRandomTerms(limit: number): Promise<Term[]> {
    return db.select().from(terms).orderBy(sql`RANDOM()`).limit(limit);
  }

  // Monthly Puzzles
  async getMonthlyPuzzle(department: string, month: string): Promise<MonthlyPuzzle | undefined> {
    const [puzzle] = await db.select().from(monthlyPuzzles).where(
      and(
        eq(monthlyPuzzles.department, department),
        eq(monthlyPuzzles.month, month)
      )
    );
    return puzzle;
  }

  async createMonthlyPuzzle(puzzle: z.infer<typeof insertMonthlyPuzzleSchema>): Promise<MonthlyPuzzle> {
    const [newPuzzle] = await db.insert(monthlyPuzzles).values(puzzle).returning();
    return newPuzzle;
  }

  async getPuzzleAttempt(userId: number, puzzleId: number): Promise<UserPuzzleAttempt | undefined> {
    const [attempt] = await db.select().from(userPuzzleAttempts).where(
      and(
        eq(userPuzzleAttempts.userId, userId),
        eq(userPuzzleAttempts.puzzleId, puzzleId)
      )
    );
    return attempt;
  }

  async createPuzzleAttempt(attempt: z.infer<typeof insertUserPuzzleAttemptSchema>): Promise<UserPuzzleAttempt> {
    const [newAttempt] = await db.insert(userPuzzleAttempts).values(attempt).returning();
    return newAttempt;
  }

  async solvePuzzle(userId: number, puzzleId: number): Promise<void> {
    const puzzle = await db.select().from(monthlyPuzzles).where(eq(monthlyPuzzles.id, puzzleId)).limit(1);
    if (!puzzle[0]) return;

    await db.update(userPuzzleAttempts)
      .set({ status: "solved", solvedAt: new Date() })
      .where(and(eq(userPuzzleAttempts.userId, userId), eq(userPuzzleAttempts.puzzleId, puzzleId)));
    
    await this.addPoints(userId, puzzle[0].pointsReward, "Monthly Puzzle Solved");
  }
}

export const storage = new DatabaseStorage();
