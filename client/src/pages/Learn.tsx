import { useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/Navigation";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Megaphone,
  Briefcase,
  Code2,
  Scale,
  Users,
  Wallet,
  ShieldCheck,
  ShoppingBag,
  Cpu,
  MessageSquareShare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const departments = [
  { id: "Finance", icon: Wallet, color: "from-emerald-400 to-emerald-600", desc: "Banking, accounts, and financial management." },
  { id: "Human Resources", icon: Users, color: "from-green-400 to-green-600", desc: "Talent, culture, and organizational dev." },
  { id: "Engineering", icon: Code2, color: "from-purple-500 to-purple-700", desc: "Technical specs, protocols, and networks." },
  { id: "Marketing", icon: Megaphone, color: "from-pink-400 to-pink-600", desc: "Campaigns, reach, and branding terms." },
  { id: "Sales", icon: Briefcase, color: "from-blue-400 to-blue-600", desc: "Negotiation, pipelines, and closing deals." },
  { id: "Governance, Risk, and Compliance", icon: ShieldCheck, color: "from-slate-500 to-slate-700", desc: "Regulations, risk management, and compliance." },
  { id: "Consumer Business", icon: ShoppingBag, color: "from-orange-400 to-orange-600", desc: "Retail, consumer behavior, and business models." },
  { id: "Legal and Regulatory", icon: Scale, color: "from-amber-500 to-amber-700", desc: "Compliance, contracts, and regulations." },
  { id: "Technology & Digital Innovation", icon: Cpu, color: "from-cyan-400 to-cyan-600", desc: "Cutting-edge tech and digital transformation." },
  { id: "Corporate Communications & Sustainability", icon: MessageSquareShare, color: "from-teal-400 to-teal-600", desc: "External relations and ESG initiatives." },
  { id: "Data Analytics and AI", icon: Code2, color: "from-indigo-500 to-indigo-700", desc: "Big data, machine learning, and AI insights." },
];

export default function Learn() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate).toDateString() : null;
      const today = new Date().toDateString();

      if (lastLogin !== today) {
        apiRequest("POST", "/api/user/points", { points: 5, reason: "Daily login" })
          .then(() => queryClient.invalidateQueries({ queryKey: ["/api/user"] }));
      }
    }
  }, [user]);

  if (!user) return null;

  const isEngineering = user.department === "Engineering";

  const visibleDepartments = isEngineering
    ? departments.filter(d => d.id !== "Engineering")
    : departments;

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">Study Center</h1>
            <p className="text-muted-foreground">
              {isEngineering
                ? "Explore and learn terms from all departments."
                : "Select a department to start learning terms."}
            </p>
            {isEngineering && (
              <p className="text-xs text-primary mt-1 font-medium">
                💡 Your Engineering word of the day is on the Home page.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {visibleDepartments.map((dept, index) => {
              const isUserDept = user.department === dept.id;
              return (
                <div key={dept.id} className="flex flex-col gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className={cn(
                      "relative overflow-hidden group rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex-1 bg-gradient-to-br text-white",
                      dept.color,
                      isUserDept ? "ring-4 ring-primary ring-offset-2 dark:ring-offset-background" : ""
                    )}
                  >
                    {isUserDept && (
                      <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-full">
                        YOUR DEPT
                      </div>
                    )}
                    <Link href={`/flashcards/${dept.id}`} className="absolute inset-0 z-10" />
                    <div className="flex items-start gap-4">
                      <div className="p-4 rounded-xl bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                        <dept.icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-white">{dept.id}</h3>
                        </div>
                        <p className="text-sm text-white/80">{dept.desc}</p>
                      </div>
                    </div>
                  </motion.div>

                  <Link href={`/quiz/daily?department=${encodeURIComponent(dept.id)}`}>
                    <Button
                      className="w-full h-11 text-base font-bold rounded-xl shadow-lg bg-white border-2 border-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                      variant="outline"
                    >
                      Take Quiz
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
