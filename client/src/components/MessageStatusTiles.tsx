import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle, Send, XCircle, MessageSquare, Inbox, Reply, Ban } from "lucide-react";

export default function MessageStatusTiles({ userId }: { userId?: string }) {
  const { t } = useLanguage();

  // API Status definitions - Delivered, Sent, Replied, Failed, OptOut
  const STATUS_CONFIG = {
    delivered: { label: t('chart.delivered'), description: t('tiles.carrierConfirmed'), icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', chartColor: '#10b981' },
    sent: { label: t('chart.sent'), description: t('tiles.sentToCarrier'), icon: Send, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', chartColor: '#3b82f6' },
    replied: { label: t('chart.replied'), description: t('tiles.uniqueFirstReplies'), icon: Reply, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', chartColor: '#8b5cf6' },
    failed: { label: t('chart.failed'), description: t('tiles.notReceived'), icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', chartColor: '#ef4444' },
    optout: { label: t('tiles.optOuts'), description: t('tiles.stopKeyword'), icon: Ban, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', chartColor: '#f97316' },
  };

  const { data: logsData } = useQuery<{ success: boolean; messages: Array<any> }>({
    queryKey: [userId ? '/api/admin/messages' : '/api/client/messages', userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = userId ? `/api/admin/messages?userId=${userId}` : '/api/client/messages';
      const r = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error('Failed to fetch logs');
      return r.json();
    },
    refetchInterval: 10000,
  });

  const { data: inboxData } = useQuery<{ success: boolean; messages?: any[]; count?: number }>({
    queryKey: [userId ? '/api/web/inbox' : '/api/web/inbox', userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const base = '/api/web/inbox';
      const url = userId ? `${base}?userId=${userId}` : base;
      const r = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error('Failed to fetch inbox');
      return r.json();
    },
    refetchInterval: 10000,
  });

  // Fetch opt-out count from number pool stats
  const { data: poolStats } = useQuery<{ numbers: any[]; stats: { total_opt_outs?: number } }>({
    queryKey: ['/api/admin/number-pool'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/admin/number-pool', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!r.ok) return { numbers: [], stats: {} };
      return r.json();
    },
    refetchInterval: 30000, // Less frequent refresh
  });

  const logs = (logsData?.messages || []).map((m: any) => ({
    createdAt: new Date(m?.createdAt || m?.timestamp || Date.now()).getTime(),
    status: String(m?.status || 'sent').toLowerCase(),
    messageCount: Number(m?.messageCount ?? 1),
    recipientsLen: Array.isArray(m?.recipients) ? (m?.recipients as any[]).length : (m?.recipient ? 1 : 0),
    recipient: m?.recipient || (Array.isArray(m?.recipients) ? m?.recipients[0] : null),
  }));
  
  const inboxMessages = ((inboxData as any)?.messages || []).map((i: any) => ({
    timestamp: new Date(i?.timestamp || i?.createdAt || Date.now()).getTime(),
    from: i?.from || '',
  }));

  const startOfToday = (() => {
    const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
  })();

  const countFor = (l: any) => {
    const mc = Number(l.messageCount);
    if (Number.isFinite(mc) && mc > 0) return mc;
    const rl = Number(l.recipientsLen);
    return (Number.isFinite(rl) && rl > 0) ? rl : 1;
  };

  // Normalize status for grouping (no more unknown/queued - map to sent)
  const normalizeStatus = (s: string): 'delivered' | 'sent' | 'failed' => {
    const lower = s.toLowerCase();
    if (lower === 'delivered') return 'delivered';
    if (lower === 'failed' || lower === 'error') return 'failed';
    return 'sent'; // queued, sending, pending, unknown all count as sent
  };

  // Calculate unique replied count - unique phone numbers that have replied
  // A "reply" is the first time a unique phone number sends a message back
  const getUniqueRepliedCount = (messages: typeof inboxMessages, sinceTimestamp?: number) => {
    const filtered = sinceTimestamp ? messages.filter(m => m.timestamp >= sinceTimestamp) : messages;
    const uniquePhones = new Set(filtered.map(m => m.from.replace(/\D/g, '')));
    return uniquePhones.size;
  };

  // Total opt-outs from pool stats
  const totalOptOuts = poolStats?.stats?.total_opt_outs || 0;

  // Calculate status breakdown for all time
  const statusBreakdown = logs.reduce((acc, l) => {
    const status = normalizeStatus(l.status);
    acc[status] = (acc[status] || 0) + countFor(l);
    return acc;
  }, {} as Record<string, number>);

  // Add replied count (unique first-time client replies)
  statusBreakdown.replied = getUniqueRepliedCount(inboxMessages);
  // Add opt-out count
  statusBreakdown.optout = totalOptOuts;

  // Calculate status breakdown for today
  const todayLogs = logs.filter(l => l.createdAt >= startOfToday);
  const todayStatusBreakdown = todayLogs.reduce((acc, l) => {
    const status = normalizeStatus(l.status);
    acc[status] = (acc[status] || 0) + countFor(l);
    return acc;
  }, {} as Record<string, number>);

  // Add today's replied count
  todayStatusBreakdown.replied = getUniqueRepliedCount(inboxMessages, startOfToday);
  // Add opt-outs (we don't have today-only count, so show total)
  todayStatusBreakdown.optout = totalOptOuts;

  // Totals
  const totalOutbound = (statusBreakdown.delivered || 0) + (statusBreakdown.sent || 0) + (statusBreakdown.failed || 0);
  const totalReplied = statusBreakdown.replied || 0;
  const todayOutbound = (todayStatusBreakdown.delivered || 0) + (todayStatusBreakdown.sent || 0) + (todayStatusBreakdown.failed || 0);
  const todayReplied = todayStatusBreakdown.replied || 0;

  // Status bar - shows proportion of outbound statuses
  const StatusBar = ({ breakdown }: { breakdown: Record<string, number> }) => {
    const total = (breakdown.delivered || 0) + (breakdown.sent || 0) + (breakdown.failed || 0);
    if (total === 0) return <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700" />;
    return (
      <div className="h-2 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-700">
        {(['delivered', 'sent', 'failed'] as const).map(status => {
          const count = breakdown[status] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          const colors = {
            delivered: 'bg-green-500',
            sent: 'bg-blue-500',
            failed: 'bg-red-500',
          };
          return <div key={status} className={`${colors[status]}`} style={{ width: `${pct}%` }} />;
        })}
      </div>
    );
  };

  // Status breakdown grid - 5 columns: Delivered, Sent, Replied, Failed, Opt-Outs
  const StatusBreakdownList = ({ breakdown }: { breakdown: Record<string, number> }) => (
    <div className="grid grid-cols-5 gap-2 mt-3">
      {(['delivered', 'sent', 'replied', 'failed', 'optout'] as const).map(status => {
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        const count = breakdown[status] || 0;
        return (
          <div key={status} className={`flex flex-col items-center p-2.5 rounded-lg ${config.bg} border ${config.border}`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
            <span className="text-lg font-bold mt-1">{count.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground text-center leading-tight font-medium">{config.label}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* All Time Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            {t('tiles.messageStatusAllTime')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Send className="h-3 w-3" /> {t('tiles.totalOutbound')}
              </div>
              <div className="text-2xl font-bold">{totalOutbound.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/30">
              <div className="text-xs text-purple-600 flex items-center gap-1.5">
                <Reply className="h-3 w-3" /> {t('tiles.uniqueReplies')}
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{totalReplied.toLocaleString()}</div>
            </div>
          </div>
          
          {/* Status bar */}
          <StatusBar breakdown={statusBreakdown} />
          
          {/* Status breakdown */}
          <StatusBreakdownList breakdown={statusBreakdown} />
        </CardContent>
      </Card>

      {/* Today Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            {t('tiles.messageStatusToday')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Send className="h-3 w-3" /> {t('tiles.totalOutbound')}
              </div>
              <div className="text-2xl font-bold">{todayOutbound.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/30">
              <div className="text-xs text-purple-600 flex items-center gap-1.5">
                <Reply className="h-3 w-3" /> {t('tiles.uniqueReplies')}
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{todayReplied.toLocaleString()}</div>
            </div>
          </div>
          
          {/* Status bar */}
          <StatusBar breakdown={todayStatusBreakdown} />
          
          {/* Status breakdown */}
          <StatusBreakdownList breakdown={todayStatusBreakdown} />
        </CardContent>
      </Card>
    </div>
  );
}
