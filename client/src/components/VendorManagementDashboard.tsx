import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, AlertCircle, RefreshCw, Settings, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface VendorConfig {
  id: string;
  name: string;
  type: 'textbelt' | 'extremesms' | 'twilio' | 'vonage' | 'custom';
  enabled: boolean;
  priority: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  config: Record<string, any>;
}

interface VendorState {
  vendorId: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  lastHealthCheck?: string;
  lastError?: string;
  consecutiveFailures: number;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageResponseTime: number;
  creditsRemaining?: number;
  rateLimitRemaining?: number;
}

interface VendorManagementConfig {
  activeVendorId: string;
  vendors: VendorConfig[];
  switchingConfig: {
    strategy: 'manual' | 'round_robin' | 'priority' | 'health_based' | 'cost_based';
    fallbackEnabled: boolean;
    healthCheckInterval: number;
    failureThreshold: number;
    recoveryTime: number;
    costOptimization: boolean;
    regionBased: boolean;
  };
  vendorStates: Record<string, VendorState>;
}

const VENDOR_TYPES = [
  { value: 'textbelt', label: 'TextBelt', description: 'Free SMS service with limited features' },
  { value: 'extremesms', label: 'ExtremeSMS', description: 'Premium SMS service with global coverage' },
  { value: 'twilio', label: 'Twilio', description: 'Enterprise-grade SMS platform' },
  { value: 'vonage', label: 'Vonage', description: 'Global communications platform' },
  { value: 'custom', label: 'Custom', description: 'Custom SMS provider integration' },
];

export function VendorManagementDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<VendorConfig | null>(null);
  const [showAddVendor, setShowAddVendor] = useState(false);

  // Fetch vendor configuration
  const { data: vendorConfig, isLoading, error } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await apiRequest('/api/vendors');
      return response.data as VendorManagementConfig;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Switch vendor mutation
  const switchVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      return await apiRequest('/api/vendors/switch', {
        method: 'POST',
        body: JSON.stringify({ vendorId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: 'Success',
        description: 'Vendor switched successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to switch vendor',
        variant: 'destructive',
      });
    },
  });

  // Update vendor mutation
  const updateVendorMutation = useMutation({
    mutationFn: async (vendor: VendorConfig) => {
      return await apiRequest('/api/vendors', {
        method: 'POST',
        body: JSON.stringify({ vendor }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: 'Success',
        description: 'Vendor configuration updated',
      });
      setEditingVendor(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update vendor',
        variant: 'destructive',
      });
    },
  });

  // Remove vendor mutation
  const removeVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      return await apiRequest(`/api/vendors/${vendorId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: 'Success',
        description: 'Vendor removed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove vendor',
        variant: 'destructive',
      });
    },
  });

  // Health check mutation
  const healthCheckMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      return await apiRequest(`/api/vendors/${vendorId}/health-check`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });

  // Update switching config mutation
  const updateSwitchingConfigMutation = useMutation({
    mutationFn: async (switchingConfig: any) => {
      return await apiRequest('/api/vendors/switching-config', {
        method: 'PUT',
        body: JSON.stringify({ switchingConfig }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: 'Success',
        description: 'Switching configuration updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update switching configuration',
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      case 'maintenance':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getVendorTypeLabel = (type: string) => {
    return VENDOR_TYPES.find(v => v.value === type)?.label || type;
  };

  const handleSwitchVendor = (vendorId: string) => {
    switchVendorMutation.mutate(vendorId);
  };

  const handleSaveVendor = (vendor: VendorConfig) => {
    updateVendorMutation.mutate(vendor);
  };

  const handleRemoveVendor = (vendorId: string) => {
    if (window.confirm('Are you sure you want to remove this vendor?')) {
      removeVendorMutation.mutate(vendorId);
    }
  };

  const handleHealthCheck = (vendorId: string) => {
    healthCheckMutation.mutate(vendorId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load vendor configuration</AlertDescription>
      </Alert>
    );
  }

  const activeVendor = vendorConfig?.vendors.find(v => v.id === vendorConfig.activeVendorId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMS Vendor Management</CardTitle>
          <CardDescription>
            Manage SMS providers and configure active vendor settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Current Active Vendor</h3>
              <p className="text-sm text-muted-foreground">
                {activeVendor?.name || 'Not configured'}
              </p>
            </div>
            <Badge className={getStatusColor(vendorConfig?.vendorStates[activeVendor?.id || '']?.status || 'inactive')}>
              {vendorConfig?.vendorStates[activeVendor?.id || '']?.status || 'Inactive'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="vendors" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Available Vendors</h3>
            <Button onClick={() => setShowAddVendor(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </div>

          <div className="grid gap-4">
            {vendorConfig?.vendors.map((vendor) => {
              const state = vendorConfig.vendorStates[vendor.id];
              const stats = state ? {
                successRate: state.totalMessages > 0 ? (state.successfulMessages / state.totalMessages) * 100 : 0,
                failureRate: state.totalMessages > 0 ? (state.failedMessages / state.totalMessages) * 100 : 0,
                averageResponseTime: state.averageResponseTime,
                consecutiveFailures: state.consecutiveFailures
              } : null;
              
              return (
                <Card key={vendor.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{vendor.name}</h4>
                        <Badge variant={vendor.enabled ? "default" : "secondary"}>
                          {vendor.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge className={getStatusColor(state?.status || 'inactive')}>
                          {state?.status || 'Unknown'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getVendorTypeLabel(vendor.type)} - Priority {vendor.priority}
                      </p>
                      {state && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <div>Messages: {state.totalMessages} (Success: {state.successfulMessages}, Failed: {state.failedMessages})</div>
                          <div>Avg Response: {state.averageResponseTime}ms</div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {vendor.id !== vendorConfig.activeVendorId && (
                        <Button
                          size="sm"
                          onClick={() => handleSwitchVendor(vendor.id)}
                          disabled={switchVendorMutation.isPending}
                        >
                          Switch
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingVendor(vendor)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleHealthCheck(vendor.id)}
                        disabled={healthCheckMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveVendor(vendor.id)}
                        disabled={vendor.id === vendorConfig.activeVendorId}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Switching Configuration</CardTitle>
              <CardDescription>Configure automatic vendor switching behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="strategy">Strategy</Label>
                  <Select
                    value={vendorConfig?.switchingConfig.strategy}
                    onValueChange={(value) => updateSwitchingConfigMutation.mutate({ strategy: value as any })}
                  >
                    <SelectTrigger id="strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="priority">Priority-based</SelectItem>
                      <SelectItem value="health_based">Health-based</SelectItem>
                      <SelectItem value="cost_based">Cost-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={vendorConfig?.switchingConfig.fallbackEnabled}
                    onCheckedChange={(checked) => updateSwitchingConfigMutation.mutate({ fallbackEnabled: checked })}
                  />
                  <Label>Enable Fallback</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="healthCheckInterval">Health Check Interval (ms)</Label>
                  <Input
                    id="healthCheckInterval"
                    type="number"
                    value={vendorConfig?.switchingConfig.healthCheckInterval}
                    onChange={(e) => updateSwitchingConfigMutation.mutate({ healthCheckInterval: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="failureThreshold">Failure Threshold</Label>
                  <Input
                    id="failureThreshold"
                    type="number"
                    value={vendorConfig?.switchingConfig.failureThreshold}
                    onChange={(e) => updateSwitchingConfigMutation.mutate({ failureThreshold: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Health Monitoring</CardTitle>
              <CardDescription>Real-time vendor status and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vendorConfig?.vendors.map((vendor) => {
                  const state = vendorConfig.vendorStates[vendor.id];
                  const stats = state ? {
                    successRate: state.totalMessages > 0 ? (state.successfulMessages / state.totalMessages) * 100 : 0,
                    failureRate: state.totalMessages > 0 ? (state.failedMessages / state.totalMessages) * 100 : 0,
                    averageResponseTime: state.averageResponseTime,
                    consecutiveFailures: state.consecutiveFailures
                  } : null;
                  
                  return (
                    <div key={vendor.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{vendor.name}</h4>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(state?.status || 'inactive')}>
                            {state?.status || 'Unknown'}
                          </Badge>
                          {state?.lastHealthCheck && (
                            <span className="text-sm text-muted-foreground">
                              Last check: {new Date(state.lastHealthCheck).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {stats && (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Success Rate:</span>
                            <div className="font-semibold">{stats.successRate.toFixed(1)}%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Response:</span>
                            <div className="font-semibold">{stats.averageResponseTime}ms</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Failures:</span>
                            <div className="font-semibold">{stats.consecutiveFailures}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Vendor: {editingVendor.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editingVendor.name}
                    onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editingVendor.type}
                    onValueChange={(value) => setEditingVendor({ ...editingVendor, type: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VENDOR_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={editingVendor.priority}
                    onChange={(e) => setEditingVendor({ ...editingVendor, priority: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingVendor.enabled}
                    onCheckedChange={(checked) => setEditingVendor({ ...editingVendor, enabled: checked })}
                  />
                  <Label>Enabled</Label>
                </div>
              </div>

              {/* Configuration based on vendor type */}
              <div className="space-y-4">
                <h4 className="font-semibold">Configuration</h4>
                {renderVendorConfig(editingVendor, setEditingVendor)}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleSaveVendor(editingVendor)} disabled={updateVendorMutation.isPending}>
                  {updateVendorMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setEditingVendor(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function renderVendorConfig(vendor: VendorConfig, setVendor: (vendor: VendorConfig) => void) {
  const updateConfig = (key: string, value: any) => {
    setVendor({
      ...vendor,
      config: {
        ...vendor.config,
        [key]: value,
      },
    });
  };

  switch (vendor.type) {
    case 'textbelt':
      return (
        <div className="space-y-2">
          <div>
            <Label>API Key</Label>
            <Input
              value={vendor.config.apiKey || ''}
              onChange={(e) => updateConfig('apiKey', e.target.value)}
              placeholder="Your TextBelt API key"
            />
          </div>
          <div>
            <Label>Base URL</Label>
            <Input
              value={vendor.config.baseUrl || 'https://textbelt.com'}
              onChange={(e) => updateConfig('baseUrl', e.target.value)}
            />
          </div>
        </div>
      );
    case 'extremesms':
      return (
        <div className="space-y-2">
          <div>
            <Label>API Key</Label>
            <Input
              value={vendor.config.apiKey || ''}
              onChange={(e) => updateConfig('apiKey', e.target.value)}
              placeholder="Your ExtremeSMS API key"
            />
          </div>
          <div>
            <Label>Sender ID</Label>
            <Input
              value={vendor.config.senderId || ''}
              onChange={(e) => updateConfig('senderId', e.target.value)}
              placeholder="Your sender ID"
            />
          </div>
          <div>
            <Label>Route</Label>
            <Select
              value={vendor.config.route || '4'}
              onValueChange={(value) => updateConfig('route', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Route 1</SelectItem>
                <SelectItem value="2">Route 2</SelectItem>
                <SelectItem value="3">Route 3</SelectItem>
                <SelectItem value="4">Route 4</SelectItem>
                <SelectItem value="5">Route 5</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    case 'twilio':
      return (
        <div className="space-y-2">
          <div>
            <Label>Account SID</Label>
            <Input
              value={vendor.config.accountSid || ''}
              onChange={(e) => updateConfig('accountSid', e.target.value)}
              placeholder="Your Twilio Account SID"
            />
          </div>
          <div>
            <Label>Auth Token</Label>
            <Input
              value={vendor.config.authToken || ''}
              onChange={(e) => updateConfig('authToken', e.target.value)}
              placeholder="Your Twilio Auth Token"
              type="password"
            />
          </div>
          <div>
            <Label>From Number</Label>
            <Input
              value={vendor.config.fromNumber || ''}
              onChange={(e) => updateConfig('fromNumber', e.target.value)}
              placeholder="Your Twilio phone number"
            />
          </div>
        </div>
      );
    case 'vonage':
      return (
        <div className="space-y-2">
          <div>
            <Label>API Key</Label>
            <Input
              value={vendor.config.apiKey || ''}
              onChange={(e) => updateConfig('apiKey', e.target.value)}
              placeholder="Your Vonage API key"
            />
          </div>
          <div>
            <Label>API Secret</Label>
            <Input
              value={vendor.config.apiSecret || ''}
              onChange={(e) => updateConfig('apiSecret', e.target.value)}
              placeholder="Your Vonage API secret"
              type="password"
            />
          </div>
          <div>
            <Label>From</Label>
            <Input
              value={vendor.config.from || ''}
              onChange={(e) => updateConfig('from', e.target.value)}
              placeholder="Your Vonage phone number or name"
            />
          </div>
        </div>
      );
    case 'custom':
      return (
        <div className="space-y-2">
          <div>
            <Label>Base URL</Label>
            <Input
              value={vendor.config.baseUrl || ''}
              onChange={(e) => updateConfig('baseUrl', e.target.value)}
              placeholder="https://api.custom-sms.com"
            />
          </div>
          <div>
            <Label>Authentication Type</Label>
            <Select
              value={vendor.config.authType || 'none'}
              onValueChange={(value) => updateConfig('authType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="apikey">API Key</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    default:
      return null;
  }
}