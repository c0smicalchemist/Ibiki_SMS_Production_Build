import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { PieChartIcon, BarChart3, Calendar, History } from "lucide-react";
import { useState } from "react";

interface MessageStatusChartProps {
  userId?: string;
}

const STATUS_COLORS = {
  delivered: "#10b981",
  sent: "#3b82f6", 
  replied: "#8b5cf6",
  failed: "#ef4444",
};

export function MessageStatusChart({ userId }: MessageStatusChartProps) {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'pie' | 'bar'>('pie');
  const [timeRange, setTimeRange] = useState<'allTime' | 'today'>('allTime');

  // Fetch outbound message stats
  const { data: statsData } = useQuery({
    queryKey: ["/api/message-status-stats", userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = userId 
        ? `/api/message-status-stats?userId=${userId}`
        : '/api/message-status-stats';
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch message status stats');
      return response.json();
    }
  });

  // Fetch inbox for unique replies count
  const { data: inboxData } = useQuery<{ success: boolean; messages?: any[] }>({
    queryKey: ['/api/web/inbox', userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const base = '/api/web/inbox';
      const url = userId ? `${base}?userId=${userId}` : base;
      const r = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error('Failed to fetch inbox');
      return r.json();
    },
  });

  // Calculate unique replied count - unique phone numbers that have replied
  const inboxMessages = (inboxData?.messages || []).map((i: any) => i?.from || '');
  const uniqueReplies = new Set(inboxMessages.map((f: string) => f.replace(/\D/g, ''))).size;
  
  // Calculate today's unique replies (messages received today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayInboxMessages = (inboxData?.messages || []).filter((i: any) => {
    const ts = new Date(i?.timestamp || i?.createdAt);
    return ts >= today;
  });
  const todayUniqueReplies = new Set(todayInboxMessages.map((i: any) => (i?.from || '').replace(/\D/g, ''))).size;

  // All-time stats
  const allTimeStats = statsData?.stats || { sent: 0, delivered: 0, failed: 0 };
  
  // Today's stats from API
  const todayStats = statsData?.stats?.todayStats || { sent: 0, delivered: 0, failed: 0 };
  
  // Select stats based on time range
  const stats = timeRange === 'today' ? todayStats : allTimeStats;
  const repliesCount = timeRange === 'today' ? todayUniqueReplies : uniqueReplies;
  
  const totalOutbound = stats.sent + stats.delivered + stats.failed;
  const total = totalOutbound + repliesCount;

  const pieData = [
    { name: t('chart.delivered'), value: stats.delivered, color: STATUS_COLORS.delivered },
    { name: t('chart.sent'), value: stats.sent, color: STATUS_COLORS.sent },
    { name: t('chart.replied'), value: repliesCount, color: STATUS_COLORS.replied },
    { name: t('chart.failed'), value: stats.failed, color: STATUS_COLORS.failed },
  ].filter(item => item.value > 0);

  // Bar chart data (for comparison view)
  const barData = [
    { category: t('chart.delivered'), count: stats.delivered, fill: STATUS_COLORS.delivered },
    { category: t('chart.sent'), count: stats.sent, fill: STATUS_COLORS.sent },
    { category: t('chart.replied'), count: repliesCount, fill: STATUS_COLORS.replied },
    { category: t('chart.failed'), count: stats.failed, fill: STATUS_COLORS.failed },
  ];

  // If no data, show a placeholder
  if (total === 0) {
    pieData.push({ name: t('chart.noData'), value: 1, color: "#e5e7eb" });
  }

  const getPercentage = (value: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <Card className="flex flex-col border border-border/60 shadow-sm" data-testid="card-message-status-chart">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">{t('chart.messageStatusOverview')}</CardTitle>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
            {timeRange === 'today' ? t('chart.today') : t('chart.allTime')}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            variant={timeRange === 'allTime' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('allTime')}
            className="h-7 px-2"
            title={t('chart.allTime')}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={timeRange === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('today')}
            className="h-7 px-2"
            title={t('chart.today')}
          >
            <Calendar className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant={viewMode === 'pie' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('pie')}
            className="h-7 px-2"
          >
            <PieChartIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'bar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('bar')}
            className="h-7 px-2"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {viewMode === 'pie' ? (
          <div className="flex items-center justify-between h-full gap-6">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <defs>
                    <radialGradient id="grad-green" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#10b981" />
                    </radialGradient>
                    <radialGradient id="grad-blue" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </radialGradient>
                    <radialGradient id="grad-purple" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </radialGradient>
                    <radialGradient id="grad-red" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </radialGradient>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#00000033" />
                    </filter>
                    <linearGradient id="track" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#e5e7eb" />
                      <stop offset="100%" stopColor="#cbd5e1" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  {/* Animated track behind the ring */}
                  <Pie
                    data={[{ name: 'track', value: 100 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    startAngle={0}
                    endAngle={360}
                    dataKey="value"
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={3000}
                    animationEasing="linear"
                  >
                    <Cell fill="url(#track)" opacity={0.35} />
                  </Pie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} filter="url(#glow)" fill={
                        entry.color === '#10b981' ? 'url(#grad-green)' :
                        entry.color === '#3b82f6' ? 'url(#grad-blue)' :
                        entry.color === '#8b5cf6' ? 'url(#grad-purple)' :
                        entry.color === '#ef4444' ? 'url(#grad-red)' : entry.color
                      } />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length && total > 0) {
                        return (
                          <div className="bg-card border rounded-lg p-2 shadow-lg">
                            <p className="text-sm font-medium">{payload[0].name}</p>
                            <p className="text-sm text-muted-foreground">
                              {payload[0].value} ({getPercentage(payload[0].value as number)}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Center text showing total */}
                  <text 
                    x="50%" 
                    y="48%" 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    className="text-3xl font-bold fill-foreground"
                  >
                    {total}
                  </text>
                  <text 
                    x="50%" 
                    y="58%" 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    className="text-xs fill-muted-foreground"
                  >
                    {t('chart.total')}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-[160px]">
              {total > 0 ? (
                <div className="space-y-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <div className="flex-1 text-xs text-muted-foreground">
                        {d.name}
                      </div>
                      <div className="text-xs font-semibold" style={{ color: d.color }}>
                        {getPercentage(d.value)}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">{t('chart.noData')}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{data.category}</p>
                          <p className="text-sm" style={{ color: data.fill }}>
                            {data.count.toLocaleString()} {t('chart.messages')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="count" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                >
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
