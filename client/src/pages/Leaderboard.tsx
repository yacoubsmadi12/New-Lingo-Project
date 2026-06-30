import { useAuth } from "@/hooks/use-auth";
import { useLeaderboard } from "@/hooks/use-gamification";
import { Navigation } from "@/components/Navigation";
import { Loader } from "@/components/Loader";
import { Trophy, Medal, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Leaderboard() {
  const { user } = useAuth();
  const { data: leaderboard, isLoading } = useLeaderboard();

  if (isLoading) return <Loader />;

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold">Leaderboard</h1>
              <p className="text-muted-foreground">Top performers this week.</p>
            </div>
            <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Season 4
            </div>
          </div>

          <div className="bg-card rounded-3xl border shadow-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-5 md:col-span-6">User</div>
              <div className="col-span-3 md:col-span-3 text-right">Points</div>
              <div className="col-span-3 md:col-span-2 text-center">Streak</div>
            </div>

            <div className="divide-y">
              {leaderboard?.map((entry, idx) => {
                const isMe = user?.username === entry.username;
                const rank = idx + 1;
                
                return (
                  <div 
                    key={idx}
                    className={cn(
                      "grid grid-cols-12 gap-4 p-4 items-center transition-colors hover:bg-muted/30",
                      isMe ? "bg-primary/5 hover:bg-primary/10" : ""
                    )}
                  >
                    <div className="col-span-1 flex justify-center">
                      {rank === 1 && <Medal className="w-6 h-6 text-yellow-500" />}
                      {rank === 2 && <Medal className="w-6 h-6 text-gray-400" />}
                      {rank === 3 && <Medal className="w-6 h-6 text-orange-500" />}
                      {rank > 3 && <span className="font-bold text-muted-foreground w-6 text-center">{rank}</span>}
                    </div>
                    
                    <div className="col-span-5 md:col-span-6 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold text-xs">
                        {entry.username.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className={cn("font-bold", isMe ? "text-primary" : "")}>
                          {entry.username} {isMe && "(You)"}
                        </div>
                        <div className="text-xs text-muted-foreground">{entry.department}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 md:col-span-3 text-right font-mono font-bold text-foreground">
                      {entry.points.toLocaleString()}
                    </div>
                    
                    <div className="col-span-3 md:col-span-2 flex justify-center items-center gap-1 text-orange-500 font-bold">
                      <Flame className="w-4 h-4 fill-orange-500" />
                      {entry.streak}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
