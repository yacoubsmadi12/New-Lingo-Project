import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { 
  Brain, Trophy, Zap, Clock, Target, 
  GraduationCap, Flame, Ghost, CheckCircle2, 
  XCircle, ArrowRight, RotateCcw, BookOpen,
  Star, Award, TrendingUp
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "medium" | "hard";
type Personality = "calm_professor" | "aggressive_challenger" | "trickster";

interface Question {
  id: number;
  question: string;
  term: string;
  options: string[];
  correctAnswer: string;
  definition: string;
  example: string;
  aiComment?: string;
}

interface WrongAnswer {
  question: string;
  term: string;
  userAnswer: string;
  correctAnswer: string;
  definition: string;
}

const difficulties: { id: Difficulty; label: string; desc: string; icon: typeof Target; color: string; xpMultiplier: number }[] = [
  { id: "easy", label: "Easy", desc: "Slower AI, more time", icon: Target, color: "from-green-400 to-emerald-500", xpMultiplier: 1 },
  { id: "medium", label: "Medium", desc: "Balanced challenge", icon: Zap, color: "from-yellow-400 to-orange-500", xpMultiplier: 1.5 },
  { id: "hard", label: "Hard", desc: "Fast AI, tricky questions", icon: Flame, color: "from-red-500 to-rose-600", xpMultiplier: 2 },
];

const personalities: { id: Personality; label: string; desc: string; icon: typeof GraduationCap; avatar: string }[] = [
  { id: "calm_professor", label: "Calm Professor", desc: "Patient and educational", icon: GraduationCap, avatar: "🎓" },
  { id: "aggressive_challenger", label: "Aggressive Challenger", desc: "Competitive and fast", icon: Flame, avatar: "🔥" },
  { id: "trickster", label: "Trickster", desc: "Loves tricky questions", icon: Ghost, avatar: "👻" },
];

const getAiComment = (personality: Personality, isCorrect: boolean, userScore: number, aiScore: number): string => {
  const comments = {
    calm_professor: {
      correct: [
        "Excellent work! You're making great progress.",
        "Well done! That's the correct answer.",
        "Impressive knowledge! Keep it up.",
        "Perfect! You really understand this concept.",
      ],
      wrong: [
        "Don't worry, learning is a journey. Let's review this together.",
        "Almost there! Take your time to understand.",
        "A good attempt. Remember this for next time.",
        "No worries, mistakes help us learn better.",
      ],
    },
    aggressive_challenger: {
      correct: [
        "Lucky shot! I'm just getting warmed up!",
        "Hmph, you got that one. Don't get cocky!",
        "Fine, you win this round. But watch out!",
        "Not bad... for a beginner!",
      ],
      wrong: [
        "Ha! Too slow! Better luck next time!",
        "That's what I thought! You can't beat me!",
        "Easy points for me! Keep trying!",
        "I knew you'd miss that one!",
      ],
    },
    trickster: {
      correct: [
        "Ooh, you didn't fall for my trap! Clever!",
        "Darn, I thought that would trick you!",
        "Not bad, but I have more surprises!",
        "Hmm, you're smarter than you look!",
      ],
      wrong: [
        "Hehe, gotcha! That was a tricky one!",
        "Fooled ya! Better read more carefully!",
        "My trap worked perfectly! Mwahaha!",
        "Oops! Did you fall for the obvious choice?",
      ],
    },
  };

  const pool = comments[personality][isCorrect ? "correct" : "wrong"];
  return pool[Math.floor(Math.random() * pool.length)];
};

export default function TermDuel() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"setup" | "playing" | "analysis">("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [personality, setPersonality] = useState<Personality>("calm_professor");
  const [duelId, setDuelId] = useState<number | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [aiComment, setAiComment] = useState<string>("");
  
  const [userScore, setUserScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [badgesEarned, setBadgesEarned] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const timeLimit = 120;
  const aiSpeed = difficulty === "easy" ? 0.3 : difficulty === "medium" ? 0.5 : 0.7;
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (phase !== "playing" || !currentQuestion || selectedOption) return;
    
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
  }, [phase, currentQuestion, selectedOption]);

  const startDuel = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/duel/start", {
        difficulty,
        aiPersonality: personality,
      });
      const data = await res.json();
      
      setDuelId(data.duelId);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setUserScore(0);
      setAiScore(0);
      setWrongAnswers([]);
      setTimeLeft(timeLimit);
      setPhase("playing");
    } catch (err) {
      toast({ title: "Error", description: "Failed to start duel", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async (option: string) => {
    if (selectedOption || !currentQuestion) return;
    
    setSelectedOption(option);
    const correct = option === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    
    const aiAnsweredCorrectly = Math.random() < aiSpeed;
    const comment = getAiComment(personality, correct, userScore, aiScore);
    setAiComment(comment);

    if (correct) {
      const timeBonus = Math.floor(timeLeft * 2);
      const baseXP = difficulty === "easy" ? 10 : difficulty === "medium" ? 15 : 20;
      setUserScore(s => s + 1);
      setXpEarned(xp => xp + baseXP + timeBonus);
      
      confetti({ 
        particleCount: 50, 
        spread: 60, 
        origin: { y: 0.7 },
        colors: ['#22c55e', '#10b981', '#34d399']
      });
    } else {
      setWrongAnswers(prev => [...prev, {
        question: currentQuestion.question,
        term: currentQuestion.term,
        userAnswer: option || "(No answer)",
        correctAnswer: currentQuestion.correctAnswer,
        definition: currentQuestion.definition,
      }]);
    }

    if (aiAnsweredCorrectly) {
      setAiScore(s => s + 1);
    }

    setTimeout(async () => {
      if (currentIndex + 1 >= questions.length) {
        await finishDuel();
      } else {
        setCurrentIndex(i => i + 1);
        setSelectedOption(null);
        setIsCorrect(null);
        setAiComment("");
        setTimeLeft(timeLimit);
      }
    }, 2500);
  };

  const finishDuel = async () => {
    const finalUserScore = userScore + (isCorrect ? 1 : 0);
    const won = finalUserScore > aiScore;
    
    try {
      const res = await apiRequest("POST", "/api/duel/complete", {
        duelId,
        userScore: finalUserScore,
        aiScore,
        wrongAnswers,
        xpEarned,
        won,
      });
      const data = await res.json();
      
      if (data.newBadges?.length > 0) {
        setBadgesEarned(data.newBadges);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch (err) {
      console.error("Failed to save duel results");
    }

    if (won) {
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }
    
    setPhase("analysis");
  };

  if (phase === "setup") {
    return (
      <div className="flex min-h-screen bg-background pb-20 md:pb-0">
        <Navigation />
        <main className="flex-1 md:ml-64 p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-block p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl mb-4"
              >
                <Brain className="w-12 h-12 text-white" />
              </motion.div>
              <h1 className="text-4xl font-display font-bold mb-2" data-testid="text-page-title">Term Duel</h1>
              <p className="text-muted-foreground text-lg">Battle against an AI opponent to test your knowledge</p>
            </div>

            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Choose Difficulty
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {difficulties.map((d) => (
                      <motion.button
                        key={d.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDifficulty(d.id)}
                        data-testid={`button-difficulty-${d.id}`}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all text-left",
                          difficulty === d.id 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn("inline-flex p-2 rounded-xl bg-gradient-to-br text-white mb-2", d.color)}>
                          <d.icon className="w-5 h-5" />
                        </div>
                        <div className="font-bold">{d.label}</div>
                        <div className="text-sm text-muted-foreground">{d.desc}</div>
                        <Badge variant="secondary" className="mt-2">
                          {d.xpMultiplier}x XP
                        </Badge>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Choose AI Opponent
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {personalities.map((p) => (
                      <motion.button
                        key={p.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPersonality(p.id)}
                        data-testid={`button-personality-${p.id}`}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all text-left",
                          personality === p.id 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="text-4xl mb-2">{p.avatar}</div>
                        <div className="font-bold">{p.label}</div>
                        <div className="text-sm text-muted-foreground">{p.desc}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <Button 
                  size="lg" 
                  className="w-full py-6 text-lg rounded-xl"
                  onClick={startDuel}
                  disabled={isLoading}
                  data-testid="button-start-duel"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Preparing Duel...
                    </div>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Start Duel
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "analysis") {
    const won = userScore > aiScore;
    const personalityData = personalities.find(p => p.id === personality)!;
    
    return (
      <div className="flex min-h-screen bg-background pb-20 md:pb-0">
        <Navigation />
        <main className="flex-1 md:ml-64 p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className={cn(
                "inline-block p-6 rounded-3xl mb-4",
                won ? "bg-gradient-to-br from-yellow-400 to-amber-500" : "bg-gradient-to-br from-gray-400 to-gray-500"
              )}>
                {won ? <Trophy className="w-16 h-16 text-white" /> : <Target className="w-16 h-16 text-white" />}
              </div>
              <h1 className="text-4xl font-display font-bold mb-2" data-testid="text-result-title">
                {won ? "Victory!" : "Good Effort!"}
              </h1>
              <p className="text-muted-foreground text-lg">
                {won ? "You defeated the AI!" : "Keep practicing to improve!"}
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center p-4">
                <div className="text-3xl font-bold text-primary">{userScore}</div>
                <div className="text-sm text-muted-foreground">Your Score</div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-3xl font-bold text-destructive">{aiScore}</div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <span>{personalityData.avatar}</span> AI Score
                </div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-3xl font-bold text-yellow-500 flex items-center justify-center gap-1">
                  <Star className="w-6 h-6 fill-current" />
                  {xpEarned}
                </div>
                <div className="text-sm text-muted-foreground">XP Earned</div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-3xl font-bold text-green-500">
                  {Math.round((userScore / questions.length) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
              </Card>
            </div>

            {badgesEarned.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  New Badges Earned!
                </h3>
                <div className="flex flex-wrap gap-2">
                  {badgesEarned.map((badge, i) => (
                    <Badge key={i} className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                      <Trophy className="w-3 h-3 mr-1" />
                      {badge}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {wrongAnswers.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Review Wrong Answers ({wrongAnswers.length})
                </h3>
                <div className="space-y-4">
                  {wrongAnswers.map((wa, i) => (
                    <div key={i} className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <div className="font-medium mb-2">{wa.term}</div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">Your answer: {wa.userAnswer}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-green-600 dark:text-green-400">Correct: {wa.correctAnswer}</span>
                        </div>
                        <div className="mt-2 p-2 bg-muted rounded-lg text-sm">
                          <span className="font-medium">Definition: </span>
                          {wa.definition}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Button 
                size="lg" 
                onClick={() => {
                  setPhase("setup");
                  setQuestions([]);
                  setCurrentIndex(0);
                  setSelectedOption(null);
                  setIsCorrect(null);
                  setWrongAnswers([]);
                  setXpEarned(0);
                  setBadgesEarned([]);
                }}
                className="py-6 text-lg rounded-xl"
                data-testid="button-play-again"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Play Again
              </Button>
              <Link href="/quiz">
                <Button variant="outline" size="lg" className="w-full py-6 text-lg rounded-xl h-auto" data-testid="button-exit">
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Exit
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0 overflow-hidden">
      <Navigation />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col items-center justify-center min-h-screen relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
          />
          <motion.div 
            animate={{ rotate: [360, 0], scale: [1, 1.5, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-20 -right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"
          />
        </div>

        <div className="max-w-4xl w-full space-y-8 relative z-10">
          <div className="flex items-center justify-between bg-card/80 backdrop-blur-md p-4 rounded-2xl border shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">You</div>
                  <div className="text-2xl font-black text-primary" data-testid="text-user-score">{userScore}</div>
                </div>
              </div>
              
              <div className="text-2xl font-bold text-muted-foreground">VS</div>
              
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl">
                  {personalities.find(p => p.id === personality)?.avatar}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">AI</div>
                  <div className="text-2xl font-black text-destructive" data-testid="text-ai-score">{aiScore}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "text-4xl font-black tabular-nums transition-colors",
                timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-foreground"
              )}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
              <Progress value={(timeLeft / timeLimit) * 100} className="w-24 h-2" />
            </div>

            <div className="text-right">
              <div className="text-xs text-muted-foreground">Question</div>
              <div className="text-xl font-bold">
                {currentIndex + 1}<span className="text-sm opacity-50">/{questions.length}</span>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!currentQuestion ? (
              <div className="h-96 flex items-center justify-center">
                <div className="w-24 h-24 border-8 border-primary/10 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <motion.div
                key={currentIndex}
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="space-y-8"
              >
                <Card className="p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
                  <h2 className="text-3xl md:text-4xl font-black leading-tight text-center" data-testid="text-question">
                    {currentQuestion.question}
                  </h2>
                  {currentQuestion.term && (
                    <div className="mt-6 flex justify-center">
                      <Badge variant="secondary" className="text-sm">
                        Term: {currentQuestion.term}
                      </Badge>
                    </div>
                  )}
                </Card>

                {aiComment && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border"
                  >
                    <div className="text-3xl">{personalities.find(p => p.id === personality)?.avatar}</div>
                    <div>
                      <div className="text-sm font-bold">{personalities.find(p => p.id === personality)?.label}</div>
                      <div className="text-sm text-muted-foreground italic">{aiComment}</div>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedOption === option;
                    const isCorrectAnswer = option === currentQuestion.correctAnswer;
                    const colors = [
                      "from-red-500 to-red-600 shadow-[0_6px_0_rgb(185,28,28)]",
                      "from-blue-500 to-blue-600 shadow-[0_6px_0_rgb(29,78,216)]",
                      "from-green-500 to-green-600 shadow-[0_6px_0_rgb(21,128,61)]",
                      "from-yellow-400 to-yellow-500 shadow-[0_6px_0_rgb(161,98,7)]"
                    ];
                    
                    let statusClass = "";
                    if (selectedOption) {
                      if (isCorrectAnswer) statusClass = "ring-4 ring-green-400 scale-[1.02]";
                      else if (isSelected) statusClass = "ring-4 ring-red-400 scale-95 opacity-75";
                      else statusClass = "opacity-40 scale-95";
                    }

                    return (
                      <motion.button
                        key={idx}
                        whileHover={!selectedOption ? { translateY: -4, scale: 1.01 } : {}}
                        whileTap={!selectedOption ? { translateY: 2 } : {}}
                        onClick={() => handleAnswer(option)}
                        disabled={!!selectedOption}
                        data-testid={`button-option-${idx}`}
                        className={cn(
                          "relative p-6 rounded-2xl text-left font-bold text-lg text-white transition-all duration-300",
                          "bg-gradient-to-b flex items-center gap-4 min-h-[100px]",
                          colors[idx],
                          statusClass,
                          !selectedOption && "active:shadow-none active:translate-y-1.5"
                        )}
                      >
                        <div className="absolute top-3 right-3 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-black text-xl opacity-30">
                          {['A', 'B', 'C', 'D'][idx]}
                        </div>
                        
                        <div className="relative z-10 flex-1 pr-8">
                          {option.split(" ").length > 7 ? option.split(" ").slice(0, 7).join(" ") + "..." : option}
                        </div>

                        <AnimatePresence>
                          {selectedOption && isCorrectAnswer && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 bg-green-500/30 backdrop-blur-[1px] flex items-center justify-center rounded-2xl"
                            >
                              <CheckCircle2 className="w-16 h-16 text-white drop-shadow-lg" />
                            </motion.div>
                          )}
                          {selectedOption && isSelected && !isCorrect && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 bg-red-500/30 backdrop-blur-[1px] flex items-center justify-center rounded-2xl"
                            >
                              <XCircle className="w-16 h-16 text-white drop-shadow-lg" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
