import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "@/lib/protected-route";

// Pages
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Learn from "@/pages/Learn";
import FlashcardsPage from "@/pages/FlashcardsPage";
import QuizCenter from "@/pages/QuizCenter";
import QuizRunner from "@/pages/QuizRunner";
import TermDuel from "@/pages/TermDuel";
import DailyMix from "@/pages/DailyMix";
import LiveBattle from "@/pages/LiveBattle";
import CrosswordGame from "@/pages/CrosswordGame";
import Leaderboard from "@/pages/Leaderboard";
import History from "@/pages/History";
import Profile from "@/pages/Profile";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Protected Routes */}
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <ProtectedRoute path="/learn" component={Learn} />
      <ProtectedRoute path="/flashcards/:department" component={FlashcardsPage} />
      <ProtectedRoute path="/quiz" component={QuizCenter} />
      <ProtectedRoute path="/quiz/:mode" component={QuizRunner} />
      <ProtectedRoute path="/term-duel" component={TermDuel} />
      <ProtectedRoute path="/daily-mix" component={DailyMix} />
      <ProtectedRoute path="/live-battle" component={LiveBattle} />
      <ProtectedRoute path="/crossword" component={CrosswordGame} />
      <ProtectedRoute path="/leaderboard" component={Leaderboard} />
      <ProtectedRoute path="/history" component={History} />
      <ProtectedRoute path="/profile" component={Profile} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="zlingo-theme">
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
