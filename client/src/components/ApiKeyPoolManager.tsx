import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Plus,
  Trash2,
  TestTube2,
  RefreshCw,
  Key,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Copy
} from 'lucide-react';

interface ApiKey {
  id: string;
  vendor: string;
  name: string;
  apiKey: string;
  fromNumber?: string;
  isActive: boolean;
  priority: number;
  weight: number;
  quotaLimit: number;
  quotaUsed: number;
  rateLimit: number;
  consecutiveErrors: number;
  totalSent: number;
  totalFailed: number;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface PoolSummary {
  total: number;
  active: number;
  inactive: number;
  totalRateLimitPerSec: number;
  estimatedDailyCapacity: number;
  routeWindow: {
    isOpen: boolean;
    currentPST: string;
    currentEST: string;
    opensAt: string;
    closesAt: string;
  };
}

interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}

export function ApiKeyPoolManager() {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [summary, setSummary] = useState<PoolSummary | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  
  // Form state for adding new key
  const [newKey, setNewKey] = useState({
    vendor: 'textbelt',
    name: '',
    apiKey: '',
    fromNumber: '',
    priority: 0,
    weight: 100,
    quotaLimit: 0,
    rateLimit: 2.0
  });

  const fetchPoolData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [poolRes, queueRes] = await Promise.all([
        fetch('/api/admin/api-key-pool?showKeys=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/sms-queue/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      const poolData = await poolRes.json();
      const queueData = await queueRes.json();
      
      if (poolData.success) {
        setKeys(poolData.keys);
        setSummary(poolData.summary);
      }
      if (queueData.success) {
        setQueueStats(queueData.queue);
      }
    } catch (error) {
      console.error('Failed to fetch pool data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load API key pool data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPoolData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAddKey = async () => {
    if (!newKey.name || !newKey.apiKey) {
      toast({
        title: 'Error',
        description: 'Name and API Key are required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/api-key-pool', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newKey)
      });
      
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        });
        setAddDialogOpen(false);
        setNewKey({
          vendor: 'textbelt',
          name: '',
          apiKey: '',
          fromNumber: '',
          priority: 0,
          weight: 100,
          quotaLimit: 0,
          rateLimit: 2.0
        });
        fetchPoolData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add API key',
        variant: 'destructive'
      });
    }
  };

  const handleTestKey = async (keyId: string) => {
    setTestingKey(keyId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/api-key-pool/${keyId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success && data.isValid) {
        toast({
          title: 'Key Valid',
          description: data.message
        });
      } else {
        toast({
          title: 'Key Invalid',
          description: data.message || 'Key test failed',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to test API key',
        variant: 'destructive'
      });
    } finally {
      setTestingKey(null);
    }
  };

  const handleToggleActive = async (keyId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/api-key-pool/${keyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !isActive })
      });
      
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Updated',
          description: `API key ${!isActive ? 'activated' : 'deactivated'}`
        });
        fetchPoolData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update API key',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/api-key-pool/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Deleted',
          description: 'API key removed from pool'
        });
        fetchPoolData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive'
      });
    }
  };

  const handleResetQuotas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/api-key-pool/reset-quotas', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Quotas Reset',
          description: 'All API key quotas have been reset'
        });
        fetchPoolData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset quotas',
        variant: 'destructive'
      });
    }
  };

  const handleRefreshQuotas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/api-key-pool/refresh-quotas', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Quotas Refreshed',
          description: data.message || 'All API key quotas have been fetched from vendor'
        });
        fetchPoolData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh quotas',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Route Window Status */}
      {summary && (
        <Card className={summary.routeWindow.isOpen ? 'border-green-500' : 'border-red-500'}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <CardTitle className="text-lg">Route Window Status</CardTitle>
              </div>
              <Badge variant={summary.routeWindow.isOpen ? 'default' : 'destructive'}>
                {summary.routeWindow.isOpen ? 'OPEN' : 'CLOSED'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Current PST:</span>
                <span className="ml-2 font-mono">{summary.routeWindow.currentPST}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Current EST:</span>
                <span className="ml-2 font-mono">{summary.routeWindow.currentEST}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Opens:</span>
                <span className="ml-2">{summary.routeWindow.opensAt}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Closes:</span>
                <span className="ml-2">{summary.routeWindow.closesAt}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capacity Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total API Keys</CardDescription>
            <CardTitle className="text-2xl">{summary?.total || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {summary?.active || 0} active, {summary?.inactive || 0} inactive
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Throughput Capacity</CardDescription>
            <CardTitle className="text-2xl">{summary?.totalRateLimitPerSec || 0}/sec</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              ~{((summary?.totalRateLimitPerSec || 0) * 3600).toLocaleString()}/hour
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily Capacity (11hr)</CardDescription>
            <CardTitle className="text-2xl">{(summary?.estimatedDailyCapacity || 0).toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              During route window
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Queue Status</CardDescription>
            <CardTitle className="text-2xl">{queueStats?.pending || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {queueStats?.processing || 0} processing, {queueStats?.sent || 0} sent
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Scaling Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Capacity Scaling Visualization
          </CardTitle>
          <CardDescription>
            Shows messaging capacity based on loaded API keys during route window (08:00 PST - 21:00 EST, ~10 hours)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Capacity Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Current Capacity: {(summary?.estimatedDailyCapacity || 0).toLocaleString()} SMS/day</span>
              <span className="text-muted-foreground">Target: 500,000 SMS/day</span>
            </div>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(100, ((summary?.estimatedDailyCapacity || 0) / 500000) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0</span>
              <span>100k</span>
              <span>200k</span>
              <span>300k</span>
              <span>400k</span>
              <span>500k</span>
            </div>
          </div>

          {/* Per-Key Breakdown */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium mb-3">Capacity Breakdown by API Keys</h4>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7].map((keyNum) => {
                const keyCapacity = keyNum * 2 * 3600 * 10; // 2 SMS/sec × 3600 sec × 10 hours
                const isActive = keyNum <= (summary?.active || 0);
                const isCurrent = keyNum === (summary?.active || 0);
                return (
                  <div key={keyNum} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isActive ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                    } ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                      {keyNum}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className={isActive ? 'font-medium' : 'text-muted-foreground'}>
                          {keyNum} API Key{keyNum > 1 ? 's' : ''}
                        </span>
                        <span className={isActive ? 'font-mono text-green-600' : 'font-mono text-muted-foreground'}>
                          {keyCapacity.toLocaleString()} SMS/day
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 mt-1">
                        <div 
                          className={`h-full rounded-full transition-all ${isActive ? 'bg-green-500' : 'bg-muted-foreground/20'}`}
                          style={{ width: `${(keyCapacity / 504000) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-20 text-right">
                      {(keyNum * 2).toFixed(1)}/sec
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current hourly capacity:</span>
                <span className="font-mono font-medium">{((summary?.totalRateLimitPerSec || 0) * 3600).toLocaleString()} SMS/hr</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Keys needed for 350k/day:</span>
                <span className="font-mono">5 keys</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Keys needed for 500k/day:</span>
                <span className="font-mono">7 keys</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Pool Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API / Number Pool
              </CardTitle>
              <CardDescription>
                Manage API keys and phone numbers for high-volume SMS sending with number rotation
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefreshQuotas} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Quotas
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetQuotas}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Daily
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add API Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add API Key to Pool</DialogTitle>
                    <DialogDescription>
                      Add a new vendor API key for load balancing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Vendor</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newKey.vendor}
                        onChange={(e) => setNewKey({ ...newKey, vendor: e.target.value })}
                      >
                        <option value="textbelt">TextBelt</option>
                        <option value="extremesms">ExtremeSMS</option>
                        <option value="anveo">Anveo</option>
                      </select>
                    </div>
                    {newKey.vendor === 'anveo' && (
                      <div className="grid gap-2">
                        <Label>From Number (optional - for reference only)</Label>
                        <Input
                          placeholder="e.g., 19046409006"
                          value={newKey.fromNumber}
                          onChange={(e) => setNewKey({ ...newKey, fromNumber: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Optional: Enter Anveo phone number without + prefix. Phone numbers should be managed in the Number Pool tab.</p>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label>Name / Label</Label>
                      <Input
                        placeholder="e.g., TextBelt Key #1"
                        value={newKey.name}
                        onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter API key"
                        value={newKey.apiKey}
                        onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Priority (lower = first)</Label>
                        <Input
                          type="number"
                          value={newKey.priority}
                          onChange={(e) => setNewKey({ ...newKey, priority: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Rate Limit (SMS/sec)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={newKey.rateLimit}
                          onChange={(e) => setNewKey({ ...newKey, rateLimit: parseFloat(e.target.value) || 2.0 })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddKey}>Add Key</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No API keys in pool. Add your first key to enable high-volume SMS.
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{key.vendor}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <span className="max-w-[200px] truncate" title={visibleKeys.has(key.id) ? key.apiKey : undefined}>
                          {visibleKeys.has(key.id) ? key.apiKey : `****${key.apiKey?.slice(-4) || ''}`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            const newVisible = new Set(visibleKeys);
                            if (newVisible.has(key.id)) {
                              newVisible.delete(key.id);
                            } else {
                              newVisible.add(key.id);
                            }
                            setVisibleKeys(newVisible);
                          }}
                        >
                          {visibleKeys.has(key.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(key.apiKey);
                            toast({
                              title: 'Copied',
                              description: 'API key copied to clipboard'
                            });
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={key.isActive}
                          onCheckedChange={() => handleToggleActive(key.id, key.isActive)}
                        />
                        {key.consecutiveErrors > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {key.consecutiveErrors} errors
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.vendor === 'anveo' ? (
                        <span className="text-xs text-purple-600 font-medium">Pay-per-use</span>
                      ) : (
                        <span className={`font-mono ${(key.quotaLimit || 0) > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                          {(key.quotaLimit || 0).toLocaleString()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{key.rateLimit}/s</TableCell>
                    <TableCell className="text-green-600">{(key.totalSent || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">{(key.totalFailed || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleTimeString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTestKey(key.id)}
                          disabled={testingKey === key.id}
                        >
                          {testingKey === key.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scaling Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Scaling Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>Route Window:</strong> Messages can only be sent between{' '}
            <span className="font-mono">08:00 PST</span> and{' '}
            <span className="font-mono">21:00 EST</span> (~10 hours).
          </p>
          <p>
            <strong>Rate Limit:</strong> Each TextBelt API key supports ~2 SMS/second.
          </p>
          <p>
            <strong>Capacity Calculation:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>1 key = 2/sec × 3600 sec × 10 hours = ~72,000 SMS/day</li>
            <li>For 350,000 SMS/day: Need ~5 keys</li>
            <li>For 500,000 SMS/day: Need ~7 keys</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            The system uses weighted round-robin to distribute load across all active keys.
            Keys with errors are automatically deprioritized.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ApiKeyPoolManager;
