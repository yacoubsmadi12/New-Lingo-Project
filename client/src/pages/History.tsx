import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

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

export default function History() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: learnedTerms, isLoading } = useQuery<LearnedTerm[]>({
    queryKey: ["/api/user/learned-terms"],
  });

  const filteredTerms = learnedTerms?.filter(lt => 
    lt.term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lt.term.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lt.term.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-display font-bold mb-2">Learning History</h1>
              <p className="text-muted-foreground text-lg">Every word you've mastered on your journey</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search your vocabulary..." 
                className="pl-10 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : filteredTerms && filteredTerms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTerms.map((lt, idx) => (
                <motion.div
                  key={lt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="h-full hover-elevate border-2 border-transparent hover:border-primary/20 transition-all overflow-hidden group">
                    <CardHeader className="p-5 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">
                            {lt.term.term}
                          </CardTitle>
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                            {lt.term.department}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                          <Calendar className="w-3 h-3" />
                          {new Date(lt.learnedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {lt.term.definition}
                      </p>
                      <div className="pt-2 border-t border-dashed flex items-center gap-2 text-xs italic text-primary/70">
                        <BookOpen className="w-3 h-3" />
                        "{lt.term.example}"
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No history yet</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                Start your learning journey by exploring daily content or taking quizzes!
              </p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
