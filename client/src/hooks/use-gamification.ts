import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useLeaderboard() {
  return useQuery({
    queryKey: [api.leaderboard.list.path],
    queryFn: async () => {
      const res = await fetch(api.leaderboard.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return api.leaderboard.list.responses[200].parse(await res.json());
    },
  });
}

export function useUserBadges() {
  return useQuery({
    queryKey: [api.badges.userBadges.path],
    queryFn: async () => {
      const res = await fetch(api.badges.userBadges.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch badges");
      return api.badges.userBadges.responses[200].parse(await res.json());
    },
  });
}

export function useAllBadges() {
  return useQuery({
    queryKey: [api.badges.list.path],
    queryFn: async () => {
      const res = await fetch(api.badges.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch badges");
      return api.badges.list.responses[200].parse(await res.json());
    },
  });
}
