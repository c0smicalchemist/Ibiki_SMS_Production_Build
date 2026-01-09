import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, Shield, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface Client {
  id: string;
  name: string;
  email: string;
  credits: string;
  activeVendorId?: string;
  activeVendorName?: string;
}

interface AdminModeBarProps {
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
  isAdminMode: boolean;
  onAdminModeChange: (isAdminMode: boolean) => void;
  isSupervisor?: boolean;
  backHref?: string;
}

export function AdminModeBar({ 
  selectedClientId, 
  onClientChange, 
  isAdminMode, 
  onAdminModeChange,
  isSupervisor = false,
  backHref
}: AdminModeBarProps) {
  const { t } = useLanguage();
  const { data: clientsData, isLoading } = useQuery<{ 
    success: boolean; 
    clients: Client[];
  }>({
    queryKey: ['/api/admin/clients']
  });

  const clients = clientsData?.clients || [];

  // Auto-select first client if none selected and not in admin mode
  useEffect(() => {
    if (!isAdminMode && !selectedClientId && clients.length > 0) {
      onClientChange(clients[0].id);
    }
  }, [clients, selectedClientId, onClientChange, isAdminMode]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-muted/30 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-8 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (clients.length === 0) {
    return null;
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const modeLabel = isSupervisor ? t('sendSms.supervisorDirectMode') : 'Direct Mode';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-lg border bg-muted/30">
      {/* Back Button */}
      {backHref && (
        <>
          <Link href={backHref}>
            <Button size="icon" data-testid="button-back" className="h-8 w-8 bg-blue-600 text-white hover:bg-blue-700">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </Link>
          <div className="hidden sm:block w-px h-6 bg-border" />
        </>
      )}

      {/* Client Selector */}
      <div className="flex items-center gap-2 min-w-0">
        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground whitespace-nowrap">Acting as:</span>
        
        {isAdminMode ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
            <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {isSupervisor ? 'Supervisor' : 'Admin'}
            </span>
          </div>
        ) : (
          <Select 
            value={selectedClientId ?? ''}
            onValueChange={(val) => onClientChange(val === '' ? null : val)}
          >
            <SelectTrigger 
              className="h-8 w-auto min-w-[180px] max-w-[280px] text-sm"
              data-testid="select-client"
            >
              <SelectValue placeholder="Select client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem 
                  key={client.id} 
                  value={client.id}
                  data-testid={`option-client-${client.id}`}
                  textValue={client.name}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{client.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ${parseFloat(client.credits).toFixed(2)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Vertical Divider */}
      <div className="hidden sm:block w-px h-6 bg-border" />

      {/* Direct Mode Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="admin-mode-bar"
          checked={isAdminMode}
          onCheckedChange={onAdminModeChange}
          data-testid="admin-mode-toggle"
          className="data-[state=checked]:bg-blue-600"
        />
        <label 
          htmlFor="admin-mode-bar" 
          className="text-sm cursor-pointer select-none whitespace-nowrap"
        >
          {modeLabel}
        </label>
      </div>

      {/* Context hint */}
      {selectedClient && !isAdminMode && (
        <>
          <div className="hidden lg:block w-px h-6 bg-border" />
          <span className="hidden lg:inline text-xs text-muted-foreground">
            Credits & logs apply to {selectedClient.name}
          </span>
        </>
      )}
    </div>
  );
}
