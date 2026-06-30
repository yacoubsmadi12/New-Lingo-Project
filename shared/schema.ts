import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

export * from "./models/chat"; // Export chat schema for integration

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // Employee ID from LDAP
  password: text("password"),
  fullName: text("full_name"),
  email: text("email"),
  department: text("department").notNull(),
  points: integer("points").default(0).notNull(),
  streak: integer("streak").default(0).notNull(),
  lastLoginDate: timestamp("last_login_date").defaultNow(),
  role: text("role").default("employee").notNull(), // employee or admin
  avatarUrl: text("avatar_url"),
  wordsLearned: integer("words_learned").default(0).notNull(),
  avgQuizScore: integer("avg_quiz_score").default(0).notNull(),
  lastPointsUpdate: timestamp("last_points_update").defaultNow(),
});

export const ldapSettings = pgTable("ldap_settings", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  bindDn: text("bind_dn").notNull(),
  bindPassword: text("bind_password").notNull(),
  baseDn: text("base_dn").notNull(),
  adminGroup: text("admin_group").default("Learning_Admins").notNull(),
});

export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  pointsRequired: integer("points_required").notNull(),
});

export const userRewards = pgTable("user_rewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  rewardId: integer("reward_id").notNull(),
  awardedAt: timestamp("awarded_at").defaultNow(),
});

export const terms = pgTable("terms", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  example: text("example").notNull(),
  department: text("department").notNull(),
});

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), 
  type: text("type").notNull(), 
  score: integer("score").notNull(),
  date: timestamp("date").defaultNow(),
});

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), 
  condition: text("condition").notNull(), 
});

export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  badgeId: integer("badge_id").notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
});

export const dailyContent = pgTable("daily_content", {
  id: serial("id").primaryKey(),
  department: text("department").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  termId: integer("term_id").notNull(),
  quizData: jsonb("quiz_data").notNull(), // Array of 5 questions
});

// Track which terms each user has learned to prevent repetition
export const userLearnedTerms = pgTable("user_learned_terms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  termId: integer("term_id").notNull(),
  learnedAt: timestamp("learned_at").defaultNow(),
});

// AI Duel sessions for Term Duel mode
export const aiDuels = pgTable("ai_duels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  difficulty: text("difficulty").notNull(), // easy, medium, hard
  aiPersonality: text("ai_personality").notNull(), // calm_professor, aggressive_challenger, trickster
  userScore: integer("user_score").default(0).notNull(),
  aiScore: integer("ai_score").default(0).notNull(),
  totalQuestions: integer("total_questions").default(10).notNull(),
  questionsAnswered: integer("questions_answered").default(0).notNull(),
  wrongAnswers: jsonb("wrong_answers").default([]).notNull(), // Array of {question, userAnswer, correctAnswer, term, definition}
  xpEarned: integer("xp_earned").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Async battles for Live Battle mode
export const asyncBattles = pgTable("async_battles", {
  id: serial("id").primaryKey(),
  challengerId: integer("challenger_id").notNull(),
  opponentId: integer("opponent_id"), // null if waiting for opponent
  challengerScore: integer("challenger_score").default(0).notNull(),
  opponentScore: integer("opponent_score"),
  questions: jsonb("questions").notNull(), // Array of questions for this battle
  challengerAnswers: jsonb("challenger_answers").default([]).notNull(),
  opponentAnswers: jsonb("opponent_answers"),
  status: text("status").default("pending").notNull(), // pending, active, completed
  winnerId: integer("winner_id"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Daily streak tracking
export const dailyStreaks = pgTable("daily_streaks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastCompletedDate: text("last_completed_date"), // YYYY-MM-DD
  streakSaversUsed: integer("streak_savers_used").default(0).notNull(),
  totalDaysCompleted: integer("total_days_completed").default(0).notNull(),
});

// Weekly leaderboard snapshots
export const weeklyLeaderboard = pgTable("weekly_leaderboard", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  weekStart: text("week_start").notNull(), // YYYY-MM-DD
  points: integer("points").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  gamesPlayed: integer("games_played").default(0).notNull(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  quizzes: many(quizzes),
  badges: many(userBadges),
  rewards: many(userRewards),
}));

export const rewardRelations = relations(rewards, ({ many }) => ({
  users: many(userRewards),
}));

export const userRewardsRelations = relations(userRewards, ({ one }) => ({
  user: one(users, {
    fields: [userRewards.userId],
    references: [users.id],
  }),
  reward: one(rewards, {
    fields: [userRewards.rewardId],
    references: [rewards.id],
  }),
}));

export const badgeRelations = relations(badges, ({ many }) => ({
  users: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
  badge: one(badges, {
    fields: [userBadges.badgeId],
    references: [badges.id],
  }),
}));

// Monthly puzzles
export const monthlyPuzzles = pgTable("monthly_puzzles", {
  id: serial("id").primaryKey(),
  department: text("department").notNull(),
  month: text("month").notNull(), // YYYY-MM
  title: text("title").notNull(),
  description: text("description").notNull(),
  puzzleData: jsonb("puzzle_data").notNull(), // { type: 'logic' | 'visual' | 'code', content: ... }
  imagePrompt: text("image_prompt").notNull(),
  imageUrl: text("image_url"),
  pointsReward: integer("points_reward").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPuzzleAttempts = pgTable("user_puzzle_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  puzzleId: integer("puzzle_id").notNull(),
  status: text("status").notNull(), // started, solved
  solvedAt: timestamp("solved_at"),
});

// Zod Schemas
export const insertMonthlyPuzzleSchema = createInsertSchema(monthlyPuzzles).omit({ id: true, createdAt: true });
export const insertUserPuzzleAttemptSchema = createInsertSchema(userPuzzleAttempts).omit({ id: true, solvedAt: true });

export type MonthlyPuzzle = typeof monthlyPuzzles.$inferSelect;
export type UserPuzzleAttempt = typeof userPuzzleAttempts.$inferSelect;
export const insertUserSchema = createInsertSchema(users).omit({ id: true, points: true, streak: true, lastLoginDate: true, role: true });
export const insertLdapSettingsSchema = createInsertSchema(ldapSettings).omit({ id: true });
export const insertRewardSchema = createInsertSchema(rewards).omit({ id: true });
export const insertTermSchema = createInsertSchema(terms).omit({ id: true });
export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true, date: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true });
export const insertAiDuelSchema = createInsertSchema(aiDuels).omit({ id: true, createdAt: true });
export const insertAsyncBattleSchema = createInsertSchema(asyncBattles).omit({ id: true, createdAt: true, completedAt: true });
export const insertDailyStreakSchema = createInsertSchema(dailyStreaks).omit({ id: true });
export const insertWeeklyLeaderboardSchema = createInsertSchema(weeklyLeaderboard).omit({ id: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Term = typeof terms.$inferSelect;
export type InsertTerm = z.infer<typeof insertTermSchema>;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
export type LdapSettings = typeof ldapSettings.$inferSelect;
export type InsertLdapSettings = z.infer<typeof insertLdapSettingsSchema>;
export type Reward = typeof rewards.$inferSelect;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type UserReward = typeof userRewards.$inferSelect;
export type UserLearnedTerm = typeof userLearnedTerms.$inferSelect;
export type AiDuel = typeof aiDuels.$inferSelect;
export type InsertAiDuel = z.infer<typeof insertAiDuelSchema>;
export type AsyncBattle = typeof asyncBattles.$inferSelect;
export type InsertAsyncBattle = z.infer<typeof insertAsyncBattleSchema>;
export type DailyStreak = typeof dailyStreaks.$inferSelect;
export type InsertDailyStreak = z.infer<typeof insertDailyStreakSchema>;
export type WeeklyLeaderboard = typeof weeklyLeaderboard.$inferSelect;
export type InsertWeeklyLeaderboard = z.infer<typeof insertWeeklyLeaderboardSchema>;
