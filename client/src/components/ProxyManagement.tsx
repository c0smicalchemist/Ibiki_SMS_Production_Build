import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, CheckCircle, XCircle, Globe, Server, Zap, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProxyInfo {
  id: string;
  address: string;
  port: number;
  city: string;
  country: string;
  valid: boolean;
  isActive: boolean;
}

interface ProxyStatus {
  webshare: {
    enabled: boolean;
    initialized: boolean;
    proxyCount: number;
    currentIndex: number;
    lastFetch: number;
    proxies: ProxyInfo[];
    source: string;
  };
  static: {
    enabled: boolean;
    url: string | null;
  };
  activeSource: 'webshare' | 'static' | 'none';
  lastUpdated: string;
}

export function ProxyManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch proxy status
  const { data: proxyStatus, isLoading, error, refetch } = useQuery<ProxyStatus>({
    queryKey: ['/api/admin/proxy-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Refresh proxies mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/proxy-refresh', { method: 'POST' });
    },
    onSuccess: (data) => {
      toast({
        title: "Proxies Refreshed",
        description: data.message || "Successfully refreshed proxy list from Webshare",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/proxy-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh proxies",
        variant: "destructive",
      });
    },
  });

  // Test proxy mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/proxy-test', { method: 'POST' });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Proxy Test Passed",
          description: `External IP: ${data.test.externalIp} (${data.test.latencyMs}ms)`,
        });
      } else {
        toast({
          title: "Proxy Test Failed",
          description: data.error || "Could not connect through proxy",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test proxy",
        variant: "destructive",
      });
    },
  });

  const formatLastFetch = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'webshare':
        return <Badge className="bg-green-500"><Globe className="w-3 h-3 mr-1" />Webshare (Rotating)</Badge>;
      case 'static':
        return <Badge className="bg-blue-500"><Server className="w-3 h-3 mr-1" />Static Proxy</Badge>;
      default:
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />No Proxy</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Proxy Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Proxy Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Failed to load proxy status
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Proxy Management
              </CardTitle>
              <CardDescription>
                Manage US proxy servers for TextBelt API routing
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active Source */}
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Active Source</div>
              <div className="flex items-center gap-2">
                {getSourceBadge(proxyStatus?.activeSource || 'none')}
              </div>
            </div>

            {/* Proxy Count */}
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Available Proxies</div>
              <div className="text-2xl font-bold">
                {proxyStatus?.webshare?.proxyCount || 0}
              </div>
            </div>

            {/* Last Updated */}
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Last Fetched</div>
              <div className="text-sm">
                {formatLastFetch(proxyStatus?.webshare?.lastFetch || 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webshare Proxies */}
      {proxyStatus?.webshare?.enabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Webshare Rotating Proxies
                </CardTitle>
                <CardDescription>
                  Automatically rotates between {proxyStatus.webshare.proxyCount} US proxies
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Test Active Proxy
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh from Webshare
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Country</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxyStatus.webshare.proxies.map((proxy) => (
                  <TableRow key={proxy.id} className={proxy.isActive ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                    <TableCell>
                      {proxy.isActive ? (
                        <Badge className="bg-green-500">
                          <Zap className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : proxy.valid ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          Invalid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{proxy.address}</TableCell>
                    <TableCell className="font-mono text-sm">{proxy.port}</TableCell>
                    <TableCell>{proxy.city}</TableCell>
                    <TableCell>
                      <span className="mr-1">🇺🇸</span>
                      {proxy.country}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Static Proxy Fallback */}
      {proxyStatus?.static?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-500" />
              Static Proxy (Fallback)
            </CardTitle>
            <CardDescription>
              Used when Webshare is unavailable
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Proxy URL</div>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {proxyStatus.static.url || 'Not configured'}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Proxy Warning */}
      {proxyStatus?.activeSource === 'none' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              No Proxy Configured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              TextBelt requires a US proxy for North America keys. Configure either:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground">
              <li><strong>WEBSHARE_API_KEY</strong> - For automatic proxy rotation</li>
              <li><strong>TEXTBELT_PROXY_URL</strong> - For a static proxy fallback</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
