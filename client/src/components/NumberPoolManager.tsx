import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Phone, Plus, Trash2, Edit, RefreshCw, AlertTriangle, Ban, FileText, Archive, Download } from 'lucide-react';

interface AnveoNumber {
  id: number;
  phone_number: string;
  vendor_account_id: number;
  api_key_id?: string;
  status: 'active' | 'warming' | 'suspended' | 'deleted';
  daily_limit: number;
  hourly_limit: number;
  sent_today: number;
  sent_this_hour: number;
  sent_lifetime: number;
  complaints: number;
  last_complaint_at?: string;
  error_count_today: number;
  success_count_today: number;
  worker_url: string;
  warming_start_date?: string;
  warming_day: number;
  last_used_at?: string;
  created_at: string;
}

interface PoolStats {
  active_count: number;
  warming_count: number;
  suspended_count: number;
  total_daily_capacity: number;
  total_sent_today: number;
  total_complaints: number;
  total_opt_outs: number;
}

interface ComplianceReport {
  complaints: Array<{
    phone_number: string;
    status: string;
    complaints: number;
    sent_lifetime: number;
    complaint_rate: number;
    last_complaint_at: string;
  }>;
  optOuts: Array<{
    phone_number: string;
    opted_out_at: string;
    source: string;
    opt_out_message: string;
  }>;
  summary: {
    total_complaints: number;
    total_opt_outs: number;
    numbers_with_complaints: number;
    suspended_numbers: number;
  };
}

interface ApiKey {
  id: string;
  name: string;
  vendor: string;
  apiKey: string;
  fromNumber?: string;
  isActive: boolean;
}

export function NumberPoolManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<AnveoNumber | null>(null);
  const [activeTab, setActiveTab] = useState('pool');
  
  // Form states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [workerUrl, setWorkerUrl] = useState('https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook');
  const [status, setStatus] = useState<'active' | 'warming' | 'suspended'>('warming');
  const [dailyLimit, setDailyLimit] = useState('100');
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string>('');

  // Fetch API keys
  const { data: apiKeysData } = useQuery({
    queryKey: ['/api/admin/api-key-pool'],
    queryFn: async () => {
      const res = await apiRequest('/api/admin/api-key-pool?showKeys=true');
      return res as { success: boolean; keys: ApiKey[] };
    }
  });

  const anveoApiKeys = apiKeysData?.keys?.filter(k => k.vendor === 'anveo' && k.isActive) || [];

  // Fetch active numbers (pool view)
  const { data: numbersData, isLoading } = useQuery({
    queryKey: ['/api/admin/number-pool'],
    queryFn: async () => {
      const res = await apiRequest('/api/admin/number-pool');
      return res as { numbers: AnveoNumber[]; stats: PoolStats };
    }
  });

  // Fetch archived/suspended numbers
  const { data: archivedData, isLoading: archiveLoading } = useQuery({
    queryKey: ['/api/admin/number-pool', 'archived'],
    queryFn: async () => {
      const res = await apiRequest('/api/admin/number-pool?status=archived');
      return res as { numbers: AnveoNumber[] };
    },
    enabled: activeTab === 'archive'
  });

  // Fetch compliance report
  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ['/api/admin/number-pool/compliance-report'],
    queryFn: async () => {
      const res = await apiRequest('/api/admin/number-pool/compliance-report');
      return res as ComplianceReport;
    },
    enabled: activeTab === 'compliance'
  });

  // Add number mutation
  const addNumberMutation = useMutation({
    mutationFn: async (data: { phone_number: string; worker_url: string; status: string; daily_limit: number; api_key_id?: string }) => {
      return await apiRequest('/api/admin/number-pool', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Number added to pool' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool'] });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to add number', variant: 'destructive' });
    }
  });

  // Update number mutation
  const updateNumberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AnveoNumber> }) => {
      return await apiRequest(`/api/admin/number-pool/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Number updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool'] });
      setIsEditDialogOpen(false);
      setSelectedNumber(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to update number', variant: 'destructive' });
    }
  });

  // Delete number mutation
  const deleteNumberMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/admin/number-pool/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Number deleted from pool' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to delete number', variant: 'destructive' });
    }
  });

  // Reset daily counters
  const resetCountersMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/exec-sql', {
        method: 'POST',
        body: JSON.stringify({ query: 'SELECT reset_daily_counters()' })
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Daily counters reset, warming numbers promoted' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to reset counters', variant: 'destructive' });
    }
  });

  // Remove opt-out mutation
  const removeOptOutMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest(`/api/admin/number-pool/opt-out/${encodeURIComponent(phoneNumber)}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Opt-out removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool/compliance-report'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to remove opt-out', variant: 'destructive' });
    }
  });

  // Purge complaints mutation
  const purgeComplaintsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/number-pool/purge-complaints', {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      toast({ title: 'Success', description: data?.message || 'Complaints purged' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool/compliance-report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to purge complaints', variant: 'destructive' });
    }
  });

  // Purge opt-outs mutation
  const purgeOptOutsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/number-pool/purge-opt-outs', {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      toast({ title: 'Success', description: data?.message || 'Opt-outs purged' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool/compliance-report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to purge opt-outs', variant: 'destructive' });
    }
  });

  // Download CSV helper
  const downloadComplianceCSV = async (type: 'all' | 'complaints' | 'opt-outs' = 'all') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/number-pool/compliance-report.csv?type=${type}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to download');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Downloaded', description: 'Compliance report CSV downloaded' });
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to download CSV', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setPhoneNumber('');
    setWorkerUrl('https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook');
    setStatus('warming');
    setDailyLimit('100');
    setSelectedApiKeyId('');
  };

  const handleEdit = (number: AnveoNumber) => {
    setSelectedNumber(number);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedNumber) return;
    
    updateNumberMutation.mutate({
      id: selectedNumber.id,
      data: {
        status: selectedNumber.status,
        daily_limit: selectedNumber.daily_limit,
        worker_url: selectedNumber.worker_url
      }
    });
  };

  const numbers = numbersData?.numbers || [];
  const stats = numbersData?.stats;
  const totalCapacity = stats?.total_daily_capacity || numbers.reduce((sum, n) => sum + n.daily_limit, 0);
  const totalSent = stats?.total_sent_today || numbers.reduce((sum, n) => sum + n.sent_today, 0);
  const activeCount = stats?.active_count || numbers.filter(n => n.status === 'active').length;
  const warmingCount = stats?.warming_count || numbers.filter(n => n.status === 'warming').length;
  const suspendedCount = stats?.suspended_count || 0;
  const totalComplaints = stats?.total_complaints || numbers.reduce((sum, n) => sum + n.complaints, 0);
  const totalOptOuts = stats?.total_opt_outs || 0;

  return (
    <Card className="border border-purple-200 dark:border-purple-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-purple-600" />
              Number Pool Management
            </CardTitle>
            <CardDescription>Manage Anveo phone numbers for multi-account rotation</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/number-pool'] })}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Number
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Number to Pool</DialogTitle>
                  <DialogDescription>
                    Add a new Anveo phone number to the rotation pool
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+19144080890"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Include the + prefix (e.g., +19144080890)
                    </p>
                  </div>
                  <div>
                    <Label>Cloudflare Worker URL</Label>
                    <Select value={workerUrl} onValueChange={setWorkerUrl}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook">
                          Worker 1 (sms-proxy-1)
                        </SelectItem>
                        <SelectItem value="https://sms-proxy-2.c0smicalch3mist.workers.dev/webhook">
                          Worker 2 (sms-proxy-2)
                        </SelectItem>
                        <SelectItem value="https://sms-proxy-3.c0smicalch3mist.workers.dev/webhook">
                          Worker 3 (sms-proxy-3)
                        </SelectItem>
                        <SelectItem value="https://sms-proxy-4.c0smicalch3mist.workers.dev/webhook">
                          Worker 4 (sms-proxy-4)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warming">Warming (Day 1-21)</SelectItem>
                        <SelectItem value="active">Active (Full capacity)</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Daily Limit</Label>
                    <Input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label>Anveo API Key</Label>
                    <Select value={selectedApiKeyId} onValueChange={setSelectedApiKeyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select API Key" />
                      </SelectTrigger>
                      <SelectContent>
                        {anveoApiKeys.length === 0 ? (
                          <SelectItem value="none" disabled>No active Anveo API keys</SelectItem>
                        ) : (
                          anveoApiKeys.map(key => (
                            <SelectItem key={key.id} value={key.id}>
                              {key.name} {key.fromNumber && `(${key.fromNumber})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Link this number to a specific Anveo API key
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // Ensure phone number has + prefix (E.164 format)
                      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
                      addNumberMutation.mutate({
                        phone_number: formattedPhone,
                        worker_url: workerUrl,
                        status,
                        daily_limit: parseInt(dailyLimit),
                        api_key_id: selectedApiKeyId || undefined
                      });
                    }}
                    disabled={!phoneNumber || addNumberMutation.isPending}
                  >
                    {addNumberMutation.isPending ? 'Adding...' : 'Add Number'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pool Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Total Numbers</div>
            <div className="text-2xl font-bold">{numbers.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Warming</div>
            <div className="text-2xl font-bold text-yellow-600">{warmingCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Suspended</div>
            <div className="text-2xl font-bold text-red-600">{suspendedCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Daily Capacity</div>
            <div className="text-2xl font-bold">{totalCapacity}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Sent Today</div>
            <div className="text-2xl font-bold">{totalSent}/{totalCapacity}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              Complaints
            </div>
            <div className="text-2xl font-bold text-orange-600">{totalComplaints}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Ban className="h-3 w-3 text-red-500" />
              Opt-Outs
            </div>
            <div className="text-2xl font-bold text-red-600">{totalOptOuts}</div>
          </div>
        </div>

        {/* Tabs for Pool, Archive, Compliance */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pool" className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Active Pool
            </TabsTrigger>
            <TabsTrigger value="archive" className="flex items-center gap-1">
              <Archive className="h-4 w-4" />
              Archive ({suspendedCount})
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Compliance
            </TabsTrigger>
          </TabsList>

          {/* Active Pool Tab */}
          <TabsContent value="pool" className="space-y-4">
            {/* Reset Counters Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetCountersMutation.mutate()}
                disabled={resetCountersMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                {resetCountersMutation.isPending ? 'Resetting...' : 'Reset Daily Counters'}
              </Button>
            </div>

            {/* Numbers Table */}
            <div className="rounded-md border">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading numbers...</div>
              ) : numbers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No numbers in pool. Add your first number to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent / Limit</TableHead>
                      <TableHead>Complaints</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numbers.map((number) => {
                      const usagePercent = number.daily_limit > 0
                        ? Math.round((number.sent_today / number.daily_limit) * 100)
                        : 0;
                      
                      return (
                        <TableRow key={number.id}>
                          <TableCell className="font-mono">{number.phone_number}</TableCell>
                          <TableCell className="text-sm">
                            {number.api_key_id ? (
                              <span className="text-muted-foreground">
                                {anveoApiKeys.find(k => k.id === number.api_key_id)?.name || number.api_key_id}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Not linked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                number.status === 'active' ? 'default' :
                                number.status === 'warming' ? 'secondary' :
                                'destructive'
                              }
                            >
                              {number.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {number.sent_today} / {number.daily_limit}
                          </TableCell>
                          <TableCell>
                            {number.complaints > 0 ? (
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <AlertTriangle className="h-3 w-3" />
                                {number.complaints}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    usagePercent >= 90 ? 'bg-red-500' :
                                    usagePercent >= 70 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{usagePercent}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {number.worker_url.includes('proxy-1') ? 'Worker 1' :
                             number.worker_url.includes('proxy-2') ? 'Worker 2' :
                             number.worker_url.includes('proxy-3') ? 'Worker 3' :
                             number.worker_url.includes('proxy-4') ? 'Worker 4' :
                             'Unknown'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleEdit(number);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (confirm(`Delete ${number.phone_number}?`)) {
                                    deleteNumberMutation.mutate(number.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* Archive Tab */}
          <TabsContent value="archive" className="space-y-4">
            <div className="rounded-md border">
              {archiveLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading archived numbers...</div>
              ) : (archivedData?.numbers || []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No suspended or deleted numbers.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Complaints</TableHead>
                      <TableHead>Lifetime Sent</TableHead>
                      <TableHead>Last Complaint</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(archivedData?.numbers || []).map((number) => (
                      <TableRow key={number.id}>
                        <TableCell className="font-mono">{number.phone_number}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{number.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" />
                            {number.complaints}
                          </Badge>
                        </TableCell>
                        <TableCell>{number.sent_lifetime || 0}</TableCell>
                        <TableCell className="text-xs">
                          {number.last_complaint_at ? new Date(number.last_complaint_at).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Reactivate ${number.phone_number}?`)) {
                                  updateNumberMutation.mutate({
                                    id: number.id,
                                    data: { status: 'warming' }
                                  });
                                }
                              }}
                            >
                              Reactivate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Permanently delete ${number.phone_number}?`)) {
                                  deleteNumberMutation.mutate(number.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-4">
            {complianceLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading compliance report...</div>
            ) : (
              <>
                {/* Summary + Action Buttons */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Complaints</div>
                      <div className="text-2xl font-bold text-orange-600">{complianceData?.summary?.total_complaints || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total Opt-Outs</div>
                      <div className="text-2xl font-bold text-red-600">{complianceData?.summary?.total_opt_outs || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Numbers with Complaints</div>
                      <div className="text-2xl font-bold">{complianceData?.summary?.numbers_with_complaints || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Suspended Numbers</div>
                      <div className="text-2xl font-bold text-red-600">{complianceData?.summary?.suspended_numbers || 0}</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadComplianceCSV('all')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download CSV
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to purge ALL complaint records? This cannot be undone.')) {
                          purgeComplaintsMutation.mutate();
                        }
                      }}
                      disabled={purgeComplaintsMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {purgeComplaintsMutation.isPending ? 'Purging...' : 'Purge Complaints'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to purge ALL opt-out records? This will allow sending to previously opted-out numbers. Cannot be undone.')) {
                          purgeOptOutsMutation.mutate();
                        }
                      }}
                      disabled={purgeOptOutsMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {purgeOptOutsMutation.isPending ? 'Purging...' : 'Purge Opt-Outs'}
                    </Button>
                  </div>
                </div>

                {/* Complaints Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Numbers with Complaints
                  </h3>
                  <div className="rounded-md border">
                    {(complianceData?.complaints || []).length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">No complaints recorded</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Phone Number</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Complaints</TableHead>
                            <TableHead>Lifetime Sent</TableHead>
                            <TableHead>Complaint Rate</TableHead>
                            <TableHead>Last Complaint</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(complianceData?.complaints || []).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono">{item.phone_number}</TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'suspended' ? 'destructive' : 'secondary'}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive">{item.complaints}</Badge>
                              </TableCell>
                              <TableCell>{item.sent_lifetime}</TableCell>
                              <TableCell>
                                <Badge variant={item.complaint_rate > 2 ? 'destructive' : 'secondary'}>
                                  {item.complaint_rate}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {item.last_complaint_at ? new Date(item.last_complaint_at).toLocaleString() : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>

                {/* Opt-Outs Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-500" />
                    Opt-Out Registry (STOP Keywords)
                  </h3>
                  <div className="rounded-md border">
                    {(complianceData?.optOuts || []).length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">No opt-outs recorded</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Phone Number</TableHead>
                            <TableHead>Opted Out At</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(complianceData?.optOuts || []).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono">{item.phone_number}</TableCell>
                              <TableCell className="text-xs">
                                {new Date(item.opted_out_at).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{item.source}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Remove opt-out for ${item.phone_number}? This will allow sending to this number again.`)) {
                                      removeOptOutMutation.mutate(item.phone_number);
                                    }
                                  }}
                                  disabled={removeOptOutMutation.isPending}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        {selectedNumber && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit {selectedNumber.phone_number}</DialogTitle>
                <DialogDescription>
                  Update number configuration
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={selectedNumber.status}
                    onValueChange={(v: any) => setSelectedNumber({ ...selectedNumber, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warming">Warming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Daily Limit</Label>
                  <Input
                    type="number"
                    value={selectedNumber.daily_limit}
                    onChange={(e) => setSelectedNumber({
                      ...selectedNumber,
                      daily_limit: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
                <div>
                  <Label>Worker URL</Label>
                  <Select
                    value={selectedNumber.worker_url}
                    onValueChange={(v) => setSelectedNumber({ ...selectedNumber, worker_url: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook">
                        Worker 1 (sms-proxy-1)
                      </SelectItem>
                      <SelectItem value="https://sms-proxy-2.c0smicalch3mist.workers.dev/webhook">
                        Worker 2 (sms-proxy-2)
                      </SelectItem>
                      <SelectItem value="https://sms-proxy-3.c0smicalch3mist.workers.dev/webhook">
                        Worker 3 (sms-proxy-3)
                      </SelectItem>
                      <SelectItem value="https://sms-proxy-4.c0smicalch3mist.workers.dev/webhook">
                        Worker 4 (sms-proxy-4)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Anveo API Key</Label>
                  <Select
                    value={selectedNumber.api_key_id || 'NONE'}
                    onValueChange={(v) => setSelectedNumber({ ...selectedNumber, api_key_id: v === 'NONE' ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select API Key" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">(None)</SelectItem>
                      {anveoApiKeys.map(key => (
                        <SelectItem key={key.id} value={key.id}>
                          {key.name} {key.fromNumber && `(${key.fromNumber})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Link this number to a specific Anveo API key
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updateNumberMutation.isPending}
                >
                  {updateNumberMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
