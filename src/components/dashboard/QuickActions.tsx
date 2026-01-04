"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, Globe, ListTodo, Loader2 } from "lucide-react";

interface ActionItem {
  id: string;
  label: string;
  count: number;
  icon: React.ElementType;
  endpoint: string;
  color: string;
  bgColor: string;
}

export function QuickActions() {
  const [counts, setCounts] = useState({
    unclassified: 0,
    withoutDomains: 0,
    pendingTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  useEffect(() => {
    fetchCounts();
  }, []);

  async function fetchCounts() {
    try {
      const supabase = createClient();

      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCounts({ unclassified: 0, withoutDomains: 0, pendingTasks: 0 });
        setLoading(false);
        return;
      }

      // Get user's ICP profile IDs
      const { data: icpProfiles } = await supabase
        .from("icp_profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const userIcpIds = (icpProfiles || []).map(p => p.id);

      if (userIcpIds.length === 0) {
        setCounts({ unclassified: 0, withoutDomains: 0, pendingTasks: 0 });
        setLoading(false);
        return;
      }

      // Get companies linked to user's ICPs via signals
      const { data: signalData } = await supabase
        .from("company_pain_signals")
        .select("company_id")
        .in("icp_profile_id", userIcpIds)
        .eq("is_active", true);

      const userCompanyIds = [...new Set((signalData || []).map(s => s.company_id))];

      // Fetch counts filtered by user's companies and ICPs
      let unclassifiedCount = 0;
      let withoutDomainsCount = 0;

      if (userCompanyIds.length > 0) {
        const [unclassifiedResult, withoutDomainsResult] = await Promise.all([
          supabase
            .from("companies")
            .select("id", { count: "exact", head: true })
            .in("id", userCompanyIds)
            .is("agency_classified_at", null),
          supabase
            .from("companies")
            .select("id", { count: "exact", head: true })
            .in("id", userCompanyIds)
            .is("domain", null),
        ]);
        unclassifiedCount = unclassifiedResult.count ?? 0;
        withoutDomainsCount = withoutDomainsResult.count ?? 0;
      }

      // Pending tasks for user's ICPs only
      const { count: pendingTasksCount } = await supabase
        .from("scan_queue")
        .select("id", { count: "exact", head: true })
        .in("icp_profile_id", userIcpIds)
        .eq("status", "pending");

      setCounts({
        unclassified: unclassifiedCount,
        withoutDomains: withoutDomainsCount,
        pendingTasks: pendingTasksCount ?? 0,
      });
    } catch (error) {
      console.error("Failed to fetch counts:", error);
      toast.error("Failed to load action counts");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(actionId: string, endpoint: string) {
    setRunningAction(actionId);
    try {
      const response = await fetch(endpoint, { method: "POST" });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Action failed");
      }

      const data = await response.json();

      // Show success toast with background processing message
      toast.success(data.message || "Started in background", {
        description: "Check the Activity Feed for progress updates",
      });

      // Refresh counts after a short delay (to allow time for processing to start)
      setTimeout(() => fetchCounts(), 2000);
    } catch (error) {
      console.error("Action failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Action failed"
      );
    } finally {
      setRunningAction(null);
    }
  }

  const actions: ActionItem[] = [
    {
      id: "classify",
      label: `Check ${counts.unclassified} companies for agencies`,
      count: counts.unclassified,
      icon: Building2,
      endpoint: "/api/companies/classify",
      color: "#635BFF",
      bgColor: "#EEF2FF",
    },
    {
      id: "domains",
      label: `Find websites for ${counts.withoutDomains} companies`,
      count: counts.withoutDomains,
      icon: Globe,
      endpoint: "/api/admin/backfill-domains",
      color: "#635BFF",
      bgColor: "#EEF2FF",
    },
    {
      id: "tasks",
      label: `Process ${counts.pendingTasks} queued tasks`,
      count: counts.pendingTasks,
      icon: ListTodo,
      endpoint: "/api/cron/process-scan-queue",
      color: "#635BFF",
      bgColor: "#EEF2FF",
    },
  ];

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const isRunning = runningAction === action.id;
          const hasItems = action.count > 0;

          return (
            <Button
              key={action.id}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 px-4 border-border hover:border-primary hover:bg-primary/10 transition-all"
              disabled={isRunning || !hasItems}
              onClick={() => handleAction(action.id, action.endpoint)}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: action.bgColor }}
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: action.color }} />
                ) : (
                  <Icon className="h-4 w-4" style={{ color: action.color }} />
                )}
              </div>
              <span className="text-sm font-medium text-foreground text-left">
                {action.label}
              </span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
