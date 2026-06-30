import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useTerms } from "@/hooks/use-terms";
import { Navigation } from "@/components/Navigation";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw, ArrowLeft, BookOpen, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LearnedTerm {
  id: number;
  userId: number;
  termId: number;
  learnedAt: string;
  term: {
    id: number;
    term: string;
    definition: string;
    example: string;
    department: string;
  };
}

export default function FlashcardsPage() {
  const { department } = useParams();
  const { data: terms, isLoading, error, refetch } = useTerms(department);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  useEffect(() => {
    if (department) {
      apiRequest("POST", "/api/user/points", { points: 5, reason: `Viewed ${department}` })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/user"] }));
    }
  }, [department]);

  // Fetch learned terms
  const { data: learnedTerms = [] } = useQuery<LearnedTerm[]>({
    queryKey: ["/api/user/learned-terms"],
  });

  // Filter learned terms by department
  const departmentLearnedTerms = learnedTerms.filter(
    (lt) => lt.term?.department === department
  );

  // Fetch daily content if no terms found
  const { data: dailyContent, isLoading: isLoadingDaily } = useQuery({
    queryKey: ["/api/ai/daily-content", { department }],
    queryFn: async () => {
      const res = await fetch(`/api/ai/daily-content?department=${encodeURIComponent(department || "")}`);
      if (!res.ok) throw new Error("Failed to fetch daily content");
      return res.json();
    },
    enabled: !!department && (!terms || terms.length === 0) && !isLoading,
  });

  // Re-fetch terms after daily content is generated
  useEffect(() => {
    if (dailyContent && terms?.length === 0) {
      refetch();
    }
  }, [dailyContent, terms, refetch]);

  if (isLoading || isLoadingDaily) return <Loader />;
  if (error || !terms) return <div className="p-8 text-center text-red-500">Failed to load terms.</div>;

  if (terms.length === 0 && departmentLearnedTerms.length === 0) return (
    <div className="flex min-h-screen bg-background items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">No terms found</h2>
        <Link href="/learn"><Button data-testid="button-back-to-learn">Back to Learn</Button></Link>
      </div>
    </div>
  );

  const currentTerm = terms[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % terms.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + terms.length) % terms.length);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (!isFlipped && currentTerm) {
      apiRequest("POST", `/api/user/learned-terms/${currentTerm.id}`, {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/user/learned-terms"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        })
        .catch(err => console.error("Failed to mark term as learned:", err));
    }
  };

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col h-screen md:h-auto overflow-hidden">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
          
          <div className="flex items-center gap-4 mb-6">
            <Link href="/learn">
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold">{department} Flashcards</h1>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "current" | "history")} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
              <TabsTrigger value="current" className="gap-2" data-testid="tab-current">
                <BookOpen className="w-4 h-4" />
                Current Terms ({terms.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
                <History className="w-4 h-4" />
                Learned ({departmentLearnedTerms.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="flex-1">
              {terms.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">No current terms available.</p>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm mb-4">{currentIndex + 1} of {terms.length} terms</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center flex-1">
                    <div className="md:col-span-1 flex justify-center">
                      <AnimatedAvatar 
                        department={department || ""} 
                        textToSpeak={currentTerm ? (isFlipped ? currentTerm.definition : currentTerm.term) : ""} 
                      />
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-8">
                      <div className="flex-1 flex items-center justify-center min-h-[300px] perspective-1000">
                        <motion.div
                          className="relative w-full aspect-[4/3] cursor-pointer group"
                          onClick={handleFlip}
                          initial={false}
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                          style={{ transformStyle: "preserve-3d" }}
                          data-testid="flashcard"
                        >
                          {/* Front */}
                          <div className="absolute inset-0 backface-hidden bg-card border-2 border-border shadow-2xl rounded-3xl flex flex-col items-center justify-center p-8 text-center hover:border-primary/50 transition-colors">
                            <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">Term</div>
                            <h2 className="text-4xl font-bold text-primary break-words max-w-full">{currentTerm?.term}</h2>
                            <p className="mt-8 text-sm text-muted-foreground">Tap to reveal definition</p>
                          </div>

                          {/* Back */}
                          <div className="absolute inset-0 backface-hidden bg-primary/5 border-2 border-primary shadow-2xl rounded-3xl flex flex-col items-center justify-center p-8 text-center rotate-y-180">
                            <div className="text-xs font-bold tracking-widest text-primary uppercase mb-4">Definition</div>
                            <p className="text-lg font-medium text-foreground mb-6 leading-snug line-clamp-4">
                              {currentTerm?.definition
                                ? currentTerm.definition.split(". ").slice(0, 2).join(". ") + (currentTerm.definition.split(". ").length > 2 ? "." : "")
                                : ""}
                            </p>
                            <div className="bg-background/50 p-3 rounded-xl text-sm italic text-muted-foreground line-clamp-2">
                              "{currentTerm?.example}"
                            </div>
                          </div>
                        </motion.div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center justify-center gap-6">
                        <Button variant="outline" size="lg" onClick={handlePrev} className="rounded-full w-14 h-14 p-0 hover-elevate" data-testid="button-prev">
                          <ChevronLeft className="w-6 h-6" />
                        </Button>
                        
                        <Button variant="ghost" size="lg" onClick={handleFlip} className="rounded-full w-14 h-14 p-0 bg-secondary/10 text-secondary hover:bg-secondary/20 hover-elevate" data-testid="button-flip">
                          <RotateCcw className="w-6 h-6" />
                        </Button>

                        <Button variant="outline" size="lg" onClick={handleNext} className="rounded-full w-14 h-14 p-0 hover-elevate" data-testid="button-next">
                          <ChevronRight className="w-6 h-6" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex-1">
              {departmentLearnedTerms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <History className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No learned terms yet</h3>
                  <p className="text-muted-foreground">Terms you learn will appear here so you can review them anytime.</p>
                </div>
              ) : (
                <ScrollArea className="h-[60vh]">
                  <div className="grid gap-4">
                    {departmentLearnedTerms.map((lt) => (
                      <Card key={lt.id} className="hover-elevate" data-testid={`learned-term-${lt.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-lg text-primary">{lt.term.term}</CardTitle>
                            <span className="text-xs text-muted-foreground">
                              {new Date(lt.learnedAt).toLocaleDateString("ar-SA")}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-foreground mb-2">{lt.term.definition}</p>
                          <p className="text-sm italic text-muted-foreground">"{lt.term.example}"</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
