import { useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/Navigation";
import { StatCard } from "@/components/StatCard";
import { Trophy, Flame, Zap, Target, ArrowRight, User as UserIcon, BookOpen, Info, Code2, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

function EngineeringSpotlight({ term, quiz }: { term: any; quiz: any[] }) {
  const [quizStep, setQuizStep] = useState<"word" | "quiz" | "done">("word");
  const [selected, setSelected] = useState<string | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const question = quiz?.[0];

  const handleAnswer = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    setCorrect(opt === question?.correctAnswer);
    setTimeout(() => setQuizStep("done"), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative overflow-hidden rounded-2xl text-white shadow-xl"
      style={{
        background: "linear-gradient(135deg, #2d0a52 0%, #4a1480 50%, #6B21A8 100%)",
        border: "1px solid rgba(249,115,22,0.3)",
        boxShadow: "0 8px 32px rgba(107,33,168,0.35)",
      }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 -translate-y-1/2 translate-x-1/4"
        style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />

      <div className="relative z-10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: "rgba(249,115,22,0.25)", border: "1px solid rgba(249,115,22,0.4)" }}>
            <Code2 className="w-3 h-3" style={{ color: "#f97316" }} />
            <span style={{ color: "#f97316" }}>Engineering · Word of the Day</span>
          </div>
        </div>

        {quizStep === "word" && term && (
          <div className="space-y-3">
            <h2 className="text-3xl font-black tracking-tight">{term.term}</h2>
            <p className="text-white/80 text-sm leading-relaxed">{term.definition}</p>
            {term.example && (
              <p className="text-white/55 text-xs italic">"{term.example}"</p>
            )}
            <button
              onClick={() => setQuizStep("quiz")}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all"
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                boxShadow: "0 4px 14px rgba(249,115,22,0.4)",
              }}
            >
              Test Your Knowledge <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {quizStep === "quiz" && question && (
          <div className="space-y-3">
            <p className="font-semibold text-sm text-white/90">{question.question}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {question.options?.map((opt: string) => {
                const isSelected = selected === opt;
                const isCorrectOpt = opt === question.correctAnswer;
                let bg = "rgba(255,255,255,0.08)";
                if (isSelected && correct) bg = "rgba(34,197,94,0.3)";
                if (isSelected && !correct) bg = "rgba(239,68,68,0.3)";
                if (!isSelected && selected && isCorrectOpt) bg = "rgba(34,197,94,0.2)";
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={!!selected}
                    className="text-left px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: bg, border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {selected && (
              <p className="text-xs text-white/70 italic">💡 {question.funFact}</p>
            )}
          </div>
        )}

        {quizStep === "done" && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
              <div>
                <p className="font-bold">Great job!</p>
                <p className="text-sm text-white/70">Keep it up in the full quiz</p>
              </div>
            </div>
            <Link href="/quiz/daily">
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 4px 14px rgba(249,115,22,0.4)" }}>
                Full Quiz <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "admin"
  });

  const isEngineering = user?.department === "Engineering";

  const { data: dailyContent } = useQuery<{ term: any; quiz: any[] }>({
    queryKey: ["/api/ai/daily-content"],
    enabled: !!user && isEngineering,
    retry: false,
  });

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (isAdmin) {
    return (
      <div className="flex min-h-screen bg-background pb-20 md:pb-0">
        <Navigation />
        <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-display font-bold">
                System <span className="text-primary">Overview</span>
              </h1>
              <p className="text-muted-foreground mt-1">Real-time employee performance and engagement tracking.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Total Employees" value={allUsers?.length || 0} icon={UserIcon} color="primary" />
              <StatCard label="Avg. Points" value={allUsers ? Math.round(allUsers.reduce((acc, u) => acc + u.points, 0) / (allUsers.length || 1)) : 0} icon={Trophy} color="secondary" />
              <StatCard label="Active Streaks" value={allUsers?.filter(u => u.streak > 0).length || 0} icon={Flame} color="orange" />
            </div>

            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Employee Performance Tracker
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Points</TableHead>
                      <TableHead className="text-center">Streak</TableHead>
                      <TableHead className="text-center">Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers?.map((u) => (
                      <TableRow key={u.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="pl-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold">{u.fullName || u.username}</span>
                            <span className="text-xs text-muted-foreground">{u.email || `@${u.username}`}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                            {u.department}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1 font-mono font-bold text-primary">
                            <Zap className="w-3 h-3" />{u.points}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1 font-mono font-bold text-orange-500">
                            <Flame className="w-3 h-3" />{u.streak}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">
                            {u.lastLoginDate ? new Date(u.lastLoginDate).toLocaleDateString() : 'Never'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-display font-bold">
                {isEngineering ? "👋 Welcome, " : "Hello, "}
                <span className="text-primary">{user.fullName || user.username}</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">{user.department} · Ready to learn today?</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <button className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-semibold hover:bg-primary/20 transition-all">
                  <Info className="w-4 h-4" />
                  Rewards Guide
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-primary" />
                    Z-Points & Rewards
                  </DialogTitle>
                  <DialogDescription className="text-base pt-4">
                    Maximize your learning and earn exclusive prizes from HR by accumulating Z-Points!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      How to earn points:
                    </h3>
                    <ul className="grid gap-2 text-sm">
                      {[
                        ["Daily Login", "+5 pts"],
                        ["View Department Terms", "+5 pts"],
                        ["Listen to Avatar (TTS)", "+5 pts"],
                        ["Main Quiz Completion", "+10 pts"],
                        ["Additional Practice Quiz", "+5 pts"],
                      ].map(([label, pts]) => (
                        <li key={label} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                          <span>{label}</span>
                          <span className="font-bold text-primary">{pts}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3 pt-2">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-secondary" />
                      Badge Milestones:
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {[["300 pts", "Shield"], ["500 pts", "Med. Shield"], ["1000 pts", "Bronze Shield"]].map(([pts, name]) => (
                        <div key={name} className="p-2 border rounded-xl bg-card">
                          <div className="font-bold text-primary">{pts}</div>
                          <div className="text-muted-foreground">{name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-center text-muted-foreground italic bg-secondary/5 p-3 rounded-xl border border-secondary/10">
                    The HR team distributes annual prizes to the top point earners on the leaderboard.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Engineering: Word of the Day Spotlight */}
          {isEngineering && dailyContent?.term && (
            <EngineeringSpotlight term={dailyContent.term} quiz={dailyContent.quiz || []} />
          )}

          {/* Stats */}
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-3 gap-4">
            <motion.div variants={item}>
              <StatCard label="Z-Points" value={user.points} icon={Trophy} color="primary" />
            </motion.div>
            <motion.div variants={item}>
              <StatCard label="Words Learned" value={user.wordsLearned || 0} icon={BookOpen} color="blue" />
            </motion.div>
            <motion.div variants={item}>
              <WeeklyMomentumCard streak={user.streak} />
            </motion.div>
          </motion.div>

          {/* Daily Challenge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white p-6 shadow-lg shadow-primary/20"
          >
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">
                  <Target className="w-3 h-3" /> Daily Goal
                </div>
                <h2 className="text-2xl font-display font-bold">Complete Today's Quiz</h2>
                <p className="text-primary-foreground/80 text-sm">
                  Earn double points with {user.department} terms.
                </p>
              </div>
              <Link href="/quiz">
                <button className="shrink-0 px-6 py-3 bg-white text-primary rounded-xl font-bold shadow hover:bg-zinc-50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-sm">
                  Start Quiz <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
            <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/4 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          </motion.div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/learn">
              <div className="group cursor-pointer bg-card rounded-xl p-5 border shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold mb-1 group-hover:text-primary transition-colors">Flashcards</h3>
                <p className="text-muted-foreground text-sm">Review terms for your department.</p>
              </div>
            </Link>

            <Link href="/quiz">
              <div className="group cursor-pointer bg-card rounded-xl p-5 border shadow-sm hover:border-secondary/40 hover:shadow-md transition-all duration-200">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Trophy className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold mb-1 group-hover:text-secondary transition-colors">Play Games</h3>
                <p className="text-muted-foreground text-sm">Term Duel vs AI or Crossword challenge.</p>
              </div>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}

function WeeklyMomentumCard({ streak }: { streak: number }) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  const mondayOffset = today === 0 ? 6 : today - 1;
  const activeDays = Math.min(streak, 7);

  return (
    <div className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className="p-3 rounded-xl border bg-orange-500/10 text-orange-600 border-orange-500/20">
          <Flame className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-3xl font-display font-bold text-foreground mb-1">{streak}</h3>
      <p className="text-sm text-muted-foreground font-medium mb-3">Weekly Momentum</p>
      <div className="flex gap-1 justify-between">
        {days.map((d, i) => {
          const dayIndex = (mondayOffset - activeDays + 1 + i + 7) % 7;
          const isActive = i >= (7 - activeDays) && i <= mondayOffset;
          const isToday = i === mondayOffset;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-5 h-5 rounded-full transition-all ${
                  isActive
                    ? "bg-orange-500 shadow-sm shadow-orange-300"
                    : "bg-muted"
                } ${isToday ? "ring-2 ring-orange-400 ring-offset-1" : ""}`}
              />
              <span className="text-[9px] text-muted-foreground font-medium">{d}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
