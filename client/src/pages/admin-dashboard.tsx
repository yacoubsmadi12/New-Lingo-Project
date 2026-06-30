import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, LdapSettings, Badge, Reward, Quiz } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLdapSettingsSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShieldCheck, Users, Settings, Award, ArrowLeft, BarChart3, TrendingUp, BookOpen, UserCheck, Search } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from "recharts";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: quizzes } = useQuery<Quiz[]>({
    queryKey: ["/api/admin/quizzes"],
  });

  const { data: ldapSettings } = useQuery<LdapSettings>({
    queryKey: ["/api/admin/ldap-settings"],
  });

  const { data: badges } = useQuery<Badge[]>({
    queryKey: ["/api/admin/badges"],
  });

  // Analytics Calculation
  const stats = useMemo(() => {
    if (!users) return null;
    
    const deptStats = users.reduce((acc: any, u) => {
      if (!acc[u.department]) {
        acc[u.department] = { name: u.department, points: 0, learned: 0, count: 0 };
      }
      acc[u.department].points += u.points;
      acc[u.department].learned += u.wordsLearned;
      acc[u.department].count += 1;
      return acc;
    }, {});

    const sortedDepts = Object.values(deptStats).sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
    const mostActiveDept = (sortedDepts[0] as any)?.name || "N/A";
    
    const sortedLearned = [...Object.values(deptStats)].sort((a: any, b: any) => (b.learned || 0) - (a.learned || 0));
    const mostLearningDept = (sortedLearned[0] as any)?.name || "N/A";

    return {
      deptData: Object.values(deptStats),
      mostActiveDept,
      mostLearningDept,
      totalPoints: users.reduce((sum, u) => sum + u.points, 0),
      avgPoints: users.length ? Math.round(users.reduce((sum, u) => sum + u.points, 0) / users.length) : 0,
      totalWords: users.reduce((sum, u) => sum + u.wordsLearned, 0)
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => 
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const COLORS = ["#ED1C24", "#00A859", "#0071C5", "#FDB913", "#93278F"];

  const ldapForm = useForm({
    resolver: zodResolver(insertLdapSettingsSchema),
    defaultValues: ldapSettings || {
      url: "ldap://localhost:389",
      bindDn: "",
      bindPassword: "",
      baseDn: "",
      adminGroup: "Learning_Admins",
    },
  });

  const updateLdapMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/ldap-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "LDAP settings updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ldap-settings"] });
    },
  });

  const ldapSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/ldap-sync");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sync Successful", description: `Fetched ${data.userCount} users.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  const awardBadgeMutation = useMutation({
    mutationFn: async ({ userId, badgeId }: { userId: number; badgeId: number }) => {
      await apiRequest("POST", "/api/admin/award-badge", { userId, badgeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Badge awarded" });
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="mt-2 text-muted-foreground">Admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
              <p className="text-muted-foreground">Manage platform performance and engagement</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2 rounded-full hover-elevate">
              <ArrowLeft className="w-4 h-4" />
              Exit Dashboard
            </Button>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-l-4 border-l-primary shadow-sm hover-elevate transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <h3 className="text-2xl font-bold">{users?.length || 0}</h3>
                </div>
                <Users className="w-8 h-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 shadow-sm hover-elevate transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Engagement</p>
                  <h3 className="text-2xl font-bold">{stats?.avgPoints || 0} pts</h3>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover-elevate transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Top Department</p>
                  <h3 className="text-xl font-bold truncate max-w-[150px]">{stats?.mostActiveDept}</h3>
                </div>
                <ShieldCheck className="w-8 h-8 text-blue-500/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 shadow-sm hover-elevate transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Knowledge</p>
                  <h3 className="text-2xl font-bold">{stats?.totalWords || 0} words</h3>
                </div>
                <BookOpen className="w-8 h-8 text-orange-500/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-full w-fit">
            <TabsTrigger value="overview" className="rounded-full px-6 gap-2">
              <BarChart3 className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="employees" className="rounded-full px-6 gap-2">
              <UserCheck className="w-4 h-4" /> Performance
            </TabsTrigger>
            <TabsTrigger value="ldap" className="rounded-full px-6 gap-2">
              <Settings className="w-4 h-4" /> Integration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Department Engagement</CardTitle>
                  <CardDescription>Points distribution across organizational units</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.deptData || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="points" fill="#ED1C24" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>My Progress</CardTitle>
                  <CardDescription>Total industry terms mastered by department</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.deptData || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="learned"
                      >
                        {(stats?.deptData || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {(stats?.deptData || []).map((dept: any, i: number) => (
                      <div key={dept.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-muted-foreground">{dept.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <Card className="overflow-hidden border-none shadow-md">
              <CardHeader className="bg-muted/30 pb-6 border-b">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Employee Performance Tracker</CardTitle>
                    <CardDescription>Real-time skill and engagement monitoring</CardDescription>
                  </div>
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search employees..." 
                      className="pl-10 rounded-full"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingUsers ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="font-bold py-4">Employee</TableHead>
                          <TableHead className="font-bold">Department</TableHead>
                          <TableHead className="font-bold">Engagement Score</TableHead>
                          <TableHead className="font-bold">Words Mastered</TableHead>
                          <TableHead className="font-bold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u) => (
                          <TableRow key={u.id} className="hover:bg-muted/10 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                  {u.fullName?.charAt(0) || u.username.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-semibold">{u.fullName || u.username}</div>
                                  <div className="text-xs text-muted-foreground">ID: {u.username}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                                {u.department}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-500" />
                                <span className="font-bold">{u.points}</span>
                                <span className="text-xs text-muted-foreground ml-1">pts</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 w-32">
                                <div className="flex justify-between text-xs font-medium">
                                  <span>{u.wordsLearned} terms</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary transition-all duration-500" 
                                    style={{ width: `${Math.min((u.wordsLearned / 50) * 100, 100)}%` }} 
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="rounded-full gap-2 border-primary/20 hover:border-primary text-primary"
                                onClick={() => {
                                  const badgeId = badges?.[0]?.id;
                                  if (badgeId) awardBadgeMutation.mutate({ userId: u.id, badgeId });
                                }}
                                disabled={awardBadgeMutation.isPending}
                              >
                                <Award className="w-4 h-4" />
                                Award
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ldap" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>LDAP Configuration</CardTitle>
                  <CardDescription>Enterprise directory synchronization settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...ldapForm}>
                    <form onSubmit={ldapForm.handleSubmit((data) => updateLdapMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={ldapForm.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LDAP Server URL</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="ldap://active-directory.local:389" className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ldapForm.control}
                        name="bindDn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bind Distinguished Name (DN)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="cn=admin,dc=company,dc=com" className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ldapForm.control}
                        name="bindPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bind Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="••••••••" className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ldapForm.control}
                        name="baseDn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base DN</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="ou=users,dc=company,dc=com" className="rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full rounded-full mt-4" disabled={updateLdapMutation.isPending}>
                        {updateLdapMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Configuration
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle>Manual Data Sync</CardTitle>
                    <CardDescription>Force immediate synchronization with AD</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Use this tool to manually trigger a full directory sync. This will update employee IDs, 
                      department affiliations, and group memberships.
                    </p>
                    <Button 
                      onClick={() => ldapSyncMutation.mutate()} 
                      className="w-full rounded-full" 
                      variant="default"
                      disabled={ldapSyncMutation.isPending}
                    >
                      {ldapSyncMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Trigger Employee Sync
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Health</CardTitle>
                    <CardDescription>Live connection status monitor</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm font-medium">Database Connection</span>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs text-green-700 font-bold uppercase">Online</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <span className="text-sm font-medium">AI Service (Gemini)</span>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-xs text-blue-700 font-bold uppercase">Active</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}