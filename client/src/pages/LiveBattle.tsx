import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { 
  Swords, Trophy, Zap, Users, Clock,
  CheckCircle2, XCircle, ArrowRight, Plus,
  UserPlus, Shuffle, Crown, Medal, TrendingUp
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface Question {
  id: number;
  term: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

interface Battle {
  id: number;
  challengerId: number;
  opponentId: number | null;
  challengerScore: number;
  opponentScore: number | null;
  status: string;
  winnerId: number | null;
  challengerName?: string;
  createdAt: string;
}

interface LeaderboardEntry {
  id: number;
  name: string;
  points: number;
  department: string;
}

export default function LiveBattle() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"menu" | "waiting" | "playing" | "complete">("menu");
  const [currentBattle, setCurrentBattle] = useState<Battle | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [answers, setAnswers] = useState<string[]>([]);

  const { data: pendingBattles, refetch: refetchBattles } = useQuery<Battle[]>({
    queryKey: ["/api/battle/pending"],
  });

  const { data: myBattles, refetch: refetchMyBattles } = useQuery<Battle[]>({
    queryKey: ["/api/battle/my-battles"],
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/weekly"],
  });

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

  const createBattle = async (findRandom: boolean = false) => {
    try {
      const res = await apiRequest("POST", "/api/battle/create", {
        opponentId: null,
      });
      const data = await res.json();
      
      setCurrentBattle({ 
        id: data.battleId, 
        challengerId: user?.id || 0,
        opponentId: null,
        challengerScore: 0,
        opponentScore: null,
        status: "pending",
        winnerId: null,
        createdAt: new Date().toISOString()
      });
      setQuestions(data.questions);
      setCurrentIndex(0);
      setScore(0);
      setAnswers([]);
      setTimeLeft(120);
      setPhase("playing");
    } catch (err) {
      toast({ title: "Error", description: "Failed to create battle", variant: "destructive" });
    }
  };

  const joinBattle = async (battleId: number) => {
    try {
      const res = await apiRequest("POST", `/api/battle/join/${battleId}`, {});
      const data = await res.json();
      
      setCurrentBattle({
        id: battleId,
        challengerId: 0,
        opponentId: user?.id || 0,
        challengerScore: 0,
        opponentScore: null,
        status: "active",
        winnerId: null,
        createdAt: new Date().toISOString()
      });
      setQuestions(data.questions);
      setCurrentIndex(0);
      setScore(0);
      setAnswers([]);
      setTimeLeft(120);
      setPhase("playing");
      
      refetchBattles();
    } catch (err) {
      toast({ title: "Error", description: "Failed to join battle", variant: "destructive" });
    }
  };

  const handleAnswer = async (option: string) => {
    if (selectedOption || !questions[currentIndex]) return;
    
    setSelectedOption(option);
    const correct = option === questions[currentIndex].correctAnswer;
    setIsCorrect(correct);
    setAnswers(prev => [...prev, option]);

    if (correct) {
      setScore(s => s + 1);
      confetti({ 
        particleCount: 30, 
        spread: 50, 
        origin: { y: 0.7 }
      });
    }

    setTimeout(async () => {
      if (currentIndex + 1 >= questions.length) {
        await completeBattle();
      } else {
        setCurrentIndex(i => i + 1);
        setSelectedOption(null);
        setIsCorrect(null);
        setTimeLeft(120);
      }
    }, 1500);
  };

  const completeBattle = async () => {
    const finalScore = score + (isCorrect ? 1 : 0);
    
    try {
      await apiRequest("POST", `/api/battle/submit/${currentBattle?.id}`, {
        answers,
        score: finalScore,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/battle/my-battles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch (err) {
      console.error("Failed to submit battle");
    }
    
    setPhase("complete");
  };

  if (phase === "playing") {
    const currentQuestion = questions[currentIndex];
    
    return (
      <div className="flex min-h-screen bg-background pb-20 md:pb-0 overflow-hidden">
        <Navigation />
        
        <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col items-center justify-center min-h-screen relative">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-3xl w-full space-y-8 relative z-10">
            <div className="flex items-center justify-between bg-card/80 backdrop-blur-md p-4 rounded-2xl border shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Swords className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Score</div>
                  <div className="text-2xl font-bold text-primary">{score}</div>
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
                    {currentQuestion.term && (
                      <div className="mt-4 flex justify-center">
                        <Badge variant="secondary">Term: {currentQuestion.term}</Badge>
                      </div>
                    )}
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
                            <span className="flex-1">{option}</span>
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
                </motion.div>
              )}
            </AnimatePresence>
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
              <div className="inline-block p-6 rounded-3xl bg-gradient-to-br from-blue-400 to-indigo-500 mb-4">
                <Trophy className="w-16 h-16 text-white" />
              </div>
              <h1 className="text-4xl font-display font-bold mb-2" data-testid="text-complete-title">Battle Complete!</h1>
              <p className="text-muted-foreground text-lg">Your answers have been submitted</p>
            </motion.div>

            <Card className="text-center p-8 bg-card/50 backdrop-blur-sm border-2 border-primary/20 shadow-2xl">
              <div className="relative inline-block mb-4">
                <div className="text-7xl font-black text-primary drop-shadow-sm">{score}/{questions.length}</div>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="h-1.5 bg-primary rounded-full mt-2"
                />
              </div>
              <div className="text-xl font-bold text-foreground mb-4">Your Final Score</div>
              
              <div className="p-4 rounded-2xl bg-muted/50 border space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" /> Points Earned:
                  </span>
                  <span className="font-bold text-green-500">+{score * 10} Z-Points</span>
                </div>
                <div className="h-px bg-border" />
                <div className="text-xs text-muted-foreground italic flex items-center justify-center gap-2">
                  <Clock className="w-3 h-3" />
                  Waiting for opponent to complete the battle...
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => {
                  setPhase("menu");
                  setCurrentBattle(null);
                  setQuestions([]);
                  refetchMyBattles();
                }}
                variant="outline"
                size="lg"
                className="py-6 text-lg rounded-xl h-auto"
                data-testid="button-back-menu"
              >
                <ArrowRight className="w-5 h-5 mr-2" />
                Back to Menu
              </Button>
              <Button 
                onClick={() => createBattle(false)}
                size="lg"
                className="py-6 text-lg rounded-xl h-auto"
                data-testid="button-new-battle"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Battle
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-block p-4 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-3xl mb-4"
            >
              <Swords className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-4xl font-display font-bold mb-2" data-testid="text-page-title">Live Battle</h1>
            <p className="text-muted-foreground text-lg">Challenge friends or random opponents</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover:border-primary/50 transition-all cursor-pointer" onClick={() => createBattle(false)}>
              <CardContent className="p-6 space-y-4">
                <div className="p-3 bg-blue-500/10 rounded-xl w-fit">
                  <UserPlus className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Create Battle</h3>
                  <p className="text-sm text-muted-foreground">Start a new battle and wait for an opponent</p>
                </div>
                <Button className="w-full" data-testid="button-create-battle">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Battle
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-all cursor-pointer" onClick={() => createBattle(true)}>
              <CardContent className="p-6 space-y-4">
                <div className="p-3 bg-purple-500/10 rounded-xl w-fit">
                  <Shuffle className="w-8 h-8 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Random Match</h3>
                  <p className="text-sm text-muted-foreground">Join a random available battle</p>
                </div>
                <Button variant="secondary" className="w-full" data-testid="button-random-match">
                  <Zap className="w-4 h-4 mr-2" />
                  Find Random Battle
                </Button>
              </CardContent>
            </Card>
          </div>

          {pendingBattles && pendingBattles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Available Battles ({pendingBattles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingBattles.map((battle) => (
                  <div key={battle.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
                    <div>
                      <div className="font-medium">{battle.challengerName || "Anonymous"}</div>
                      <div className="text-sm text-muted-foreground">
                        Created {new Date(battle.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <Button onClick={() => joinBattle(battle.id)} data-testid={`button-join-battle-${battle.id}`}>
                      <Swords className="w-4 h-4 mr-2" />
                      Join
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Weekly Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((entry, idx) => (
                    <div 
                      key={entry.id} 
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl",
                        idx === 0 ? "bg-yellow-500/10 border border-yellow-500/30" :
                        idx === 1 ? "bg-gray-400/10 border border-gray-400/30" :
                        idx === 2 ? "bg-amber-700/10 border border-amber-700/30" :
                        "bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                        idx === 0 ? "bg-yellow-500 text-white" :
                        idx === 1 ? "bg-gray-400 text-white" :
                        idx === 2 ? "bg-amber-700 text-white" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {idx === 0 ? <Crown className="w-4 h-4" /> :
                         idx === 1 ? <Medal className="w-4 h-4" /> :
                         idx === 2 ? <Medal className="w-4 h-4" /> :
                         idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{entry.name}</div>
                        <div className="text-xs text-muted-foreground">{entry.department}</div>
                      </div>
                      <div className="font-bold text-primary">{entry.points} pts</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No battle results yet this week
                </div>
              )}
            </CardContent>
          </Card>

          {myBattles && myBattles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  My Recent Battles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myBattles.slice(0, 5).map((battle) => {
                  const isChallenger = battle.challengerId === user?.id;
                  const myScore = isChallenger ? battle.challengerScore : battle.opponentScore;
                  const theirScore = isChallenger ? battle.opponentScore : battle.challengerScore;
                  const won = battle.winnerId === user?.id;
                  const lost = battle.winnerId !== null && battle.winnerId !== user?.id;
                  
                  return (
                    <div key={battle.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          won ? "bg-green-500/10 text-green-500" :
                          lost ? "bg-red-500/10 text-red-500" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {won ? <Trophy className="w-5 h-5" /> :
                           lost ? <XCircle className="w-5 h-5" /> :
                           <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-medium">
                            {battle.status === "completed" 
                              ? (won ? "Victory" : lost ? "Defeat" : "Draw")
                              : "In Progress"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {myScore !== null ? `Your score: ${myScore}` : "Waiting..."}
                            {theirScore !== null ? ` vs ${theirScore}` : ""}
                          </div>
                        </div>
                      </div>
                      <Badge variant={battle.status === "completed" ? "secondary" : "outline"}>
                        {battle.status}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
