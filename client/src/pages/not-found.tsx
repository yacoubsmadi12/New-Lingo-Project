import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-4xl font-display font-bold mb-2">404 Page Not Found</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Oops! The page you are looking for might have been removed or temporarily unavailable.
      </p>
      <Link href="/">
        <Button size="lg" className="rounded-full px-8">Return Home</Button>
      </Link>
    </div>
  );
}
