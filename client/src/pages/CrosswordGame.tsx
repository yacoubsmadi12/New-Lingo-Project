import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/Navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trophy, ArrowLeft, RefreshCw, CheckCircle2, Lightbulb, Zap, ShieldAlert, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface CrosswordCell {
  char: string;
  isBlocked: boolean;
  acrossNum?: number;
  downNum?: number;
  userChar: string;
  x: number;
  y: number;
}

interface WordPlacement {
  word: string;
  definition: string;
  x: number;
  y: number;
  direction: "across" | "down";
  num: number;
}

interface CrosswordResponse {
  grid: CrosswordCell[][];
  placements: WordPlacement[];
}

export default function CrosswordGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [grid, setGrid] = useState<CrosswordCell[][]>([]);
  const [placements, setPlacements] = useState<WordPlacement[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ x: number, y: number } | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [puzzleLoaded, setPuzzleLoaded] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  const generateMutation = useMutation({
    mutationFn: async () => {
      setIsLoading(true);
      setHasError(false);
      const res = await apiRequest("GET", `/api/crossword/generate?department=${user?.department}`);
      return res.json() as Promise<CrosswordResponse>;
    },
    onSuccess: (data) => {
      if (data && Array.isArray(data.grid)) {
        setGrid([...data.grid]);
        setPlacements([...(data.placements || [])]);
        setIsWon(false);
        setSelectedCell(null);
        setPuzzleLoaded(true);
      } else {
        setHasError(true);
      }
      setIsLoading(false);
    },
    onError: () => {
      setHasError(true);
      setIsLoading(false);
    }
  });

  const addPointsMutation = useMutation({
    mutationFn: async (points: number) => {
      await apiRequest("POST", "/api/user/points", { points, reason: "Crossword Challenge Completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }
  });

  const handleCellInput = (x: number, y: number, val: string) => {
    if (isWon) return;
    const newGrid = [...grid.map(row => [...row])];
    const char = val.toUpperCase().slice(-1);
    
    if (char && !/[A-Z]/.test(char) && char !== "") return;
    
    newGrid[y][x].userChar = char;
    setGrid(newGrid);

    const allCorrect = newGrid.every(row => 
      row.every(cell => cell.isBlocked || cell.char === cell.userChar)
    );

    if (allCorrect && !isWon) {
      setIsWon(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      addPointsMutation.mutate(50);
      toast({
        title: "Puzzle Solved!",
        description: "Excellent work! You've earned 50 Z-Points.",
      });
    }
  };

  const revealLetter = () => {
    if (!selectedCell || isWon) return;
    
    const { x, y } = selectedCell;
    const cell = grid[y][x];
    
    if (cell.isBlocked || cell.userChar === cell.char) return;
    
    const newGrid = [...grid.map(row => [...row])];
    newGrid[y][x].userChar = cell.char;
    setGrid(newGrid);
    setHintsUsed(prev => prev + 1);
    
    toast({
      title: "Hint Used",
      description: "The correct letter has been revealed.",
    });

    // Check win condition after reveal
    const allCorrect = newGrid.every(row => 
      row.every(cell => cell.isBlocked || cell.char === cell.userChar)
    );

    if (allCorrect && !isWon) {
      setIsWon(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      // Reduce points if hints were used
      const points = Math.max(10, 50 - (hintsUsed + 1) * 5);
      addPointsMutation.mutate(points);
      toast({
        title: "Puzzle Solved!",
        description: `Excellent work! You've earned ${points} Z-Points.`,
      });
    }
  };

  if (!puzzleLoaded && !isLoading && !hasError) {
    return (
      <div className="flex min-h-screen bg-background">
        <Navigation />
        <main className="flex-1 md:ml-64 p-4 md:p-8 flex items-center justify-center">
          <Card className="max-w-md w-full p-8 rounded-3xl border shadow-2xl text-center space-y-6 bg-card hover-elevate transition-all">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Professional Crossword</h2>
              <p className="text-muted-foreground">Ready to test your knowledge in {user?.department}? AI will craft a custom puzzle just for you.</p>
            </div>
            <Button 
              size="lg" 
              className="w-full rounded-xl gap-2 h-12 text-lg font-bold"
              onClick={() => generateMutation.mutate()}
            >
              <Zap className="w-5 h-5 fill-current" /> Start Challenge
            </Button>
            <Link href="/quiz">
              <Button variant="ghost" className="w-full">Cancel</Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      <p className="text-lg font-medium">AI is crafting your professional puzzle...</p>
    </div>
  );

  if (hasError) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4 p-4 text-center">
      <div className="p-4 bg-destructive/10 text-destructive rounded-full">
        <ShieldAlert className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold">AI is currently busy</h2>
      <p className="text-muted-foreground max-w-md">We couldn't generate the crossword. Try again in a moment.</p>
      <Button onClick={() => generateMutation.mutate()}>
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <Link href="/quiz">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Arena
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-yellow-500/50 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                onClick={revealLetter}
                disabled={!selectedCell || isWon}
              >
                <Lightbulb className="w-4 h-4" /> Reveal Letter
              </Button>
              <Button variant="outline" size="sm" onClick={() => generateMutation.mutate()}>
                <RefreshCw className="w-4 h-4 mr-2" /> New Puzzle
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 p-4 md:p-8 rounded-3xl border shadow-xl bg-card overflow-hidden">
              <div 
                className="grid gap-1 md:gap-2 mx-auto" 
                style={{ 
                  gridTemplateColumns: `repeat(${grid[0]?.length || 12}, minmax(0, 1fr))`,
                  maxWidth: "600px"
                }}
              >
                {grid.map((row, y) => row.map((cell, x) => (
                  <div 
                    key={`${x}-${y}`} 
                    className={cn(
                      "aspect-square relative rounded-sm md:rounded-md border flex items-center justify-center text-sm md:text-xl font-bold transition-all",
                      cell.isBlocked ? "bg-zinc-200/50 dark:bg-zinc-800/50 border-transparent" : "bg-white dark:bg-zinc-900 border-muted-foreground/20 shadow-sm",
                      selectedCell?.x === x && selectedCell?.y === y && "ring-2 ring-primary border-primary z-10"
                    )}
                  >
                    {!cell.isBlocked && (
                      <>
                        <span className="absolute top-0.5 left-0.5 text-[6px] md:text-[8px] text-muted-foreground leading-none font-medium">
                          {cell.acrossNum || cell.downNum}
                        </span>
                        <input
                          type="text"
                          className="w-full h-full text-center bg-transparent outline-none uppercase p-0"
                          value={cell.userChar}
                          onChange={(e) => handleCellInput(x, y, e.target.value)}
                          onFocus={() => setSelectedCell({ x, y })}
                        />
                      </>
                    )}
                  </div>
                )))}
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-3xl border shadow-lg overflow-hidden">
                <CardHeader className="bg-primary/10 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="w-5 h-5 text-primary" /> Hints
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                  {placements.map((p, i) => (
                    <div key={i} className="p-3 rounded-xl bg-muted/50 border border-muted-foreground/10 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                          {p.num}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-primary/70">{p.direction}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{p.definition}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <AnimatePresence>
                {isWon && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-3xl bg-green-500 text-white text-center space-y-4 shadow-xl shadow-green-500/20"
                  >
                    <CheckCircle2 className="w-12 h-12 mx-auto" />
                    <h3 className="text-2xl font-bold">Mission Accomplished!</h3>
                    <p className="text-white/90">You've mastered the professional vocabulary for your department.</p>
                    <div className="flex items-center justify-center gap-2 font-bold text-lg">
                      <Zap className="w-5 h-5 fill-current" /> +50 Z-Points
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
