import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { InsertTerm } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useTerms(department?: string) {
  const url = department 
    ? buildUrl(api.terms.list.path) + `?department=${department}`
    : api.terms.list.path;

  return useQuery({
    queryKey: [api.terms.list.path, department],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch terms");
      return api.terms.list.responses[200].parse(await res.json());
    },
    enabled: !!department, // Only fetch if department is selected (or handle 'all' logic in UI)
  });
}

export function useCreateTerm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertTerm) => {
      const res = await fetch(api.terms.create.path, {
        method: api.terms.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create term");
      }
      return api.terms.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.terms.list.path] });
      toast({ title: "Term created", description: "New vocabulary added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
