import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { InsertQuiz } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useQuizHistory() {
  return useQuery({
    queryKey: [api.quizzes.history.path],
    queryFn: async () => {
      const res = await fetch(api.quizzes.history.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quiz history");
      return api.quizzes.history.responses[200].parse(await res.json());
    },
  });
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertQuiz) => {
      const res = await fetch(api.quizzes.create.path, {
        method: api.quizzes.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to submit quiz result");
      }
      return api.quizzes.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.quizzes.history.path] });
      queryClient.invalidateQueries({ queryKey: [api.leaderboard.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] }); // Update points/streak
    },
    onError: (error: Error) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    },
  });
}

// AI Duel Hook
export function useAiDuel() {
  return useMutation({
    mutationFn: async (options: { topic?: string; difficulty: 'easy'|'medium'|'hard' }) => {
      const res = await fetch(api.ai.duel.path, {
        method: api.ai.duel.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to generate AI question");
      return api.ai.duel.responses[200].parse(await res.json());
    },
  });
}
