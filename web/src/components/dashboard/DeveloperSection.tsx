import React, { useState, useEffect, useCallback } from "react";
import { Server, Database, Activity, Wifi, WifiOff } from "lucide-react";
import { Card } from "@/components/common/Card";
import { KpiCard } from "./shared/KpiCard";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { SectionSkeleton } from "./shared/SectionSkeleton";
import api from "@/services/api";

interface MonitoringData {
  timestamp: string;
  cache: {
    connected: boolean;
    hitRate: string;        // e.g. "0.00%"
    totalRequests: number;
    averageResponseTime: string; // e.g. "0.00ms"
  };
  redis: {
    connected: boolean;
  };
}

export const DeveloperSection: React.FC = () => {
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/monitoring/health");
      const data: MonitoringData = res.data?.data ?? null;
      setMonitoring(data);
      setLastRefresh(new Date());
    } catch {
      setError("Failed to fetch monitoring data.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await doFetch();
      setIsLoading(false);
    })();
  }, [doFetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await doFetch();
    setIsRefreshing(false);
  }, [doFetch]);

  if (isLoading) return <SectionSkeleton cards={4} rows={0} />;

  // Parse hitRate string "12.50%" → 12.50
  const hitRateNum = monitoring?.cache?.hitRate
    ? parseFloat(monitoring.cache.hitRate.replace("%", ""))
    : 0;

  // Parse averageResponseTime "1.23ms" → "1.23ms" (display as-is)
  const avgResponseTime = monitoring?.cache?.averageResponseTime ?? "—";

  const cacheConnected = monitoring?.cache?.connected ?? false;
  const redisConnected = monitoring?.redis?.connected ?? false;
  const systemOk = cacheConnected && redisConnected;

  return (
    <div className={`space-y-5 transition-opacity duration-200 ${isRefreshing ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
      <DashboardSectionHeader
        icon={<Server size={18} />}
        title="System Monitoring"
        action={{ label: isRefreshing ? "Refreshing…" : "Refresh", onClick: handleRefresh }}
      />

      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100
          rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="System Status"
          value={systemOk ? "Healthy" : "Issue"}
          icon={systemOk
            ? <Wifi size={20} />
            : <WifiOff size={20} />}
          iconBg={systemOk ? "bg-green-50" : "bg-red-50"}
          iconColor={systemOk ? "text-green-600" : "text-red-500"}
        />
        <KpiCard
          title="Cache hit rate"
          value={`${hitRateNum.toFixed(1)}%`}
          icon={<Database size={20} />}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          description={`${monitoring?.cache?.totalRequests ?? 0} requests`}
        />
        <KpiCard
          title="Redis"
          value={redisConnected ? "Connected" : "Disconnected"}
          icon={<Database size={20} />}
          iconBg={redisConnected ? "bg-green-50" : "bg-red-50"}
          iconColor={redisConnected ? "text-green-600" : "text-red-500"}
        />
        <KpiCard
          title="Avg Response Time"
          value={avgResponseTime}
          icon={<Activity size={20} />}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Status detail card */}
      {monitoring && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase
                tracking-wide mb-2">
                Cache
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Connection</span>
                  <span className={`font-medium ${
                    cacheConnected ? "text-green-600" : "text-red-500"
                  }`}>
                    {cacheConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Requests</span>
                  <span className="font-medium text-gray-800">
                    {monitoring.cache.totalRequests.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hit rate</span>
                  <span className="font-medium text-gray-800">
                    {monitoring.cache.hitRate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Response Time</span>
                  <span className="font-medium text-gray-800">
                    {monitoring.cache.averageResponseTime}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase
                tracking-wide mb-2">
                Redis
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Connection</span>
                  <span className={`font-medium ${
                    redisConnected ? "text-green-600" : "text-red-500"
                  }`}>
                    {redisConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-4">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(monitoring.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
