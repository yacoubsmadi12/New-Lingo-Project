import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useAiDuel, useSubmitQuiz } from "@/hooks/use-quizzes";
import { Navigation } from "@/components/Navigation";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { CheckCircle2, XCircle, ArrowRight, Trophy } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export default function QuizRunner() {
  const { mode } = useParams(); // 'ai-duel', 'daily', 'word-rush', 'listen-tap', 'survival', 'boss-fight'
  const { mutateAsync: fetchQuestion, isPending: isLoadingQuestion } = useAiDuel();
  const { mutate: submitResult } = useSubmitQuiz();
  const { toast } = useToast();
  const [search] = useState(window.location.search);
  const department = new URLSearchParams(search).get("department");

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionCache, setQuestionCache] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(mode === 'word-rush' ? 60 : 180);
  const [isPaused, setIsPaused] = useState(false);
  const isInfinite = ['word-rush', 'survival'].includes(mode || "");
  const maxQuestions = mode === 'boss-fight' ? 10 : (isInfinite ? 50 : 5);

  // Timer logic for Word Rush
  useEffect(() => {
    if (gameOver || isPaused || mode !== 'word-rush') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishGame(score);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, isPaused, mode, score]);

  // General Timer logic for other modes
  useEffect(() => {
    if (gameOver || isPaused || mode === 'word-rush') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up for a single question
          handleAnswer(""); // Treat as wrong answer
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, isPaused, mode, currentQuestion]);

  // Load initial questions
  useEffect(() => {
    const initQuiz = async () => {
      try {
        if (mode === 'daily') {
          const res = await fetch(`/api/ai/daily-content?department=${encodeURIComponent(department || "")}`);
          if (!res.ok) throw new Error("Failed to fetch daily content");
          const data = await res.json();
          setQuestionCache(data.quiz);
          setCurrentQuestion(data.quiz[0]);
        } else if (['word-rush', 'listen-tap', 'survival', 'boss-fight', 'match-meaning'].includes(mode || "")) {
          const endpoint = mode === 'listen-tap' ? 'audio-tap' : mode;
          const res = await fetch(`/api/games/${endpoint}`);
          if (!res.ok) throw new Error("Failed to fetch game content");
          const data = await res.json();
          
          let formattedQuestions = data;
          if (['word-rush', 'survival', 'boss-fight', 'listen-tap'].includes(mode || "")) {
            formattedQuestions = data.map((term: any) => {
              const distractors = data
                .filter((t: any) => t.id !== term.id)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map((t: any) => t.definition);
              
              const options = [term.definition, ...distractors].sort(() => 0.5 - Math.random());
              
              return {
                id: term.id,
                question: mode === 'listen-tap' ? "What did you hear?" : `What is the meaning of "${term.term}"?`,
                term: term.term,
                options,
                correctAnswer: term.definition,
                funFact: term.example
              };
            });
          } else if (mode === 'match-meaning') {
            formattedQuestions = data.map((q: any) => ({
              id: q.id,
              question: `Match the meaning for: ${q.word}`,
              options: q.options,
              correctAnswer: q.correctMeaning,
              funFact: "Great job! Keep going."
            }));
          }
          
          setQuestionCache(formattedQuestions);
          setCurrentQuestion(formattedQuestions[0]);
        } else {
          // Prefetch first batch
          const res = await fetch("/api/ai/quiz-game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              topic: department || "telecom",
              difficulty: mode === 'boss-fight' ? 'hard' : 'medium'
            })
          });
          if (!res.ok) throw new Error("Failed to prefetch questions");
          const data = await res.json();
          setQuestionCache(data);
          setCurrentQuestion(data[0]);
        }
      } catch (err) {
        toast({ title: "Error", description: "Failed to load questions", variant: "destructive" });
      }
    };
    initQuiz();
  }, [mode, department]);

  const loadNewQuestion = async () => {
    const nextIdx = questionCount + 1;
    const isInfinite = ['word-rush', 'survival'].includes(mode || "");
    const maxQuestions = mode === 'boss-fight' ? 10 : (isInfinite ? 50 : 5);
    
    if (nextIdx >= maxQuestions || nextIdx >= questionCache.length) {
      finishGame(score);
      return;
    }

    setCurrentQuestion(questionCache[nextIdx]);
    setQuestionCount(nextIdx);
    setSelectedOption(null);
    setIsCorrect(null);
    if (mode !== 'word-rush') {
      setTimeLeft(180);
    }
  };

  const handleAnswer = (option: string) => {
    if (selectedOption || !currentQuestion) return;
    
    setSelectedOption(option);
    const correct = option === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      const timeBonus = mode === 'word-rush' ? 0 : Math.floor(timeLeft * 2);
      setScore(s => s + (mode === 'word-rush' ? 1 : 10 + timeBonus));
      confetti({ 
        particleCount: 100, 
        spread: 70, 
        origin: { y: 0.6 },
        colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
      });
    } else if (mode === 'survival') {
      setTimeout(() => finishGame(score), 1000);
      return;
    }

    setTimeout(() => {
      loadNewQuestion();
    }, mode === 'word-rush' ? 300 : 2500);
  };

  const finishGame = (finalScore: number) => {
    setGameOver(true);
    submitResult({
      type: mode || 'unknown',
      score: finalScore,
      userId: 0, // Backend handles user ID from session
    });
    
    // Award 5 points for additional quiz (non-daily) or 10 points for regular quiz completion
    // The points are awarded in the backend route, but we can add an extra trigger here if needed
    // In our case, the backend already adds 10 points on /api/quizzes creation if score > 0
    // We add 5 extra points specifically for "additional" quizzes if it's not the daily one
    if (mode !== 'daily' && finalScore > 0) {
      apiRequest("POST", "/api/user/points", { points: 5, reason: "Additional quiz completed" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/user"] }));
    }

    if (finalScore >= 40) {
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }
  };

  if (gameOver) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card w-full max-w-md p-8 rounded-3xl shadow-2xl text-center border-2 border-primary/10"
        >
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-12 h-12 text-yellow-600" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-2">Game Over!</h2>
          <p className="text-muted-foreground mb-8">Final Score</p>
          <div className="text-7xl font-bold text-primary mb-8 drop-shadow-lg">{score}</div>
          
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={() => window.location.reload()} className="py-6 text-lg rounded-xl h-auto">
              Try Again
            </Button>
            <Link href="/quiz">
              <Button variant="outline" className="w-full py-6 text-lg rounded-xl h-auto">
                Exit
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0 overflow-hidden">
      <Navigation />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col items-center justify-center min-h-screen relative">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.2, 1],
              x: [0, 100, 0],
              y: [0, 50, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
          />
          <motion.div 
            animate={{ 
              rotate: [360, 0],
              scale: [1, 1.5, 1],
              x: [0, -100, 0],
              y: [0, -50, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-20 -right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"
          />
        </div>

        <div className="max-w-4xl w-full space-y-8 relative z-10">
          
          {/* Game HUD */}
          <div className="flex items-center justify-between bg-card/80 backdrop-blur-md p-4 rounded-2xl border-2 border-primary/10 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase">Score</span>
                <div className="text-2xl font-black text-primary tabular-nums">{score}</div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
               <div className={`text-4xl font-black tabular-nums transition-colors ${timeLeft < 30 ? 'text-red-500 animate-bounce' : 'text-foreground'}`}>
                {mode === 'word-rush' ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
              </div>
              <Progress value={(timeLeft / (mode === 'word-rush' ? 60 : 180)) * 100} className="w-32 h-2" />
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase">Progress</span>
                <div className="text-xl font-bold">{questionCount + 1}<span className="text-sm opacity-50">/{maxQuestions}</span></div>
              </div>
              {mode === 'survival' && (
                 <div className="flex gap-1">
                   {[1, 2, 3].map(i => (
                     <motion.div 
                       key={i}
                       animate={{ scale: [1, 1.2, 1] }}
                       transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity }}
                       className="w-6 h-6 text-red-500 fill-current"
                     >
                       <Trophy className="w-full h-full fill-red-500" />
                     </motion.div>
                   ))}
                 </div>
              )}
            </div>
          </div>

          {/* Game Area */}
          <AnimatePresence mode="wait">
            {isLoadingQuestion || !currentQuestion ? (
              <div className="h-96 flex items-center justify-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-primary/10 border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center font-black text-primary">GO!</div>
                </div>
              </div>
            ) : (
              <motion.div
                key={questionCount}
                initial={{ x: 300, opacity: 0, rotateY: 90 }}
                animate={{ x: 0, opacity: 1, rotateY: 0 }}
                exit={{ x: -300, opacity: 0, rotateY: -90 }}
                transition={{ type: "spring", damping: 15 }}
                className="space-y-12"
              >
                {/* Question Display */}
                <div className="bg-card p-12 rounded-[2rem] shadow-2xl border-4 border-primary/5 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  <motion.h2 
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="text-4xl md:text-5xl font-black leading-tight text-center font-display drop-shadow-sm"
                  >
                    {currentQuestion.question}
                  </motion.h2>
                  
                  {currentQuestion.term && (
                    <div className="mt-8 flex justify-center">
                      <div className="px-6 py-2 bg-primary/10 rounded-full text-primary font-bold text-sm uppercase tracking-widest border border-primary/20">
                        Vocabulary: {currentQuestion.term}
                      </div>
                    </div>
                  )}
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                  {currentQuestion.options.map((option: string, idx: number) => {
                    const isSelected = selectedOption === option;
                    const isCorrectAnswer = option === currentQuestion.correctAnswer;
                    const nintendoColors = [
                      "from-red-500 to-red-600 shadow-[0_8px_0_rgb(185,28,28)] active:shadow-none active:translate-y-2",
                      "from-blue-500 to-blue-600 shadow-[0_8px_0_rgb(29,78,216)] active:shadow-none active:translate-y-2",
                      "from-green-500 to-green-600 shadow-[0_8px_0_rgb(21,128,61)] active:shadow-none active:translate-y-2",
                      "from-yellow-400 to-yellow-500 shadow-[0_8px_0_rgb(161,98,7)] active:shadow-none active:translate-y-2"
                    ];
                    
                    let statusClass = "";
                    if (selectedOption) {
                      if (isCorrectAnswer) statusClass = "ring-8 ring-green-400 scale-105 z-20 !opacity-100 brightness-110";
                      else if (isSelected) statusClass = "ring-8 ring-red-400 scale-95 opacity-80 brightness-75";
                      else statusClass = "opacity-20 scale-90 grayscale blur-[1px]";
                    }

                    return (
                      <motion.button
                        key={idx}
                        whileHover={!selectedOption ? { translateY: -8, scale: 1.02 } : {}}
                        whileTap={!selectedOption ? { translateY: 4, scale: 0.98 } : {}}
                        onClick={() => handleAnswer(option)}
                        disabled={!!selectedOption}
                        className={cn(
                          "relative group p-8 rounded-3xl text-left font-black text-2xl text-white transition-all duration-300",
                          "bg-gradient-to-b flex items-center gap-6 overflow-hidden min-h-[140px]",
                          nintendoColors[idx],
                          statusClass
                        )}
                      >
                        {/* Nintendo Button Decor */}
                        <div className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-black text-4xl opacity-20">
                          {['A', 'B', 'X', 'Y'][idx]}
                        </div>
                        
                        <div className="relative z-10 flex-1 drop-shadow-md">
                          {option.split(" ").length > 7 ? option.split(" ").slice(0, 7).join(" ") + "..." : option}
                        </div>

                        <AnimatePresence>
                          {selectedOption && isCorrectAnswer && (
                            <motion.div 
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              className="absolute inset-0 bg-green-500/20 backdrop-blur-[2px] flex items-center justify-center"
                            >
                              <CheckCircle2 className="w-20 h-20 text-white drop-shadow-xl" />
                            </motion.div>
                          )}
                          {selectedOption && isSelected && !isCorrect && (
                            <motion.div 
                              initial={{ scale: 0, rotate: 45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              className="absolute inset-0 bg-red-500/20 backdrop-blur-[2px] flex items-center justify-center"
                            >
                              <XCircle className="w-20 h-20 text-white drop-shadow-xl" />
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
