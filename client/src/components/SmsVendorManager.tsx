import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface SmsVendor {
  id: string;
  name: string;
  apiKey?: string;
  enabled: boolean;
  costPerSms: number;
  priority: number;
}

interface VendorConfig {
  activeVendor: string;
  vendors: SmsVendor[];
}

export default function SmsVendorManager() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [costPerSms, setCostPerSms] = useState<string>("");
  const [editingVendor, setEditingVendor] = useState<string | null>(null);

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ["/api/admin/sms-vendors"],
    staleTime: 0,
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: { vendorId: string; config: any }) => {
      return await apiRequest(`/api/admin/sms-vendors/${data.vendorId}/config`, {
        method: "POST",
        body: JSON.stringify(data.config),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sms-vendors"] });
      toast({ title: t("common.success"), description: "Vendor configuration updated" });
      setEditingVendor(null);
      setApiKeyInput("");
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error?.message || "Failed to update configuration", variant: "destructive" });
    },
  });

  const switchVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      return await apiRequest("/api/admin/sms-vendors/switch", {
        method: "POST",
        body: JSON.stringify({ vendorId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sms-vendors"] });
      toast({ title: t("common.success"), description: "SMS vendor switched successfully" });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error?.message || "Failed to switch vendor", variant: "destructive" });
    },
  });

  const testVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      return await apiRequest(`/api/admin/sms-vendors/${vendorId}/test`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: data?.success ? "Test Successful" : "Test Failed", 
        description: data?.message || "Vendor test completed",
        variant: data?.success ? undefined : "destructive"
      });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error?.message || "Vendor test failed", variant: "destructive" });
    },
  });

  const handleSwitchVendor = (vendorId: string) => {
    switchVendorMutation.mutate(vendorId);
  };

  const availableVendors = [
    { id: "textbelt", name: "TextBelt", description: "Free SMS service with limited features" },
    { id: "extremesms", name: "ExtremeSMS", description: "Premium SMS service with global coverage" },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SMS Vendor Configuration</CardTitle>
          <CardDescription>Loading vendor settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeVendor = (vendorData as any)?.activeVendor || 'textbelt';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMS Vendor Configuration</CardTitle>
          <CardDescription>Manage SMS providers and configure active vendor settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {(vendorData as any)?.vendors?.map((vendor: any) => (
              <Card key={vendor.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{vendor.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {availableVendors.find(v => v.id === vendor.id)?.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={vendor.isActive ? "default" : "secondary"}>
                      {vendor.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {vendor.health && (
                      <Badge variant={vendor.health.healthy ? "default" : "destructive"}>
                        {vendor.health.healthy ? "Healthy" : "Unhealthy"}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {editingVendor === vendor.id ? (
                    <div className="space-y-3 p-3 border rounded bg-muted/20">
                      <div className="space-y-1">
                        <Label htmlFor={`apikey-${vendor.id}`}>API Key</Label>
                        <Input 
                          id={`apikey-${vendor.id}`}
                          type="password" 
                          value={apiKeyInput} 
                          onChange={(e) => setApiKeyInput(e.target.value)} 
                          placeholder="Enter new API key"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => updateConfigMutation.mutate({ vendorId: vendor.id, config: { apiKey: apiKeyInput } })}
                          disabled={!apiKeyInput || updateConfigMutation.isPending}
                        >
                          {updateConfigMutation.isPending ? "Saving..." : "Save Key"}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setEditingVendor(null); setApiKeyInput(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        API Key: {vendor.config?.apiKey ? '••••' + vendor.config.apiKey.slice(-4) : 'Not configured'}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => { setEditingVendor(vendor.id); setApiKeyInput(""); }}
                      >
                        Edit Configuration
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={() => handleSwitchVendor(vendor.id)}
                    disabled={switchVendorMutation.isPending || vendor.isActive}
                    className="w-full"
                    variant={vendor.isActive ? "outline" : "default"}
                  >
                    {vendor.isActive ? "Currently Active" : "Switch to this vendor"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Current active vendor: <strong>{activeVendor}</strong>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}