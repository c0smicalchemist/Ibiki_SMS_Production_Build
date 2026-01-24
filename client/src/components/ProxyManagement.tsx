import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, CheckCircle, XCircle, Globe, Server, Zap, AlertTriangle, Link, Save, Shield, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";

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
  
  // Webhook proxy state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookUrlEdited, setWebhookUrlEdited] = useState(false);
  
  // Webhook proxy domains (multiple) state
  const [webhookDomains, setWebhookDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');

  // Fetch proxy status
  const { data: proxyStatus, isLoading, error, refetch } = useQuery<ProxyStatus>({
    queryKey: ['/api/admin/proxy-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch webhook URL config
  const { data: webhookConfig } = useQuery<{ url: string; source: string; endpoint: string }>({
    queryKey: ['/api/admin/webhook-url'],
  });
  
  // Fetch webhook proxy domains (multiple)
  const { data: webhookDomainsData } = useQuery<{ domains: string[]; count: number; rotation: string }>({
    queryKey: ['/api/admin/webhook-proxy-domains'],
  });

  // Update webhook URL state when config loads
  useEffect(() => {
    if (webhookConfig?.url && !webhookUrlEdited) {
      setWebhookUrl(webhookConfig.url);
    }
  }, [webhookConfig?.url, webhookUrlEdited]);
  
  // Update webhook domains state when data loads
  useEffect(() => {
    if (webhookDomainsData?.domains) {
      setWebhookDomains(webhookDomainsData.domains);
    }
  }, [webhookDomainsData?.domains]);

  // Save webhook URL mutation
  const saveWebhookUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      return await apiRequest('/api/admin/webhook-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "Webhook Domain Saved",
        description: "TextBelt replies will now be sent to the new domain",
      });
      setWebhookUrlEdited(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/webhook-url'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save webhook domain",
        variant: "destructive",
      });
    },
  });
  
  // Save webhook proxy domains (multiple) mutation
  const saveWebhookDomainsMutation = useMutation({
    mutationFn: async (domains: string[]) => {
      return await apiRequest('/api/admin/webhook-proxy-domains', {
        method: 'POST',
        body: JSON.stringify({ domains }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Webhook Domains Saved",
        description: `${data.count} domain(s) configured. Rotation ${data.rotation}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/webhook-proxy-domains'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save webhook domains",
        variant: "destructive",
      });
    },
  });
  
  // Add domain to list
  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    
    const updatedDomains = [...webhookDomains, newDomain.trim()];
    setWebhookDomains(updatedDomains);
    setNewDomain('');
    saveWebhookDomainsMutation.mutate(updatedDomains);
  };
  
  // Remove domain from list
  const handleRemoveDomain = (index: number) => {
    const updatedDomains = webhookDomains.filter((_, i) => i !== index);
    setWebhookDomains(updatedDomains);
    saveWebhookDomainsMutation.mutate(updatedDomains);
  };

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
      {/* Webhook Proxy Domain */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-500" />
                Webhook Proxy Domain
              </CardTitle>
              <CardDescription>
                Protect your server by routing TextBelt replies through a proxy domain
              </CardDescription>
            </div>
            {webhookConfig?.source && (
              <Badge variant={webhookConfig.source === 'database' ? 'default' : 'outline'}>
                {webhookConfig.source === 'database' ? 'Custom' : 'Default'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://sms-proxy-1.workers.dev"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setWebhookUrlEdited(true);
              }}
              className="font-mono text-sm"
            />
            <Button
              onClick={() => saveWebhookUrlMutation.mutate(webhookUrl)}
              disabled={saveWebhookUrlMutation.isPending || !webhookUrlEdited}
            >
              {saveWebhookUrlMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-2">Save</span>
            </Button>
          </div>
          
          {webhookConfig?.endpoint && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Full Webhook Endpoint</div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono flex-1 break-all">{webhookConfig.endpoint}</code>
                <a 
                  href={webhookConfig.endpoint.replace('/api/webhook/textbelt', '/health')} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}

          <div className="p-3 border border-dashed rounded-lg text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">💡 How to use:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create a Cloudflare Worker at <a href="https://dash.cloudflare.com" target="_blank" className="text-primary hover:underline">dash.cloudflare.com</a></li>
              <li>Deploy the proxy code from <code className="bg-muted px-1 rounded">proxy-worker/worker.js</code></li>
              <li>Enter your worker URL above (e.g., <code className="bg-muted px-1 rounded">https://sms-proxy-1.workers.dev</code>)</li>
              <li>If banned, create a new worker and update the URL here</li>
            </ol>
          </div>
        </CardContent>
      </Card>
      
      {/* Webhook Proxy Domains (Multiple) - Rotation for Ban Protection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                Webhook Proxy Domains (Rotation)
              </CardTitle>
              <CardDescription>
                Configure multiple domains for randomized rotation - prevents bans
              </CardDescription>
            </div>
            {webhookDomainsData && (
              <Badge variant={webhookDomainsData.rotation === 'enabled' ? 'default' : 'outline'}>
                {webhookDomainsData.rotation === 'enabled' ? (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Rotation Active ({webhookDomainsData.count})
                  </>
                ) : (
                  <>Single Domain</>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Domain Input */}
          <div className="flex gap-2">
            <Input
              placeholder="https://sms-proxy-2.workers.dev"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
              className="font-mono text-sm"
            />
            <Button
              onClick={handleAddDomain}
              disabled={!newDomain.trim() || saveWebhookDomainsMutation.isPending}
            >
              {saveWebhookDomainsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Add</span>
            </Button>
          </div>
          
          {/* Domain List */}
          {webhookDomains.length > 0 ? (
            <div className="border rounded-lg divide-y">
              {webhookDomains.map((domain, index) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <div className="flex-1 flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {index + 1}
                    </Badge>
                    <code className="text-sm font-mono flex-1">{domain}</code>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(100 / webhookDomains.length)}% traffic
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDomain(index)}
                    disabled={saveWebhookDomainsMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 border border-dashed rounded-lg text-center text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No domains configured yet</p>
              <p className="text-xs mt-1">Add domains above to enable rotation</p>
            </div>
          )}

          <div className="p-3 border border-dashed rounded-lg text-sm text-muted-foreground space-y-3">
            <div>
              <p className="font-medium text-foreground mb-2">🛡️ How Rotation Protects You:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Each SMS randomly picks one domain from your list</li>
                <li>TextBelt sees different domains - harder to detect patterns</li>
                <li>If one domain gets banned, others keep working</li>
                <li>All domains point to the SAME Ibiki server (just different "front doors")</li>
              </ul>
            </div>
            
            <div className="pt-2 border-t">
              <p className="font-medium text-foreground mb-2">✅ Users & Supervisors Not Affected:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Replies flow: TextBelt → Webhook Domain → Ibiki DB → User Inbox</li>
                <li>The webhook domain is transparent to end users</li>
                <li>All messages stored in Ibiki database as source of truth</li>
                <li>Supervisors see all messages normally in their Inbox</li>
              </ul>
            </div>
            
            <div className="pt-2 border-t">
              <p className="font-medium text-foreground mb-2">💡 Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Create multiple Cloudflare Workers (domain1, domain2, domain3...)</li>
                <li>Deploy the same proxy code to each worker</li>
                <li>Add all worker URLs here</li>
                <li>System will automatically rotate between them</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

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
