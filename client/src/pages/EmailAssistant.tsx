import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Copy, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EmailAssistant() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [style, setStyle] = useState("professional");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const improveEmail = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/improve-email", { text: input, style });
      const data = await res.json();
      setOutput(data.improvedText);
    } catch (err: any) {
      // apiRequest handles throwing error if response is not ok
      // and it usually returns a response-like object that has .json()
      // but if it's already a standard Error, it won't have .json()
      let message = "Failed to improve email style.";
      
      try {
        if (err.json && typeof err.json === "function") {
          const errorData = await err.json();
          message = errorData.message || message;
        } else if (err.message) {
          message = err.message;
        }
      } catch (e) {
        console.error("Error parsing error response:", e);
      }

      toast({
        title: "Assistant Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Improved email copied to clipboard.",
    });
  };

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Navigation />
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">Email AI Assistant</h1>
            <p className="text-muted-foreground text-lg">Polished, professional emails in seconds</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Draft Email</CardTitle>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue placeholder="Style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    placeholder="Type or paste your email draft here..."
                    className="min-h-[300px] resize-none border-none focus-visible:ring-0 p-0 text-base"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="mt-4 flex justify-end">
                    <Button 
                      onClick={improveEmail} 
                      disabled={loading || !input.trim()}
                      className="gap-2 rounded-xl"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Improve Style
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Improved Version
                    </CardTitle>
                    {output && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={copyToClipboard}
                        className="h-8 gap-2"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        Copy
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {output ? (
                    <div className="space-y-6">
                      <div className="min-h-[200px] whitespace-pre-wrap text-base leading-relaxed p-4 bg-background rounded-lg border">
                        {output}
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground opacity-50 space-y-4">
                      <Send className="w-12 h-12" />
                      <p>Your improved email will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
