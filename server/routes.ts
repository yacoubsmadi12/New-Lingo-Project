import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { Server as SocketIOServer } from "socket.io";
import { User, insertLdapSettingsSchema, insertRewardSchema, users, aiDuels, dailyStreaks, asyncBattles, terms, monthlyPuzzles } from "@shared/schema";
import { db } from "./db";
import { eq, or, and, desc } from "drizzle-orm";
import { registerImageRoutes } from "./replit_integrations/image";
import { registerAudioRoutes } from "./replit_integrations/audio";

// Lazy initialize OpenAI client
let openaiInstance: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is not configured");
    }
    openaiInstance = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiInstance;
}

import { GoogleGenerativeAI } from "@google/generative-ai";

// Lazy-initialize Gemini AI to avoid constructor errors during startup if keys are missing
let aiInstance: GoogleGenerativeAI | null = null;

function getAi() {
  if (!aiInstance) {
    const key = process.env.GOOGLE_API_KEY || 
                process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    
    if (!key) {
      throw new Error("Gemini API key is missing. Please set GOOGLE_API_KEY or use Replit AI integration.");
    }

    aiInstance = new GoogleGenerativeAI(key);
  }
  return aiInstance;
}

async function generateContent(prompt: string): Promise<string> {
  try {
    const ai = getAi();
    const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "";
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}

// Helper: Generate fallback questions from database terms when AI is unavailable
async function generateFallbackQuestions(count: number = 10): Promise<any[]> {
  const allTerms = await db.select().from(terms);
  if (allTerms.length < 4) {
    throw new Error("Not enough terms in database");
  }
  
  const shuffled = [...allTerms].sort(() => Math.random() - 0.5);
  const selectedTerms = shuffled.slice(0, Math.min(count, shuffled.length));
  
  return selectedTerms.map((term, idx) => {
    const truncate = (text: string) => {
      const words = text.split(" ").slice(0, 5).join(" ");
      return text.split(" ").length > 5 ? words + "..." : words;
    };
    const wrongOptions = shuffled
      .filter(t => t.id !== term.id)
      .slice(0, 3)
      .map(t => truncate(t.definition));
    
    const correctDef = truncate(term.definition);
    const options = [...wrongOptions, correctDef].sort(() => Math.random() - 0.5);
    
    return {
      id: idx + 1,
      term: term.term,
      question: `What is the correct definition of "${term.term}"?`,
      options,
      correctAnswer: correctDef
    };
  });
}

import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Register AI Integrations routes
  registerImageRoutes(app);
  registerAudioRoutes(app);
  registerObjectStorageRoutes(app);

  // --- AI Daily Content Generation ---

  app.get("/api/ai/daily-content", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const user = req.user as User;
      const department = (req.query.department as string) || user.department;
      const today = new Date().toISOString().split('T')[0];

      // Check if content already exists for today for this department
      const existingContent = await storage.getDailyContent(department, today);
      if (existingContent) {
        const allTerms = await storage.getTerms(department);
        const term = allTerms.find(t => t.id === existingContent.termId);
        // Mark as learned if not already
        if (term) {
          await storage.markTermAsLearned(user.id, term.id);
        }
        return res.json({
          term,
          quiz: existingContent.quizData
        });
      }

      // Get list of terms the user has already learned to avoid repetition
      const learnedTermsWithDetails = await storage.getUserLearnedTermsWithDetails(user.id);
      const learnedTermsList = learnedTermsWithDetails.map(lt => lt.term.term);
      
      // Create exclusion list for the prompt
      const exclusionNote = learnedTermsList.length > 0 
        ? `\n\nIMPORTANT: The user has already learned these terms, so DO NOT repeat any of them: ${learnedTermsList.join(", ")}.`
        : "";

      // Generate new content using Gemini
      const prompt = `You are an expert in the ${department} department of a telecom operator.

      1. Choose a "Word of the Day" that meets ALL of these criteria:
         - It must be a CORE, HIGH-FREQUENCY term that employees in ${department} actually use in their daily work.
         - It must be industry-specific and directly relevant to the ${department} field within a telecom company.
         - Avoid obscure, rare, or overly academic terms. Pick something practical and important.
         - The 'definition' MUST be a single short sentence (maximum 15 words). Plain language, no jargon.
         - The 'example' must be a realistic, short sentence showing how the term is used in ${department} work.

      2. Generate 5 fun, Kahoot-style multiple choice questions about this term and related common ${department} topics.
         For each question: 'question', 'options' (array of 4 short answers), 'correctAnswer', 'funFact'.
         IMPORTANT: Every option must be 5 words or fewer. No long sentences.
      ${exclusionNote}

      Respond ONLY with a JSON object (no markdown):
      {
        "term": { "term": "...", "definition": "...", "example": "..." },
        "quiz": [
          { "question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": "...", "funFact": "..." }
        ]
      }`;

      const contentText = await generateContent(prompt);
      // Remove markdown code blocks if present
      const jsonStr = contentText.replace(/```json\n?|\n?```/g, '').trim();
      const data = JSON.parse(jsonStr);

      // Save term
      const newTerm = await storage.createTerm({
        term: data.term.term,
        definition: data.term.definition,
        example: data.term.example,
        department
      });

      // Save daily content record
      await storage.createDailyContent({
        department,
        date: today,
        termId: newTerm.id,
        quizData: data.quiz
      });

      // Mark the new term as learned for this user
      await storage.markTermAsLearned(user.id, newTerm.id);
      
      // Also ensure that we track any other terms presented to the user
      // if they are switching between departments
      if (department !== user.department) {
        console.log(`User ${user.id} from ${user.department} is learning from ${department}`);
      }

      res.json({
        term: newTerm,
        quiz: data.quiz
      });

    } catch (error) {
      console.error("Daily Content Gen Error:", error);
      // Fallback: return seeded term + quiz for this department
      try {
        const allTerms = await storage.getTerms(department);
        if (allTerms.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          // Save a daily content record so future requests are served from cache
          let existingDaily = await storage.getDailyContent(department, today);
          if (!existingDaily) {
            await storage.createDailyContent({
              department,
              date: today,
              termId: allTerms[0].id,
              quizData: [],
            });
            existingDaily = await storage.getDailyContent(department, today);
          }
          return res.json({ term: allTerms[0], quiz: existingDaily?.quizData || [] });
        }
      } catch (fallbackErr) {
        console.error("Fallback error:", fallbackErr);
      }
      res.status(500).json({ message: "Failed to generate daily content" });
    }
  });

  app.get("/api/departments", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const departments = await storage.getUniqueDepartments();
      // Ensure current user's department is included even if no other users exist
      const user = req.user as User;
      if (!departments.includes(user.department)) {
        departments.push(user.department);
      }
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  // --- Learned Terms API ---

  // Get all learned terms for the current user
  app.get("/api/user/learned-terms", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const learnedTerms = await storage.getUserLearnedTermsWithDetails(user.id);
      res.json(learnedTerms);
    } catch (error) {
      console.error("Error fetching learned terms:", error);
      res.status(500).json({ message: "Failed to fetch learned terms" });
    }
  });

  // Mark a term as learned
  app.post("/api/user/learned-terms/:termId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const termId = parseInt(req.params.termId);
      const learned = await storage.markTermAsLearned(user.id, termId);
      res.json(learned);
    } catch (error) {
      console.error("Error marking term as learned:", error);
      res.status(500).json({ message: "Failed to mark term as learned" });
    }
  });

  // --- Mini Games API ---

  // Word Rush: 20 random words
  app.get("/api/games/word-rush", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const terms = await storage.getRandomTerms(20);
      res.json(terms);
    } catch (error) {
      console.error("Word Rush Error:", error);
      res.status(500).json({ message: "Failed to fetch words for Word Rush" });
    }
  });

  app.get("/api/ai/monthly-puzzle", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const department = user.department;

      let puzzle = await storage.getMonthlyPuzzle(department, month);
      
      if (!puzzle) {
        const prompt = `Create a professional and engaging logic puzzle for the ${department} department of a telecom operator. 
        Style: Adventure game, Anime/Cartoon aesthetic. 
        The puzzle should be related to ${department} concepts.
        Include a 'title', 'description', and the 'puzzle_data' which contains 'question' and 'answer'.
        Also provide a highly descriptive 'image_prompt' for a vibrant, clean ANIME CARTOON style scene representing this puzzle. 
        Focus on: Bold outlines, vibrant flat colors, high-quality 2D digital illustration, cel-shaded anime style.
        Format as JSON: { "title": "...", "description": "...", "puzzle_data": { "question": "...", "answer": "..." }, "image_prompt": "..." }`;

        const content = await generateContent(prompt);
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        const data = JSON.parse(jsonStr);

        let animeImageUrl = null;
        try {
          // Attempt to generate anime style image if OpenAI is configured
          const { generateImage } = await import("./replit_integrations/image/client");
          animeImageUrl = await generateImage(`${data.image_prompt}, high quality 2D anime cartoon style, bold lines, cel-shaded, vibrant flat colors, cinematic anime 2D illustration, no 3D render`);
        } catch (imgError) {
          console.error("Failed to generate AI image for puzzle, using placeholder:", imgError);
          // Anime cartoon style placeholder
          animeImageUrl = "https://images.unsplash.com/photo-1541562232579-512a21359920?q=80&w=1000&auto=format&fit=crop";
        }

        puzzle = await storage.createMonthlyPuzzle({
          department,
          month,
          title: data.title,
          description: data.description,
          puzzleData: data.puzzle_data,
          imagePrompt: data.image_prompt,
          imageUrl: animeImageUrl,
          pointsReward: 100
        });
      }

      const attempt = await storage.getPuzzleAttempt(user.id, puzzle.id);
      if (!attempt) {
        await storage.createPuzzleAttempt({
          userId: user.id,
          puzzleId: puzzle.id,
          status: "started"
        });
      }

      res.json({ puzzle, solved: attempt?.status === "solved" });
    } catch (error) {
      console.error("Monthly Puzzle Error:", error);
      res.status(500).json({ message: "Failed to fetch/generate monthly puzzle" });
    }
  });

  app.post("/api/ai/monthly-puzzle/solve", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { puzzleId, answer } = req.body;
      const user = req.user as User;
      
      const puzzle = await db.select().from(monthlyPuzzles).where(eq(monthlyPuzzles.id, puzzleId)).limit(1);
      if (!puzzle[0]) return res.status(404).json({ message: "Puzzle not found" });

      const isCorrect = answer.toLowerCase().trim() === (puzzle[0].puzzleData as any).answer.toLowerCase().trim();
      
      if (isCorrect) {
        await storage.solvePuzzle(user.id, puzzleId);
        res.json({ correct: true, message: "Correct! Points awarded." });
      } else {
        res.json({ correct: false, message: "Wrong answer. Try again!" });
      }
    } catch (error) {
      console.error("Solve Puzzle Error:", error);
      res.status(500).json({ message: "Failed to solve puzzle" });
    }
  });

  // --- API Routes ---

  // Generate Avatar
  app.post("/api/user/generate-avatar", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const prompt = `A stylized professional telecom employee avatar, flat design, modern corporate style, friendly expression, vibrant colors.`;
      
      const { generateImage } = await import("./replit_integrations/image/client");
      const avatarUrl = await generateImage(prompt);
      
      await db.update(users).set({ avatarUrl }).where(eq(users.id, (req.user as User).id));
      res.json({ avatarUrl });
    } catch (err) {
      console.error("Avatar Gen Error:", err);
      res.status(500).json({ message: "Failed to generate avatar" });
    }
  });

  // Kahoot-style Quiz Generation (Gemini Emulation)
  app.post("/api/ai/quiz-game", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const { topic = "telecom" } = req.body;
      
      const prompt = `Generate a set of 5 fun, Kahoot-style multiple choice questions about ${topic}. 
      Make them engaging and educational. 
      For each question, provide:
      1. question
      2. options (array of 4) — keep each option short, maximum 6 words, no long sentences
      3. correctAnswer (one of the options)
      4. funFact (a short educational fact about the answer)
      Format as a JSON array of objects.`;

      const content = await generateContent(prompt);
      if (!content) throw new Error("No response from AI");
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      const questions = JSON.parse(jsonStr);
      
      res.json(questions);
    } catch (error) {
      console.error("Quiz Game Gen Error:", error);
      res.status(500).json({ message: "Failed to generate game quiz" });
    }
  });

  // Terms
  app.get(api.terms.list.path, async (req, res) => {
    const department = req.query.department as string | undefined;
    const terms = await storage.getTerms(department);
    res.json(terms);
  });

  app.post(api.terms.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const input = api.terms.create.input.parse(req.body);
      const term = await storage.createTerm(input);
      res.status(201).json(term);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Quizzes
  app.post(api.quizzes.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const input = api.quizzes.create.input.parse(req.body);
      const quiz = await storage.createQuiz(input);
      const user = req.user as User;
      
      if (quiz.score > 0) {
        // Award 10 points for completing a quiz
        await storage.addPoints(user.id, 10, "Quiz completed");
        await storage.updateUserStats(user.id, quiz.score, 1);
      } else {
         await storage.updateUserStats(user.id, 0, 0);
      }

      res.status(201).json(quiz);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json(err);
      }
      throw err;
    }
  });

  app.get(api.quizzes.history.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const history = await storage.getQuizHistory((req.user as User).id);
    res.json(history);
  });

  // Leaderboard
  app.get(api.leaderboard.list.path, async (req, res) => {
    const leaderboard = await storage.getLeaderboard();
    res.json(leaderboard);
  });

  // Badges
  app.get(api.badges.list.path, async (req, res) => {
    const badges = await storage.getBadges();
    res.json(badges);
  });

  app.get(api.badges.userBadges.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userBadges = await storage.getUserBadges((req.user as User).id);
    res.json(userBadges);
  });

  // AI Duel
  app.post(api.ai.duel.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const { topic, difficulty } = req.body;
      
      const prompt = `Generate a multiple-choice question about telecom terms${topic ? ` related to ${topic}` : ''}. 
      Difficulty: ${difficulty}. 
      Format: JSON object with 'question', 'options' (array of 4 strings), and 'correctAnswer' (string, must be one of the options).
      Focus on terms like ARPU, Churn, 5G, KPI, etc.
      IMPORTANT: Keep each option short and concise — maximum 6 words per option. No long sentences.`;

      const content = await generateContent(prompt);
      if (!content) throw new Error("No response from AI");
      
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(jsonStr);
      res.json(result);

    } catch (error) {
      console.error("AI Duel Error:", error);
      res.status(500).json({ message: "Failed to generate duel question" });
    }
  });


  app.get("/api/crossword/generate", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const department = (req.query.department as string) || user.department;
      
      const prompt = `You are a professional crossword creator for a telecom company.
      Create a crossword puzzle for the ${department} department.
      1. Select 8 technical or professional terms related to ${department}.
      2. Arrange them in a 12x12 grid.
      3. For each word, provide: 'word', 'definition', 'x' (0-11), 'y' (0-11), 'direction' ('across' or 'down'), and 'num' (1-8).
      
      CRITICAL: The response MUST be a RAW JSON object ONLY. DO NOT include markdown formatting, DO NOT include \`\`\`json, DO NOT include any text before or after the JSON.
      
      The response MUST be a valid JSON object with:
      - "grid": A 12x12 array (array of arrays) where each element is { "char": string, "isBlocked": boolean, "userChar": "", "x": number, "y": number, "acrossNum"?: number, "downNum"?: number }
      - "placements": An array of { "word": string, "definition": string, "x": number, "y": number, "direction": "across" | "down", "num": number }
      
      Ensure words intersect correctly in the grid.
      Example structure: { "grid": [[{...}, ...], ...], "placements": [{...}, ...] }`;

      console.log(`Generating crossword for ${department}...`);
      const contentText = await generateContent(prompt);
      
      if (!contentText) {
        throw new Error("AI returned empty content");
      }

      // Robust JSON cleaning
      let cleanJson = contentText.trim();
      
      // Remove potential markdown blocks
      if (cleanJson.includes("```")) {
        const matches = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (matches && matches[1]) {
          cleanJson = matches[1].trim();
        } else {
          cleanJson = cleanJson.replace(/```json\n?|\n?```/g, "").trim();
        }
      }

      // Handle cases where AI might add text before/after JSON
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }
      
      try {
        const data = JSON.parse(cleanJson);
        if (!data.grid || !data.placements) {
          throw new Error("Invalid puzzle structure");
        }
        
        // Ensure data is structured correctly for frontend
        const responseData = {
          grid: Array.isArray(data.grid) ? data.grid : [],
          placements: Array.isArray(data.placements) ? data.placements : []
        };

        console.log("Crossword generated successfully for", department);
        res.json(responseData);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Cleaned JSON:", cleanJson);
        throw new Error("AI returned malformed JSON. Please try again.");
      }
    } catch (error) {
      console.error("Crossword Gen Error:", error);
      res.status(500).json({ 
        message: "AI failed to generate a valid puzzle", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // --- Socket.IO Setup ---
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*", 
      methods: ["GET", "POST"]
    }
  });

  // --- TTS Route ---
  app.post("/api/tts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { text } = req.body;
      if (!text) return res.status(400).send("Text is required");
      
      const user = req.user as User;
      await storage.addPoints(user.id, 5, "Listened to text");

      const { textToSpeech } = await import("./replit_integrations/audio/client");
      const audioBuffer = await textToSpeech(text);
      res.set("Content-Type", "audio/wav");
      res.send(audioBuffer);
    } catch (err) {
      console.error("TTS Error:", err);
      res.status(500).send("Failed to generate speech");
    }
  });

  app.post("/api/ai/improve-email", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { text, style = "professional" } = req.body;
      if (!text) return res.status(400).send("Text is required");

      const prompt = `You are a professional email writing consultant for a telecom company.
      Your goal is to HELP the user improve their email, not just rewrite it blindly.
      
      Requested Style: ${style}.
      Context: The user works at a telecom operator.
      
      Original Draft:
      "${text}"
      
      Please provide:
      1. A concise section titled "Suggestions for Improvement" highlighting what was changed and why (max 3 points).
      2. The "Improved Version" of the email.
      
      Keep the tone helpful and coaching-oriented.`;

      const improvedText = await generateContent(prompt);
      res.json({ improvedText });
    } catch (err: any) {
      console.error("Email AI Error:", err);
      // Check for rate limit error from Gemini
      if (err?.status === 429 || (err?.message && err.message.includes("429"))) {
        return res.status(429).json({ 
          message: "The AI is currently busy due to high usage. Please try again in a minute." 
        });
      }
      res.status(500).json({ message: "Failed to improve email style" });
    }
  });

  io.on("connection", (socket) => {
    console.log("New client connected", socket.id);

    socket.on("join_duel", (data) => {
      socket.join("duel_room");
      io.to("duel_room").emit("player_joined", { id: socket.id });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });

  app.patch("/api/user/avatar", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { avatarUrl } = req.body;
      const user = req.user as User;
      await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id));
      res.json({ success: true, avatarUrl });
    } catch (err) {
      console.error("Update Avatar Error:", err);
      res.status(500).json({ message: "Failed to update avatar" });
    }
  });

  app.get("/api/admin/ldap-settings", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const settings = await storage.getLdapSettings();
    res.json(settings);
  });

  app.post("/api/admin/ldap-settings", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    try {
      const input = insertLdapSettingsSchema.parse(req.body);
      const settings = await storage.updateLdapSettings(input);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json(err);
      }
      throw err;
    }
  });

  // Admin: View all users
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const users = await storage.getAllUsers();
    res.json(users);
  });

  // Rewards
  app.get("/api/rewards", async (req, res) => {
    const rewards = await storage.getRewards();
    res.json(rewards);
  });

  app.post("/api/admin/rewards", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    try {
      const input = insertRewardSchema.parse(req.body);
      const reward = await storage.createReward(input);
      res.status(201).json(reward);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json(err);
      }
      throw err;
    }
  });

  app.post("/api/admin/award-reward", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const { userId, rewardId } = req.body;
    const userReward = await storage.awardReward(userId, rewardId);
    res.status(201).json(userReward);
  });

  // Admin: Manually award badge
  app.post("/api/admin/award-badge", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const { userId, badgeId } = req.body;
    const userBadge = await storage.awardBadge(userId, badgeId);
    res.status(201).json(userBadge);
  });

  // Admin: LDAP Sync (Stub)
  app.post("/api/admin/ldap-sync", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    res.json({ message: "LDAP sync initiated", userCount: 150 });
  });

  // Admin: Get all badges
  app.get("/api/admin/badges", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const badges = await storage.getBadges();
    res.json(badges);
  });

  // --- Points API ---
  app.post("/api/user/points", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { points, reason } = req.body;
      const user = req.user as User;
      const updatedUser = await storage.addPoints(user.id, points, reason);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error adding points:", error);
      res.status(500).json({ message: "Failed to add points" });
    }
  });

  // --- Term Duel API ---
  app.post("/api/duel/start", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const { difficulty, aiPersonality } = req.body;
      
      const questionCount = 5;
      const difficultyPrompt = difficulty === "easy" 
        ? "basic, straightforward questions" 
        : difficulty === "hard" 
          ? "challenging, tricky questions with subtle distinctions" 
          : "moderately challenging questions";
      
      const personalityPrompt = aiPersonality === "trickster"
        ? "Include some tricky options that are close to the correct answer but subtly wrong."
        : aiPersonality === "aggressive_challenger"
          ? "Make questions that test quick thinking and exact knowledge."
          : "Create educational questions that help learners understand concepts.";
      
      let questions;
      try {
        const prompt = `Generate ${questionCount} telecom industry vocabulary quiz questions for the ${user.department} department.
      
Requirements:
- Difficulty: ${difficultyPrompt}
- Style: ${personalityPrompt}
- Each question should test knowledge of a specific telecom term
- Include 4 options per question with only one correct answer
- Provide the term, its definition, and a practical example
- IMPORTANT: Keep each option short and concise — maximum 6 words per option. No long sentences.

Return ONLY valid JSON array with this exact structure:
[
  {
    "id": 1,
    "term": "the telecom term",
    "question": "the question text",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "the correct option exactly as it appears in options",
    "definition": "brief definition of the term",
    "example": "practical example of using this term"
  }
]`;

        const response = await generateContent(prompt);
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON array found");
        }
      } catch (aiError) {
        console.log("AI unavailable for duel, using fallback questions");
        const fallback = await generateFallbackQuestions(questionCount);
        questions = fallback.map(q => ({
          ...q,
          definition: "See explanation after the quiz",
          example: "Commonly used in telecom contexts"
        }));
      }

      const [duel] = await db.insert(aiDuels).values({
        userId: user.id,
        difficulty,
        aiPersonality,
        totalQuestions: questionCount,
        wrongAnswers: [],
      }).returning();

      res.json({ duelId: duel.id, questions });
    } catch (error) {
      console.error("Error starting duel:", error);
      res.status(500).json({ message: "Failed to start duel" });
    }
  });

  app.post("/api/duel/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const { duelId, userScore, aiScore, wrongAnswers, xpEarned, won } = req.body;
      
      await db.update(aiDuels)
        .set({
          userScore,
          aiScore,
          wrongAnswers,
          xpEarned,
          completed: true,
        })
        .where(eq(aiDuels.id, duelId));

      await storage.addPoints(user.id, xpEarned, "Term Duel completion");

      const newBadges: string[] = [];
      
      if (won) {
        const allDuels = await db.select()
          .from(aiDuels)
          .where(eq(aiDuels.userId, user.id));
        
        const wins = allDuels.filter(d => d.userScore > d.aiScore).length;
        
        if (wins === 5) newBadges.push("AI Slayer");
        if (wins === 10) newBadges.push("AI Master");
        if (wins === 25) newBadges.push("AI Legend");
        
        const hardWins = allDuels.filter(d => d.difficulty === "hard" && d.userScore > d.aiScore).length;
        if (hardWins === 5) newBadges.push("Hard Mode Hero");
      }
      
      if (wrongAnswers.length === 0 && userScore > 0) {
        newBadges.push("Perfect Score");
      }

      res.json({ success: true, newBadges });
    } catch (error) {
      console.error("Error completing duel:", error);
      res.status(500).json({ message: "Failed to complete duel" });
    }
  });

  // --- Daily Mix API ---
  app.get("/api/daily-mix/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const today = new Date().toISOString().split("T")[0];
      
      const [streak] = await db.select()
        .from(dailyStreaks)
        .where(eq(dailyStreaks.userId, user.id));
      
      if (!streak) {
        const [newStreak] = await db.insert(dailyStreaks)
          .values({ userId: user.id })
          .returning();
        return res.json({
          currentStreak: 0,
          longestStreak: 0,
          completedToday: false,
          canSaveStreak: false,
        });
      }

      const completedToday = streak.lastCompletedDate === today;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      
      const canSaveStreak = !completedToday && 
                           streak.lastCompletedDate === yesterdayStr &&
                           streak.currentStreak > 0;

      res.json({
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        completedToday,
        canSaveStreak,
        totalDaysCompleted: streak.totalDaysCompleted,
      });
    } catch (error) {
      console.error("Error getting daily mix status:", error);
      res.status(500).json({ message: "Failed to get status" });
    }
  });

  app.post("/api/daily-mix/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const { score, totalQuestions } = req.body;
      const today = new Date().toISOString().split("T")[0];
      
      let [streak] = await db.select()
        .from(dailyStreaks)
        .where(eq(dailyStreaks.userId, user.id));
      
      if (!streak) {
        [streak] = await db.insert(dailyStreaks)
          .values({ userId: user.id })
          .returning();
      }

      if (streak.lastCompletedDate === today) {
        return res.json({ message: "Already completed today", streak });
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      
      let newStreak = 1;
      if (streak.lastCompletedDate === yesterdayStr) {
        newStreak = streak.currentStreak + 1;
      }
      
      const newLongest = Math.max(streak.longestStreak, newStreak);
      
      await db.update(dailyStreaks)
        .set({
          currentStreak: newStreak,
          longestStreak: newLongest,
          lastCompletedDate: today,
          totalDaysCompleted: streak.totalDaysCompleted + 1,
        })
        .where(eq(dailyStreaks.id, streak.id));

      let bonusXP = 0;
      const newBadges: string[] = [];
      
      if (newStreak === 3) {
        bonusXP = 50;
        newBadges.push("Streak Starter");
      } else if (newStreak === 7) {
        bonusXP = 100;
        newBadges.push("Weekly Warrior");
      } else if (newStreak === 30) {
        bonusXP = 500;
        newBadges.push("Monthly Master");
      }
      
      const baseXP = Math.round((score / totalQuestions) * 30);
      const totalXP = baseXP + bonusXP;
      
      await storage.addPoints(user.id, totalXP, "Daily Mix completion");

      res.json({
        success: true,
        newStreak,
        bonusXP,
        totalXP,
        newBadges,
      });
    } catch (error) {
      console.error("Error completing daily mix:", error);
      res.status(500).json({ message: "Failed to complete daily mix" });
    }
  });

  app.post("/api/daily-mix/save-streak", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const xpCost = 50;
      
      if (user.points < xpCost) {
        return res.status(400).json({ message: "Not enough XP to save streak" });
      }

      const [streak] = await db.select()
        .from(dailyStreaks)
        .where(eq(dailyStreaks.userId, user.id));
      
      if (!streak) {
        return res.status(400).json({ message: "No streak to save" });
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      await db.update(dailyStreaks)
        .set({
          lastCompletedDate: yesterdayStr,
          streakSaversUsed: streak.streakSaversUsed + 1,
        })
        .where(eq(dailyStreaks.id, streak.id));

      await db.update(users)
        .set({ points: user.points - xpCost })
        .where(eq(users.id, user.id));

      res.json({ success: true, xpSpent: xpCost });
    } catch (error) {
      console.error("Error saving streak:", error);
      res.status(500).json({ message: "Failed to save streak" });
    }
  });

  // --- Async Battle API ---
  app.post("/api/battle/create", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const { opponentId } = req.body;
      
      let questions;
      try {
        const prompt = `Generate 10 telecom industry vocabulary quiz questions suitable for a competitive battle.
Mix questions from different departments: Engineering, Finance, Marketing, and GRC.
Each question should be challenging but fair.
IMPORTANT: Keep each option short and concise — maximum 6 words per option. No long sentences.

Return ONLY valid JSON array:
[
  {
    "id": 1,
    "term": "telecom term",
    "question": "question text",
    "options": ["opt1", "opt2", "opt3", "opt4"],
    "correctAnswer": "exact correct option"
  }
]`;

        const response = await generateContent(prompt);
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch (aiError) {
        console.log("AI unavailable, using fallback questions");
        questions = await generateFallbackQuestions(10);
      }

      const [battle] = await db.insert(asyncBattles).values({
        challengerId: user.id,
        opponentId: opponentId || null,
        questions,
        status: opponentId ? "active" : "pending",
      }).returning();

      res.json({ battleId: battle.id, questions });
    } catch (error) {
      console.error("Error creating battle:", error);
      res.status(500).json({ message: "Failed to create battle" });
    }
  });

  app.get("/api/battle/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      
      const battles = await db.select()
        .from(asyncBattles)
        .where(eq(asyncBattles.status, "pending"));
      
      const availableBattles = battles.filter(b => b.challengerId !== user.id);
      
      const battlesWithUsers = await Promise.all(
        availableBattles.map(async (b) => {
          const challenger = await storage.getUser(b.challengerId);
          return {
            ...b,
            challengerName: challenger?.fullName || challenger?.username || "Unknown",
          };
        })
      );

      res.json(battlesWithUsers);
    } catch (error) {
      console.error("Error getting pending battles:", error);
      res.status(500).json({ message: "Failed to get battles" });
    }
  });

  app.post("/api/battle/join/:battleId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const battleId = parseInt(req.params.battleId);
      
      const [battle] = await db.select()
        .from(asyncBattles)
        .where(eq(asyncBattles.id, battleId));
      
      if (!battle || battle.status !== "pending") {
        return res.status(400).json({ message: "Battle not available" });
      }

      await db.update(asyncBattles)
        .set({
          opponentId: user.id,
          status: "active",
        })
        .where(eq(asyncBattles.id, battleId));

      res.json({ success: true, questions: battle.questions });
    } catch (error) {
      console.error("Error joining battle:", error);
      res.status(500).json({ message: "Failed to join battle" });
    }
  });

  app.post("/api/battle/submit/:battleId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const battleId = parseInt(req.params.battleId);
      const { answers, score } = req.body;
      
      const [battle] = await db.select()
        .from(asyncBattles)
        .where(eq(asyncBattles.id, battleId));
      
      if (!battle) {
        return res.status(404).json({ message: "Battle not found" });
      }

      const isChallenger = battle.challengerId === user.id;
      
      if (isChallenger) {
        await db.update(asyncBattles)
          .set({
            challengerAnswers: answers,
            challengerScore: score,
          })
          .where(eq(asyncBattles.id, battleId));
      } else {
        const [updated] = await db.update(asyncBattles)
          .set({
            opponentAnswers: answers,
            opponentScore: score,
          })
          .where(eq(asyncBattles.id, battleId))
          .returning();
        
        if (updated.challengerScore !== null && updated.opponentScore !== null) {
          let winnerId = null;
          if (updated.challengerScore > updated.opponentScore) {
            winnerId = updated.challengerId;
          } else if (updated.opponentScore > updated.challengerScore) {
            winnerId = updated.opponentId;
          }
          
          await db.update(asyncBattles)
            .set({
              status: "completed",
              winnerId,
              completedAt: new Date(),
            })
            .where(eq(asyncBattles.id, battleId));
          
          if (winnerId) {
            await storage.addPoints(winnerId, 50, "Battle victory");
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error submitting battle:", error);
      res.status(500).json({ message: "Failed to submit answers" });
    }
  });

  app.get("/api/battle/my-battles", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = req.user as User;
      const battles = await db.select()
        .from(asyncBattles)
        .where(or(
          eq(asyncBattles.challengerId, user.id),
          eq(asyncBattles.opponentId, user.id)
        ));

      res.json(battles);
    } catch (error) {
      console.error("Error getting my battles:", error);
      res.status(500).json({ message: "Failed to get battles" });
    }
  });

  app.get("/api/leaderboard/weekly", async (req, res) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      const weekStart = startOfWeek.toISOString().split("T")[0];

      const allUsers = await storage.getAllUsers();
      const leaderboard = allUsers
        .map(u => ({
          id: u.id,
          name: u.fullName || u.username,
          points: u.points,
          department: u.department,
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 20);

      res.json(leaderboard);
    } catch (error) {
      console.error("Error getting weekly leaderboard:", error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  // --- Seed Data ---
  await seedData();

  return httpServer;
}

async function seedData() {
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    await storage.createUser({
      username: "admin",
      password: "admin_password",
      fullName: "Admin User",
      email: "admin@example.com",
      department: "Governance, Risk, and Compliance",
      role: "admin"
    });
    console.log("Seeded admin user");
  }

  const existingEmployee = await storage.getUserByUsername("employee1");
  if (!existingEmployee) {
    await storage.createUser({
      username: "employee1",
      password: "employee_password",
      fullName: "Regular Employee",
      email: "employee@example.com",
      department: "Engineering",
      role: "employee"
    });
    console.log("Seeded employee user");
  }

  const existingHrUser = await storage.getUserByUsername("HRUSER");
  if (!existingHrUser) {
    await storage.createUser({
      username: "HRUSER",
      password: "hruser123",
      fullName: "HR User",
      email: "hr@example.com",
      department: "Human Resources",
      role: "employee"
    });
    console.log("Seeded HR user");
  }

  // Seed mock terms for all departments (used when AI is unavailable)
  await seedMockTermsAndDailyContent();

  const existingBadges = await storage.getBadges();
  if (existingBadges.length === 0) {
    const badgesData = [
      { name: "First Steps", description: "Completed your first quiz", icon: "footprints", condition: "quiz:1" },
      { name: "Streak Master", description: "Reached a 7-day streak", icon: "flame", condition: "streak:7" },
      { name: "Terminator", description: "Learned 50 terms", icon: "skull", condition: "terms:50" },
      { name: "Duelist", description: "Won 5 duels", icon: "swords", condition: "duels:5" },
      { name: "Shield", description: "Earned 300 points", icon: "shield", condition: "points:300" },
      { name: "Medium Shield", description: "Earned 500 points", icon: "shield-check", condition: "points:500" },
      { name: "Bronze Shield", description: "Earned 1000 points", icon: "shield-plus", condition: "points:1000" },
    ];
    for (const b of badgesData) {
      await storage.createBadge(b);
    }
    console.log("Seeded badges");
  }
}

async function seedMockTermsAndDailyContent() {
  const mockTermsByDepartment: Record<string, Array<{ term: string; definition: string; example: string }>> = {
    "Engineering": [
      { term: "Network Latency", definition: "The delay before data transfer begins.", example: "High latency causes buffering in video calls." },
      { term: "Bandwidth", definition: "The maximum data transfer rate of a network.", example: "We upgraded bandwidth to support 4K streaming." },
      { term: "Fiber Optic", definition: "Cable using light pulses to transmit data at high speed.", example: "Fiber optic lines replaced copper for faster internet." },
      { term: "SLA (Service Level Agreement)", definition: "A contract defining expected service performance standards.", example: "Our SLA guarantees 99.9% network uptime." },
      { term: "5G NR", definition: "The global standard for fifth-generation cellular networks.", example: "5G NR enables speeds 10x faster than 4G LTE." },
    ],
    "Finance": [
      { term: "ARPU", definition: "Average Revenue Per User — revenue divided by subscriber count.", example: "ARPU rose to $25 after the premium plan launch." },
      { term: "EBITDA", definition: "Earnings before interest, taxes, depreciation, and amortization.", example: "Our EBITDA margin improved to 38% this quarter." },
      { term: "CapEx", definition: "Capital expenditure — funds used to acquire long-term assets.", example: "Network CapEx increased due to 5G tower investments." },
      { term: "OpEx", definition: "Operating expenditure — day-to-day business costs.", example: "Reducing OpEx is a key Q3 cost-optimization goal." },
      { term: "Churn Rate", definition: "The percentage of subscribers who cancel in a given period.", example: "Churn rate dropped to 1.8% after loyalty program launch." },
    ],
    "Human Resources": [
      { term: "Onboarding", definition: "The process of integrating a new employee into the organization.", example: "Our 30-day onboarding plan includes buddy assignment." },
      { term: "KPI", definition: "Key Performance Indicator — a measurable value showing goal achievement.", example: "Each team tracks KPIs in the monthly review." },
      { term: "Succession Planning", definition: "Identifying and developing employees to fill leadership roles.", example: "Succession planning ensures business continuity." },
      { term: "Talent Acquisition", definition: "The process of finding and hiring skilled employees.", example: "Talent acquisition focused on cloud engineers this cycle." },
      { term: "Employee Engagement", definition: "The level of commitment and enthusiasm employees show for their work.", example: "Pulse surveys measure employee engagement quarterly." },
    ],
    "Marketing": [
      { term: "NPS (Net Promoter Score)", definition: "A metric measuring customer loyalty and likelihood to recommend.", example: "Our NPS score reached 62 after the rebranding campaign." },
      { term: "CTR (Click-Through Rate)", definition: "Percentage of people who click an ad after seeing it.", example: "The new banner ad achieved a 4.5% CTR." },
      { term: "Brand Equity", definition: "The commercial value from customer perception of a brand.", example: "Zain's brand equity drives premium pricing power." },
      { term: "CPA (Cost Per Acquisition)", definition: "Total cost to acquire one paying customer.", example: "Digital ads reduced CPA by 30% vs print." },
      { term: "Segmentation", definition: "Dividing a market into groups with shared characteristics.", example: "Segmentation targets youth with prepaid plans." },
    ],
    "Sales": [
      { term: "Pipeline", definition: "A visual representation of prospects at each sales stage.", example: "The Q4 pipeline has $2M in potential deals." },
      { term: "Upselling", definition: "Encouraging a customer to purchase a higher-value product.", example: "Upselling postpaid customers to 5G plans increased ARPU." },
      { term: "Conversion Rate", definition: "The percentage of leads that become paying customers.", example: "Our conversion rate improved to 22% this month." },
      { term: "Cross-selling", definition: "Offering related products to an existing customer.", example: "Cross-selling fiber internet to mobile subscribers." },
      { term: "Lead Qualification", definition: "Determining whether a prospect is likely to become a customer.", example: "Lead qualification filters ensure sales focus on high-value clients." },
    ],
    "Governance, Risk, and Compliance": [
      { term: "Regulatory Compliance", definition: "Adherence to laws and regulations governing business operations.", example: "Regulatory compliance audits are conducted bi-annually." },
      { term: "Risk Appetite", definition: "The level of risk an organization is willing to accept.", example: "Our risk appetite limits network downtime to under 1 hour/year." },
      { term: "KYC (Know Your Customer)", definition: "The process of verifying customer identity to prevent fraud.", example: "KYC checks are mandatory for all new SIM activations." },
      { term: "Data Governance", definition: "A set of policies ensuring data quality, security, and proper use.", example: "Data governance standards protect customer information." },
      { term: "Internal Audit", definition: "An independent review of a company's processes and controls.", example: "Internal audit identified gaps in vendor management." },
    ],
    "Consumer Business": [
      { term: "Customer Lifecycle", definition: "The stages a customer goes through from acquisition to retention.", example: "Mapping the customer lifecycle improves retention strategy." },
      { term: "Loyalty Program", definition: "A rewards system incentivizing repeat purchases.", example: "Our loyalty program reduced churn by 15%." },
      { term: "Customer Experience (CX)", definition: "The overall perception a customer has of a brand.", example: "CX improvements led to a 10-point NPS increase." },
      { term: "Retail Channel", definition: "Physical or digital outlets where products are sold to consumers.", example: "We expanded retail channels to 50 new outlets." },
      { term: "Prepaid", definition: "A billing model where customers pay before using services.", example: "Prepaid plans dominate youth market segments." },
    ],
    "Legal and Regulatory": [
      { term: "Spectrum License", definition: "Government authorization to use specific radio frequency bands.", example: "Zain holds a spectrum license for 700MHz and 3.5GHz bands." },
      { term: "Interconnection Agreement", definition: "A contract between operators to exchange network traffic.", example: "Interconnection agreements enable cross-network calls." },
      { term: "Regulatory Sandbox", definition: "A controlled environment to test innovations under lighter regulation.", example: "The fintech sandbox allowed testing of mobile payments." },
      { term: "MVNO (Mobile Virtual Network Operator)", definition: "A company that sells mobile services using another operator's network.", example: "MVNOs lease our network to serve niche markets." },
      { term: "Data Residency", definition: "The requirement that data be stored within a specific country's borders.", example: "Data residency laws require local storage of user records." },
    ],
    "Technology & Digital Innovation": [
      { term: "API (Application Programming Interface)", definition: "A set of rules allowing applications to communicate.", example: "Our payment API connects apps to billing systems." },
      { term: "Cloud Computing", definition: "Delivering computing services over the internet on demand.", example: "Migrating to cloud cut infrastructure costs by 40%." },
      { term: "Digital Transformation", definition: "Integrating digital technology into all business areas.", example: "Digital transformation improved service delivery speed." },
      { term: "Edge Computing", definition: "Processing data near its source rather than in a central server.", example: "Edge computing reduces latency for IoT devices." },
      { term: "DevOps", definition: "A practice combining software development and IT operations for faster delivery.", example: "DevOps pipelines deploy updates 10x faster." },
    ],
    "Corporate Communications & Sustainability": [
      { term: "ESG (Environmental, Social, Governance)", definition: "Criteria measuring a company's ethical impact.", example: "ESG reporting attracted responsible investors." },
      { term: "Stakeholder Engagement", definition: "Building relationships with groups affected by business decisions.", example: "Stakeholder engagement forums shape our CSR strategy." },
      { term: "Carbon Footprint", definition: "Total greenhouse gas emissions caused by an organization.", example: "We reduced our carbon footprint by 20% through solar energy." },
      { term: "Media Relations", definition: "Managing communication between an organization and the press.", example: "Media relations secured positive coverage of our 5G launch." },
      { term: "Corporate Social Responsibility (CSR)", definition: "Business commitment to positively impact society and environment.", example: "CSR initiatives funded digital literacy programs." },
    ],
    "Data Analytics and AI": [
      { term: "Machine Learning (ML)", definition: "AI systems that learn from data to improve performance.", example: "ML models predict customer churn with 92% accuracy." },
      { term: "Data Pipeline", definition: "A series of processes that move and transform data.", example: "Our data pipeline processes 10 million records daily." },
      { term: "Predictive Analytics", definition: "Using historical data to forecast future outcomes.", example: "Predictive analytics optimizes network capacity planning." },
      { term: "Data Lake", definition: "A centralized repository storing structured and unstructured data at scale.", example: "The data lake consolidates CRM and network logs." },
      { term: "BI (Business Intelligence)", definition: "Technologies for analyzing business data to support decisions.", example: "BI dashboards give executives real-time revenue insights." },
    ],
  };

  const mockQuizByDepartment: Record<string, any[]> = {
    "Engineering": [
      { question: "What does SLA stand for?", options: ["Service Level Agreement", "System Load Analysis", "Signal Link Allocation", "Software Licensing Act"], correctAnswer: "Service Level Agreement", funFact: "SLAs are legally binding contracts!" },
      { question: "Which cable uses light pulses for data?", options: ["Copper wire", "Fiber Optic", "Coaxial cable", "Ethernet"], correctAnswer: "Fiber Optic", funFact: "Light travels at 299,792 km/s in fiber!" },
      { question: "What is network latency?", options: ["Data transfer speed", "Delay before transfer starts", "Cable thickness", "Signal strength"], correctAnswer: "Delay before transfer starts", funFact: "Low latency is critical for gaming and VoIP!" },
      { question: "5G NR is how much faster than 4G?", options: ["2x", "5x", "10x", "Same speed"], correctAnswer: "10x", funFact: "5G can reach 20 Gbps theoretical peak speed!" },
      { question: "What does 'bandwidth' measure?", options: ["Signal delay", "Max data transfer rate", "Network distance", "Cable length"], correctAnswer: "Max data transfer rate", funFact: "Bandwidth is like the width of a highway — more lanes, more cars!" },
    ],
    "Finance": [
      { question: "What does ARPU measure?", options: ["Total revenue", "Revenue per user", "Annual growth", "Customer count"], correctAnswer: "Revenue per user", funFact: "Telecom companies track ARPU closely to gauge monetization." },
      { question: "CapEx stands for?", options: ["Capital Expenditure", "Capacity Extension", "Cost Approximation", "Core Asset Exchange"], correctAnswer: "Capital Expenditure", funFact: "5G rollout is one of the biggest CapEx investments in telecom history." },
      { question: "A low churn rate means?", options: ["More customers leaving", "Fewer customers leaving", "Higher costs", "Lower revenue"], correctAnswer: "Fewer customers leaving", funFact: "Reducing churn by 5% can increase profits by 25-95%!" },
      { question: "EBITDA excludes which of these?", options: ["Revenue", "Cost of goods", "Depreciation", "Salaries"], correctAnswer: "Depreciation", funFact: "EBITDA gives a cleaner view of operational profitability." },
      { question: "OpEx refers to?", options: ["Long-term asset costs", "Day-to-day business costs", "Equity payments", "One-time investments"], correctAnswer: "Day-to-day business costs", funFact: "Cloud services shift costs from CapEx to OpEx for telcos." },
    ],
    "Human Resources": [
      { question: "What is onboarding?", options: ["Firing employees", "Training new hires", "Performance review", "Budget planning"], correctAnswer: "Training new hires", funFact: "Good onboarding increases retention by 82%!" },
      { question: "KPI stands for?", options: ["Key Process Integration", "Knowledge Performance Index", "Key Performance Indicator", "Known People Issue"], correctAnswer: "Key Performance Indicator", funFact: "KPIs were popularized by management guru Peter Drucker." },
      { question: "Succession planning prepares?", options: ["Budget forecasts", "Future leaders", "Product launches", "Network upgrades"], correctAnswer: "Future leaders", funFact: "Only 35% of companies have a formal succession plan." },
      { question: "Employee engagement measures?", options: ["Salary levels", "Work hours", "Commitment to work", "Office location"], correctAnswer: "Commitment to work", funFact: "Engaged employees are 21% more productive!" },
      { question: "Talent acquisition focuses on?", options: ["Training staff", "Hiring skilled people", "Setting salaries", "Reducing headcount"], correctAnswer: "Hiring skilled people", funFact: "AI now screens 75% of resumes before human review." },
    ],
  };

  const today = new Date().toISOString().split("T")[0];

  for (const [dept, termsList] of Object.entries(mockTermsByDepartment)) {
    const existingTerms = await storage.getTerms(dept);
    if (existingTerms.length === 0) {
      for (const t of termsList) {
        await storage.createTerm({ ...t, department: dept });
      }
      console.log(`Seeded mock terms for ${dept}`);
    }

    const existingDaily = await storage.getDailyContent(dept, today);
    if (!existingDaily) {
      const allTerms = await storage.getTerms(dept);
      const chosenTerm = allTerms[0];
      if (chosenTerm) {
        const quiz = mockQuizByDepartment[dept] || mockQuizByDepartment["Engineering"];
        await storage.createDailyContent({
          department: dept,
          date: today,
          termId: chosenTerm.id,
          quizData: quiz,
        });
        console.log(`Seeded daily content for ${dept}`);
      }
    }
  }
}
