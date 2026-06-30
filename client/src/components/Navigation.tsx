import { Link, useLocation } from "wouter";
import { Home, BookOpen, Trophy, User, LogOut, Sword, Shield, History as HistoryIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

export function Navigation() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/learn", icon: BookOpen, label: "Learn" },
    { href: "/quiz", icon: Sword, label: "Games" },
    { href: "/leaderboard", icon: Trophy, label: "Ranks" },
    { href: "/history", icon: HistoryIcon, label: "History" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  const filteredNavItems = user?.role === "admin" 
    ? [{ href: "/", icon: Home, label: "Home" }, { href: "/admin", icon: Shield, label: "Admin" }, { href: "/profile", icon: User, label: "Profile" }]
    : navItems;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r bg-card z-40">
        <div className="p-6 border-b flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xl">Z</span>
          </div>
          <span className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Zlingo
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {filteredNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "animate-pulse" : "group-hover:scale-110 transition-transform")} />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-4">
          <div className="flex items-center justify-between px-4">
            <span className="text-sm font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 px-4 py-2 pb-safe">
        <div className="flex justify-around items-center">
          {filteredNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center gap-1 p-2 cursor-pointer">
                  <div
                    className={cn(
                      "p-2 rounded-xl transition-all duration-200",
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={cn("text-[10px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
