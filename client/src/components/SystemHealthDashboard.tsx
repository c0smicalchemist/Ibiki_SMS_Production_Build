import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Server, 
  Database, 
  Wifi, 
  Globe,
  MessageSquare,
  Zap,
  Clock,
  Activity,
  HardDrive,
  Users,
  Send,
  FlaskConical,
  Link,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

interface QueueStats {
  success: boolean;
  stats: {
    totalQueued: number;
    totalProcessed: number;
    totalFailed: number;
    queue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    worker: {
      running: boolean;
      concurrency: string;
      rateLimit: string;
    };
  };
}

interface ProxyStatus {
  source: string;
  proxyCount: number;
  lastFetched: string;
  proxies: Array<{
    ip: string;
    port: number;
    city: string;
    country: string;
    isActive: boolean;
  }>;
}

interface SystemHealthData {
  api: HealthStatus | null;
  liveness: { status: string } | null;
  readiness: { status: string; database: string } | null;
  queue: QueueStats | null;
  proxy: ProxyStatus | null;
  database: {
    connected: boolean;
    messageCount: number;
    userCount: number;
  } | null;
  textbeltQuota: number | null;
}

const StatusBadge = ({ status, label }: { status: 'success' | 'warning' | 'error' | 'unknown'; label: string }) => {
  const variants = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  const icons = {
    success: <CheckCircle className="w-3 h-3 mr-1" />,
    warning: <AlertTriangle className="w-3 h-3 mr-1" />,
    error: <XCircle className="w-3 h-3 mr-1" />,
    unknown: <Clock className="w-3 h-3 mr-1" />,
  };

  return (
    <Badge className={`${variants[status]} flex items-center`}>
      {icons[status]}
      {label}
    </Badge>
  );
};

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  status 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  status?: 'success' | 'warning' | 'error' | 'unknown';
}) => (
  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${
        status === 'success' ? 'bg-green-100 dark:bg-green-900' :
        status === 'error' ? 'bg-red-100 dark:bg-red-900' :
        status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' :
        'bg-blue-100 dark:bg-blue-900'
      }`}>
        <Icon className={`w-4 h-4 ${
          status === 'success' ? 'text-green-600 dark:text-green-400' :
          status === 'error' ? 'text-red-600 dark:text-red-400' :
          status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
          'text-blue-600 dark:text-blue-400'
        }`} />
      </div>
      <span className="text-sm font-medium">{title}</span>
    </div>
    <span className="text-sm font-semibold">{value}</span>
  </div>
);

export default function SystemHealthDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; quotaRemaining?: number } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookUrlEdited, setWebhookUrlEdited] = useState(false);

  // Fetch all health data - uses default queryFn which includes auth token
  const { data: healthData, isLoading, refetch } = useQuery<SystemHealthData>({
    queryKey: ['/api/admin/system-health'],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000,
  });

  // Fetch webhook URL config
  const { data: webhookConfig } = useQuery<{ currentUrl: string; source: string; webhookEndpoint: string }>({
    queryKey: ['/api/admin/webhook-url'],
    staleTime: 60000,
  });

  // Update webhookUrl state when config is fetched
  useEffect(() => {
    if (webhookConfig?.currentUrl && !webhookUrlEdited) {
      setWebhookUrl(webhookConfig.currentUrl);
    }
  }, [webhookConfig?.currentUrl, webhookUrlEdited]);

  // Save webhook URL mutation
  const saveWebhookUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/webhook-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setWebhookUrlEdited(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/webhook-url'] });
      toast({
        title: 'Webhook URL Updated',
        description: `New endpoint: ${data.webhookEndpoint}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test SMS mutation
  const testSmsMutation = useMutation({
    mutationFn: async (data: { phone: string; message: string }) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/sms/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Test failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult({
        success: data.success,
        message: data.message,
        quotaRemaining: data.quotaRemaining,
      });
      toast({
        title: data.success ? 'Test Passed ✓' : 'Test Failed',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        message: error.message,
      });
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      setLastChecked(new Date());
      toast({
        title: 'System Check Complete',
        description: 'All health checks have been refreshed.',
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Could not complete system health check.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, toast]);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getApiStatus = () => {
    if (!healthData?.api) return 'unknown';
    return healthData.api.status === 'healthy' ? 'success' : 'error';
  };

  const getQueueStatus = () => {
    if (!healthData?.queue?.stats?.worker) return 'unknown';
    return healthData.queue.stats.worker.running ? 'success' : 'error';
  };

  const getProxyCities = () => {
    if (!healthData?.proxy?.proxies) return [];
    return [...new Set(healthData.proxy.proxies.map(p => p.city))];
  };

  if (isLoading && !healthData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">System Health Dashboard</h2>
          <Button disabled>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Loading...
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">System Health Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {lastChecked 
              ? `Last checked: ${lastChecked.toLocaleTimeString()}`
              : 'Auto-refreshes every 30 seconds'
            }
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Checking...' : 'Run Health Check'}
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card className={`border-l-4 ${
        getApiStatus() === 'success' ? 'border-l-green-500' : 
        getApiStatus() === 'error' ? 'border-l-red-500' : 'border-l-yellow-500'
      }`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getApiStatus() === 'success' ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : getApiStatus() === 'error' ? (
                <XCircle className="w-8 h-8 text-red-500" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              )}
              <div>
                <p className="font-semibold text-lg">
                  {getApiStatus() === 'success' ? 'All Systems Operational' : 
                   getApiStatus() === 'error' ? 'System Issues Detected' : 'Checking Status...'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Version {healthData?.api?.version || 'Unknown'} • 
                  Uptime: {healthData?.api?.uptime ? formatUptime(healthData.api.uptime) : 'Unknown'}
                </p>
              </div>
            </div>
            <StatusBadge 
              status={getApiStatus()} 
              label={healthData?.api?.environment || 'unknown'} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Health Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* API Health */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Server className="w-4 h-4" />
                API Server
              </CardTitle>
              <StatusBadge 
                status={getApiStatus()} 
                label={healthData?.api?.status || 'Unknown'} 
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatCard 
              title="Health Check" 
              value={healthData?.liveness?.status === 'alive' ? 'Passing' : 'Failed'} 
              icon={Activity}
              status={healthData?.liveness?.status === 'alive' ? 'success' : 'error'}
            />
            <StatCard 
              title="Database Ready" 
              value={healthData?.readiness?.database === 'connected' ? 'Connected' : 'Disconnected'} 
              icon={Database}
              status={healthData?.readiness?.database === 'connected' ? 'success' : 'error'}
            />
            <StatCard 
              title="Uptime" 
              value={healthData?.api?.uptime ? formatUptime(healthData.api.uptime) : 'N/A'} 
              icon={Clock}
              status="success"
            />
          </CardContent>
        </Card>

        {/* Queue System */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                SMS Queue
              </CardTitle>
              <StatusBadge 
                status={getQueueStatus()} 
                label={healthData?.queue?.stats?.worker?.running ? 'Running' : 'Stopped'} 
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatCard 
              title="Worker Concurrency" 
              value={`${healthData?.queue?.stats?.worker?.concurrency || 0} jobs`} 
              icon={Activity}
              status="success"
            />
            <StatCard 
              title="Rate Limit" 
              value={`${healthData?.queue?.stats?.worker?.rateLimit || 0} SMS/sec`} 
              icon={Zap}
              status="success"
            />
            <StatCard 
              title="Active Jobs" 
              value={healthData?.queue?.stats?.queue?.active || 0} 
              icon={Clock}
              status={healthData?.queue?.stats?.queue?.active === 0 ? 'success' : 'warning'}
            />
            <StatCard 
              title="Waiting" 
              value={healthData?.queue?.stats?.queue?.waiting || 0} 
              icon={Clock}
              status="success"
            />
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4" />
                Database
              </CardTitle>
              <StatusBadge 
                status={healthData?.database?.connected ? 'success' : 'error'} 
                label={healthData?.database?.connected ? 'Connected' : 'Disconnected'} 
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatCard 
              title="Total Messages" 
              value={healthData?.database?.messageCount?.toLocaleString() || 0} 
              icon={MessageSquare}
              status="success"
            />
            <StatCard 
              title="Total Users" 
              value={healthData?.database?.userCount || 0} 
              icon={Users}
              status="success"
            />
            <StatCard 
              title="Redis" 
              value={healthData?.queue?.success ? 'Connected' : 'Disconnected'} 
              icon={HardDrive}
              status={healthData?.queue?.success ? 'success' : 'error'}
            />
          </CardContent>
        </Card>

        {/* Proxy Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Proxy Rotation
              </CardTitle>
              <StatusBadge 
                status={(healthData?.proxy?.proxyCount || 0) > 0 ? 'success' : 'error'} 
                label={`${healthData?.proxy?.proxyCount || 0} proxies`} 
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatCard 
              title="Provider" 
              value={healthData?.proxy?.source || 'Unknown'} 
              icon={Wifi}
              status="success"
            />
            <StatCard 
              title="US Proxies" 
              value={healthData?.proxy?.proxyCount || 0} 
              icon={Globe}
              status={(healthData?.proxy?.proxyCount || 0) > 0 ? 'success' : 'error'}
            />
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Available Cities:</p>
              <div className="flex flex-wrap gap-1">
                {getProxyCities().slice(0, 4).map((city) => (
                  <Badge key={city} variant="outline" className="text-xs">
                    {city}
                  </Badge>
                ))}
                {getProxyCities().length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{getProxyCities().length - 4} more
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TextBelt Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                TextBelt
              </CardTitle>
              <StatusBadge 
                status={(healthData?.textbeltQuota || 0) > 0 ? 'success' : 'warning'} 
                label={(healthData?.textbeltQuota || 0) > 0 ? 'Active' : 'Low Quota'} 
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatCard 
              title="Quota Remaining" 
              value={healthData?.textbeltQuota?.toLocaleString() || 0} 
              icon={MessageSquare}
              status={(healthData?.textbeltQuota || 0) > 50 ? 'success' : 
                     (healthData?.textbeltQuota || 0) > 10 ? 'warning' : 'error'}
            />
            <StatCard 
              title="Proxy Health" 
              value="Passing" 
              icon={CheckCircle}
              status="success"
            />
          </CardContent>
        </Card>

        {/* Test SMS */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FlaskConical className="w-4 h-4" />
                Test SMS
              </CardTitle>
              <StatusBadge 
                status={testResult ? (testResult.success ? 'success' : 'error') : 'unknown'} 
                label={testResult ? (testResult.success ? 'Passed' : 'Failed') : 'Not Tested'} 
              />
            </div>
            <CardDescription className="text-xs">
              Test API without using quota
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Phone number (e.g., +15551234567)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Test message (optional)"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => testSmsMutation.mutate({ phone: testPhone, message: testMessage })}
              disabled={!testPhone || testSmsMutation.isPending}
            >
              {testSmsMutation.isPending ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3 mr-2" />
                  Run Test (No Quota Used)
                </>
              )}
            </Button>
            {testResult && (
              <div className={`p-2 rounded text-xs ${testResult.success ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                <p>{testResult.message}</p>
                {testResult.quotaRemaining !== undefined && (
                  <p className="mt-1 opacity-75">Quota remaining: {testResult.quotaRemaining}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook URL Config */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link className="w-4 h-4" />
                Webhook Domain
              </CardTitle>
              <StatusBadge 
                status={webhookConfig?.currentUrl ? 'success' : 'warning'} 
                label={webhookConfig?.source === 'database' ? 'Custom' : 'Default'} 
              />
            </div>
            <CardDescription className="text-xs">
              Public URL for TextBelt reply webhooks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="https://your-domain.com"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setWebhookUrlEdited(true);
              }}
              className="h-8 text-sm"
            />
            <div className="text-xs text-muted-foreground break-all">
              Endpoint: <code className="bg-muted px-1 rounded">{webhookUrl}/api/webhook/textbelt</code>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => saveWebhookUrlMutation.mutate(webhookUrl)}
              disabled={!webhookUrl || !webhookUrlEdited || saveWebhookUrlMutation.isPending}
            >
              {saveWebhookUrlMutation.isPending ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-2" />
                  Save Webhook URL
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Change this if you need to switch domains (e.g., if banned). Set up the new domain to point to this server first.
            </p>
          </CardContent>
        </Card>

        {/* Webhook Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                Webhooks
              </CardTitle>
              <StatusBadge 
                status="success" 
                label="Active" 
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatCard 
              title="TextBelt Webhook" 
              value="Receiving" 
              icon={CheckCircle}
              status="success"
            />
            <StatCard 
              title="ExtremeSMS Webhook" 
              value="Configured" 
              icon={CheckCircle}
              status="success"
            />
            <StatCard 
              title="Inbound Routing" 
              value="Active" 
              icon={Activity}
              status="success"
            />
          </CardContent>
        </Card>
      </div>

      {/* Queue Statistics */}
      {healthData?.queue?.stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Queue Processing Statistics</CardTitle>
            <CardDescription>Real-time message queue metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{healthData.queue.stats.totalQueued}</p>
                <p className="text-xs text-muted-foreground">Total Queued</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{healthData.queue.stats.totalProcessed}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{healthData.queue.stats.totalFailed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{healthData.queue.stats.queue.waiting}</p>
                <p className="text-xs text-muted-foreground">Waiting</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{healthData.queue.stats.queue.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
