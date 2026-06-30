import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { 
  Flame, Trophy, Zap, Clock, Star,
  CheckCircle2, XCircle, ArrowRight, RotateCcw,
  Calendar, TrendingUp, Shield, Award
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  funFact?: string;
}

interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  canSaveStreak: boolean;
  totalDaysCompleted: number;
}

export default function DailyMix() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"loading" | "intro" | "playing" | "complete">("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [result, setResult] = useState<{ newStreak: number; bonusXP: number; totalXP: number; newBadges: string[] } | null>(null);

  const { data: streakStatus, isLoading: isLoadingStatus } = useQuery<StreakStatus>({
    queryKey: ["/api/daily-mix/status"],
  });

  useEffect(() => {
    if (!isLoadingStatus && streakStatus) {
      if (streakStatus.completedToday) {
        setPhase("complete");
      } else {
        setPhase("intro");
      }
    }
  }, [streakStatus, isLoadingStatus]);

  useEffect(() => {
    if (phase !== "playing" || !questions[currentIndex] || selectedOption) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAnswer("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, currentIndex, selectedOption]);

  const startDailyMix = async () => {
    try {
      const res = await fetch(`/api/ai/daily-content?department=${encodeURIComponent(user?.department || "Engineering")}`);
      if (!res.ok) throw new Error("Failed to fetch daily content");
      const data = await res.json();
      
      const shuffled = data.quiz.sort(() => 0.5 - Math.random()).slice(0, 7);
      setQuestions(shuffled);
      setCurrentIndex(0);
      setScore(0);
      setTimeLeft(120);
      setPhase("playing");
    } catch (err) {
      toast({ title: "Error", description: "Failed to load daily mix", variant: "destructive" });
    }
  };

  const handleAnswer = async (option: string) => {
    if (selectedOption || !questions[currentIndex]) return;
    
    setSelectedOption(option);
    const correct = option === questions[currentIndex].correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      setScore(s => s + 1);
      confetti({ 
        particleCount: 30, 
        spread: 50, 
        origin: { y: 0.7 },
        colors: ['#22c55e', '#10b981']
      });
    }

    setTimeout(async () => {
      if (currentIndex + 1 >= questions.length) {
        await completeDailyMix();
      } else {
        setCurrentIndex(i => i + 1);
        setSelectedOption(null);
        setIsCorrect(null);
        setTimeLeft(120);
      }
    }, 2000);
  };

  const completeDailyMix = async () => {
    try {
      const finalScore = score + (isCorrect ? 1 : 0);
      const res = await apiRequest("POST", "/api/daily-mix/complete", {
        score: finalScore,
        totalQuestions: questions.length,
      });
      const data = await res.json();
      
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/daily-mix/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      if (data.newBadges?.length > 0) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
      }
    } catch (err) {
      console.error("Failed to complete daily mix");
    }
    
    setPhase("complete");
  };

  const saveStreak = async () => {
    try {
      const res = await apiRequest("POST", "/api/daily-mix/save-streak", {});
      const data = await res.json();
      
      if (data.success) {
        toast({ title: "Streak Saved!", description: `You spent ${data.xpSpent} XP to save your streak` });
        queryClient.invalidateQueries({ queryKey: ["/api/daily-mix/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save streak", variant: "destructive" });
    }
  };

  if (phase === "loading" || isLoadingStatus) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="flex min-h-screen bg-background pb-20 md:pb-0">
        <Navigation />
        <main className="flex-1 md:ml-64 p-4 md:p-8">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-block p-4 bg-gradient-to-br from-orange-400 to-red-500 rounded-3xl mb-4"
              >
                <Calendar className="w-12 h-12 text-white" />
              </motion.div>
              <h1 className="text-4xl font-display font-bold mb-2" data-testid="text-page-title">Daily Mix</h1>
              <p className="text-muted-foreground text-lg">Your daily dose of telecom knowledge</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="text-center p-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Flame className="w-8 h-8 text-orange-500" />
                  <span className="text-4xl font-black text-orange-500">{streakStatus?.currentStreak || 0}</span>
                </div>
                <div className="text-sm text-muted-foreground">Current Streak</div>
              </Card>
              <Card className="text-center p-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                  <span className="text-4xl font-black text-yellow-500">{streakStatus?.longestStreak || 0}</span>
                </div>
                <div className="text-sm text-muted-foreground">Longest Streak</div>
              </Card>
            </div>

            {streakStatus?.canSaveStreak && (
              <Card className="p-4 border-orange-500/50 bg-orange-500/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-xl">
                    <Shield className="w-8 h-8 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-orange-600 dark:text-orange-400">Streak at Risk!</div>
                    <div className="text-sm text-muted-foreground">You missed yesterday. Save your streak?</div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={saveStreak}
                    className="border-orange-500 text-orange-600 hover:bg-orange-500/10"
                    data-testid="button-save-streak"
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    50 XP
                  </Button>
                </div>
              </Card>
            )}

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-lg">Streak Rewards</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={(streakStatus?.currentStreak || 0) >= 3 ? "default" : "secondary"}>
                      Day 3
                    </Badge>
                    <span className="text-sm">+50 Bonus XP + Streak Starter Badge</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={(streakStatus?.currentStreak || 0) >= 7 ? "default" : "secondary"}>
                      Day 7
                    </Badge>
                    <span className="text-sm">+100 Bonus XP + Weekly Warrior Badge</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={(streakStatus?.currentStreak || 0) >= 30 ? "default" : "secondary"}>
                      Day 30
                    </Badge>
                    <span className="text-sm">+500 Bonus XP + Monthly Master Badge</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              size="lg" 
              className="w-full py-6 text-lg rounded-xl bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600"
              onClick={startDailyMix}
              data-testid="button-start-daily"
            >
              <Flame className="w-5 h-5 mr-2" />
              Start Today's Mix
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="flex min-h-screen bg-background pb-20 md:pb-0">
        <Navigation />
        <main className="flex-1 md:ml-64 p-4 md:p-8">
          <div className="max-w-2xl mx-auto space-y-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className="inline-block p-6 rounded-3xl bg-gradient-to-br from-orange-400 to-red-500 mb-4">
                <CheckCircle2 className="w-16 h-16 text-white" />
              </div>
              <h1 className="text-4xl font-display font-bold mb-2" data-testid="text-complete-title">
                {streakStatus?.completedToday && !result ? "Already Completed!" : "Daily Mix Complete!"}
              </h1>
              <p className="text-muted-foreground text-lg">
                {streakStatus?.completedToday && !result 
                  ? "Come back tomorrow for more!" 
                  : "Great job keeping your streak alive!"}
              </p>
            </motion.div>

            {result && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="text-center p-4">
                    <div className="text-3xl font-bold text-primary">{score}/{questions.length}</div>
                    <div className="text-sm text-muted-foreground">Score</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-3xl font-bold text-orange-500 flex items-center justify-center gap-1">
                      <Flame className="w-6 h-6" />
                      {result.newStreak}
                    </div>
                    <div className="text-sm text-muted-foreground">Weekly Momentum</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-3xl font-bold text-yellow-500 flex items-center justify-center gap-1">
                      <Star className="w-5 h-5 fill-current" />
                      {result.totalXP}
                    </div>
                    <div className="text-sm text-muted-foreground">XP Earned</div>
                  </Card>
                </div>

                {result.bonusXP > 0 && (
                  <Card className="p-4 border-yellow-500/50 bg-yellow-500/5">
                    <div className="flex items-center gap-3">
                      <Award className="w-8 h-8 text-yellow-500" />
                      <div>
                        <div className="font-bold text-yellow-600 dark:text-yellow-400">
                          Streak Bonus! +{result.bonusXP} XP
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Keep it up to earn more rewards!
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {result.newBadges?.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      New Badges Earned!
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {result.newBadges.map((badge, i) => (
                        <Badge key={i} className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Link href="/quiz">
                <Button variant="outline" size="lg" className="w-full py-6 text-lg rounded-xl h-auto" data-testid="button-back-battle">
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Battle Arena
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button size="lg" className="w-full py-6 text-lg rounded-xl h-auto" data-testid="button-leaderboard">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0 overflow-hidden">
      <Navigation />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col items-center justify-center min-h-screen relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-3xl w-full space-y-8 relative z-10">
          <div className="flex items-center justify-between bg-card/80 backdrop-blur-md p-4 rounded-2xl border shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-xl">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Streak</div>
                <div className="text-xl font-bold text-orange-500">{streakStatus?.currentStreak || 0} days</div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className={cn(
                "text-3xl font-black tabular-nums",
                timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-foreground"
              )}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
              <Progress value={(timeLeft / 120) * 100} className="w-20 h-2" />
            </div>

            <div className="text-right">
              <div className="text-xs text-muted-foreground">Question</div>
              <div className="text-xl font-bold">
                {currentIndex + 1}<span className="text-sm opacity-50">/{questions.length}</span>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div
                key={currentIndex}
                initial={{ x: 200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -200, opacity: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="space-y-6"
              >
                <Card className="p-8">
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight text-center" data-testid="text-question">
                    {currentQuestion.question}
                  </h2>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedOption === option;
                    const isCorrectAnswer = option === currentQuestion.correctAnswer;
                    
                    let statusClass = "";
                    if (selectedOption) {
                      if (isCorrectAnswer) statusClass = "ring-4 ring-green-500 bg-green-500/10";
                      else if (isSelected) statusClass = "ring-4 ring-red-500 bg-red-500/10 opacity-75";
                      else statusClass = "opacity-40";
                    }

                    return (
                      <motion.button
                        key={idx}
                        whileHover={!selectedOption ? { scale: 1.02 } : {}}
                        whileTap={!selectedOption ? { scale: 0.98 } : {}}
                        onClick={() => handleAnswer(option)}
                        disabled={!!selectedOption}
                        data-testid={`button-option-${idx}`}
                        className={cn(
                          "p-5 rounded-xl border-2 text-left font-medium transition-all",
                          "hover:border-primary hover:bg-primary/5",
                          statusClass
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                            {['A', 'B', 'C', 'D'][idx]}
                          </div>
                          <span className="flex-1">{option.split(" ").length > 7 ? option.split(" ").slice(0, 7).join(" ") + "..." : option}</span>
                          {selectedOption && isCorrectAnswer && (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          )}
                          {selectedOption && isSelected && !isCorrect && (
                            <XCircle className="w-6 h-6 text-red-500" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {selectedOption && currentQuestion.funFact && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-muted/50 border"
                  >
                    <div className="text-sm">
                      <span className="font-bold">Fun Fact: </span>
                      {currentQuestion.funFact}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center">
            <div className="flex gap-2">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    i === currentIndex ? "bg-primary scale-125" :
                    i < currentIndex ? "bg-green-500" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
