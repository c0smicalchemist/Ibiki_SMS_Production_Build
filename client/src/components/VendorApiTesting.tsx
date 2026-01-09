import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle, XCircle, Clock } from "lucide-react";

interface VendorApiTest {
  vendor: string;
  endpoint: string;
  method: string;
  params?: any;
  response?: any;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
}

interface VendorConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  health: {
    healthy: boolean;
    reason?: string;
  };
  quota: number;
}

export default function VendorApiTesting() {
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<string>("textbelt");
  const [testPhone, setTestPhone] = useState<string>("");
  const [testMessage, setTestMessage] = useState<string>("Hello from Ibiki SMS testing!");
  const [messageId, setMessageId] = useState<string>("");

  // Fetch vendor information
  const { data: vendorData, isLoading: vendorsLoading } = useQuery({
    queryKey: ["/api/admin/sms-vendors"],
    staleTime: 30000,
  });

  // Test SMS sending
  const testSmsMutation = useMutation({
    mutationFn: async ({ vendor, recipient, message }: { vendor: string; recipient: string; message: string }) => {
      return await apiRequest("/api/admin/sms-test", {
        method: "POST",
        body: JSON.stringify({ vendor, recipient, message }),
      });
    },
    onSuccess: (data) => {
      if (data.result?.messageId) {
        setMessageId(data.result.messageId);
      }
      toast({ title: "Success", description: "Test SMS sent successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to send test SMS", variant: "destructive" });
    },
  });

  // Check delivery status
  const checkStatusMutation = useMutation({
    mutationFn: async ({ messageId, vendor }: { messageId: string; vendor: string }) => {
      return await apiRequest(`/api/admin/sms-status/${messageId}?vendor=${vendor}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Status checked successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to check status", variant: "destructive" });
    },
  });

  // Check quota
  const checkQuotaMutation = useMutation({
    mutationFn: async ({ vendor }: { vendor?: string }) => {
      const url = vendor ? `/api/admin/sms-quota?vendor=${vendor}` : "/api/admin/sms-quota";
      return await apiRequest(url);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Quota retrieved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to check quota", variant: "destructive" });
    },
  });

  const handleSendTest = () => {
    if (!testPhone || !testMessage) {
      toast({ title: "Error", description: "Please enter phone number and message", variant: "destructive" });
      return;
    }
    testSmsMutation.mutate({ vendor: selectedVendor, recipient: testPhone, message: testMessage });
  };

  const handleCheckStatus = () => {
    if (!messageId) {
      toast({ title: "Error", description: "Please enter a message ID", variant: "destructive" });
      return;
    }
    checkStatusMutation.mutate({ messageId, vendor: selectedVendor });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'text-green-600';
      case 'sent':
        return 'text-blue-600';
      case 'sending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMS Vendor API Testing</CardTitle>
          <CardDescription>Test SMS functionality across all vendors</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="send" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="send">Send SMS</TabsTrigger>
              <TabsTrigger value="status">Check Status</TabsTrigger>
              <TabsTrigger value="quota">Check Quota</TabsTrigger>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Vendor</Label>
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(vendorData as any)?.vendors?.map((vendor: VendorConfig) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name} {vendor.isActive && "(Active)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="+1234567890"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  placeholder="Enter your test message..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                onClick={handleSendTest} 
                disabled={testSmsMutation.isPending}
                className="w-full"
              >
                {testSmsMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Send Test SMS</>
                )}
              </Button>

              {testSmsMutation.data && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Test Result</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div><strong>Message ID:</strong> {testSmsMutation.data.result?.messageId}</div>
                      <div><strong>Status:</strong> {testSmsMutation.data.result?.success ? 'Sent' : 'Failed'}</div>
                      <div><strong>Vendor:</strong> {testSmsMutation.data.vendor}</div>
                      {testSmsMutation.data.result?.cost && (
                        <div><strong>Cost:</strong> ${testSmsMutation.data.result.cost}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Vendor</Label>
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(vendorData as any)?.vendors?.map((vendor: VendorConfig) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Message ID</Label>
                  <Input
                    placeholder="Enter message ID"
                    value={messageId}
                    onChange={(e) => setMessageId(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleCheckStatus} 
                disabled={checkStatusMutation.isPending}
                className="w-full"
              >
                {checkStatusMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking...</>
                ) : (
                  <><Clock className="h-4 w-4 mr-2" />Check Status</>
                )}
              </Button>

              {checkStatusMutation.data && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Delivery Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(checkStatusMutation.data.status.status)}>
                          {checkStatusMutation.data.status.status}
                        </Badge>
                        {checkStatusMutation.data.status.delivered ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {checkStatusMutation.data.status.error && (
                        <div className="text-sm text-red-600">
                          Error: {checkStatusMutation.data.status.error}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="quota" className="space-y-4">
              <Button 
                onClick={() => checkQuotaMutation.mutate({})} 
                disabled={checkQuotaMutation.isPending}
                className="w-full"
              >
                {checkQuotaMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading...</>
                ) : (
                  "Check All Quotas"
                )}
              </Button>

              {checkQuotaMutation.data && (
                <div className="space-y-4">
                  {checkQuotaMutation.data.quotas.map((quota: any) => (
                    <Card key={quota.vendor}>
                      <CardHeader>
                        <CardTitle className="text-sm">{quota.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Remaining Credits</span>
                          <Badge variant={quota?.quota?.success ? "default" : "destructive"}>
                            {typeof quota?.quota?.remaining === 'number' ? quota.quota.remaining : 'Unavailable'}
                          </Badge>
                        </div>
                        {quota?.quota?.total && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Total: {quota.quota.total}
                          </div>
                        )}
                        {quota?.quota?.error && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {String(quota.quota.error)}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="vendors" className="space-y-4">
              {vendorsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {(vendorData as any)?.vendors?.map((vendor: VendorConfig) => (
                    <Card key={vendor.id}>
                      <CardHeader>
                        <CardTitle className="text-sm">{vendor.name}</CardTitle>
                        <CardDescription>{vendor.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Status</span>
                            <Badge variant={vendor.health?.healthy ? "default" : "destructive"}>
                              {vendor.health?.healthy ? "Healthy" : vendor.health?.reason || "Unhealthy"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Active</span>
                            <Badge variant={vendor.isActive ? "default" : "secondary"}>
                              {vendor.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Quota</span>
                            <Badge>{vendor.quota || 0}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}