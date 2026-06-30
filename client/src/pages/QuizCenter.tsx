import { useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/Navigation";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Brain, LayoutGrid, Trophy, Zap, Medal, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

const games = [
  {
    id: "ai-duel",
    title: "Term Duel (AI)",
    desc: "Go head-to-head against an AI opponent. Answer fast, earn points, and climb the ranks.",
    icon: Brain,
    color: "from-purple-500 to-indigo-600",
    href: "/term-duel",
    badge: "🎯 AI Battle",
    points: "10 pts/correct",
  },
  {
    id: "crossword",
    title: "Crossword",
    desc: "Solve an AI-generated crossword puzzle built from your department's vocabulary definitions.",
    icon: LayoutGrid,
    color: "from-emerald-400 to-teal-600",
    href: "/crossword",
    badge: "🧩 Expert Mind",
    points: "50 pts/win",
  },
];

const rankMedals = [
  { icon: Crown, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20", label: "1st" },
  { icon: Medal, color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-800/40", label: "2nd" },
  { icon: Medal, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", label: "3rd" },
];

export default function QuizCenter() {
  const { data: leaderboard } = useQuery<User[]>({
    queryKey: ["/api/leaderboard"],
  });

  const top3 = leaderboard?.slice(0, 3) || [];

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-10">

          {/* Header */}
          <div>
            <h1 className="text-3xl font-display font-bold">Games</h1>
            <p className="text-muted-foreground mt-1">Choose a game, earn points, and rise on the leaderboard.</p>
          </div>

          {/* Game Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {games.map((game, idx) => (
              <Link key={game.id} href={game.href} data-testid={`link-game-${game.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative h-full min-h-[220px] rounded-3xl p-7 text-white overflow-hidden shadow-lg bg-gradient-to-br ${game.color} cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-300`}
                >
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="flex items-start justify-between">
                      <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                        <game.icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide">
                        {game.badge}
                      </div>
                    </div>
                    <div className="mt-6 space-y-1.5">
                      <h3 className="text-2xl font-bold">{game.title}</h3>
                      <p className="text-white/80 text-sm leading-relaxed">{game.desc}</p>
                      <div className="pt-3 flex items-center gap-1.5 text-white/90 text-xs font-bold">
                        <Zap className="w-3.5 h-3.5 fill-white/80" />
                        {game.points}
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl" />
                </motion.div>
              </Link>
            ))}
          </div>

          {/* Top Ranks */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-bold">Top Ranks</h2>
            </div>

            {top3.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6 border rounded-2xl bg-muted/20">
                No rankings yet — be the first to play!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {top3.map((u, i) => {
                  const medal = rankMedals[i];
                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                      className="flex items-center gap-4 p-4 rounded-2xl border bg-card shadow-sm"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${medal.bg}`}>
                        <medal.icon className={`w-5 h-5 ${medal.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate">{u.fullName || u.username}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Zap className="w-3 h-3 text-primary" />
                          {u.points} pts
                        </div>
                      </div>
                      <div className="ml-auto text-2xl font-black text-muted-foreground/30">
                        #{i + 1}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <Link href="/leaderboard">
              <div className="text-center text-sm text-primary font-semibold hover:underline cursor-pointer pt-1">
                View full leaderboard →
              </div>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
