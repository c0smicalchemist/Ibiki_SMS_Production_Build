import { Link, useLocation } from "wouter";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { LogOut, RefreshCcw, Send, Inbox as InboxIcon, Users, List, HelpCircle, Mail } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import logoUrl from "@assets/Yubin_Dash_NOBG_1763476645991.png";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export function DashboardHeader() {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [routesOpen, setRoutesOpen] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(0);

  const { data: profile } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
  }>({ queryKey: ['/api/client/profile'] });

  const { data: balanceData } = useQuery<{ success: boolean; balance: number; currency: string }>({ 
    queryKey: ['/api/web/account/balance'],
    staleTime: 0,
  });

  const { data: supportEmailData } = useQuery<{ email: string }>({
    queryKey: ['/api/support-email'],
    staleTime: 30000,
  });

  // For admins, show vendor-specific credits; for others, show generic credits
  // This ensures header matches the credits shown in client management
  const displayCredits = typeof balanceData?.balance === 'number' ? balanceData.balance : null;

  const { data: configData } = useQuery<{ config: Record<string, string> }>({
    queryKey: ['/api/admin/config'],
    staleTime: 30000,
  });
  const routeOverrideEnabled = configData?.config?.routes_override_allow_single === 'true';

  const handleLogout = () => {
    localStorage.removeItem('token');
    setLocation('/');
  };

  const handleForceRefresh = async () => {
    setRefreshing(true);
    const keys = [
      ['/api/client/profile'],
      ['/api/client/messages'],
      ['/api/client/inbox'],
      ['/api/v2/sms/messages'],
      ['/api/v2/sms/inbox'],
      ['/api/message-status-stats'],
      ['/api/admin/clients'],
      ['/api/admin/stats'],
      ['/api/admin/recent-activity'],
      ['/api/admin/error-logs'],
      ['/api/admin/config'],
      ['/api/web/inbox'],
    ];
    const selectedClientId = localStorage.getItem('selectedClientId');
    const isAdminMode = localStorage.getItem('isAdminMode') === 'true';
    const effectiveUserId = !isAdminMode && selectedClientId ? selectedClientId : undefined;
    const contactsKeys = [
      ['/api/contacts', effectiveUserId],
      ['/api/contact-groups', effectiveUserId],
      ['/api/contacts/sync-stats', effectiveUserId],
    ];
    for (const key of keys) {
      await queryClient.invalidateQueries({ queryKey: key as any });
      await queryClient.refetchQueries({ queryKey: key as any });
    }
    for (const key of contactsKeys) {
      await queryClient.invalidateQueries({ queryKey: key as any });
      await queryClient.refetchQueries({ queryKey: key as any });
    }
    await queryClient.invalidateQueries({ predicate: (q: any) => String(q.queryKey?.[0] || '').startsWith('/api/') });
    await queryClient.refetchQueries({ predicate: (q: any) => String(q.queryKey?.[0] || '').startsWith('/api/') });
    setRefreshing(false);
    toast({ title: t('common.success'), description: 'Refresh successful' });
  };

  const handleRetrieveInbox = async () => {
    try {
      setRetrieving(true);
      const token = localStorage.getItem('token');
      await fetch('/api/web/inbox/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/web/inbox'] });
      await queryClient.refetchQueries({ queryKey: ['/api/web/inbox'] });
      toast({ title: t('common.success'), description: t('inbox.retrieveSuccess') });
    } catch (e) {
      toast({ title: t('common.error'), description: t('inbox.retrieveFailed'), variant: 'destructive' });
    } finally {
      setRetrieving(false);
    }
  };

  function formatHMS(s: number) {
    if (isNaN(s)) return "00:00:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }

  function getHourInZone(tz: string) {
    try {
      const d = new Date();
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const parts = fmt.format(d).split(':');
      return { hour: parseInt(parts[0]), minute: parseInt(parts[1]) };
    } catch { return { hour: 0, minute: 0 }; }
  }

  function getHMSInZone(tz: string) {
    try {
      const d = new Date();
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const parts = fmt.format(d).split(':');
      return { hour: parseInt(parts[0]), minute: parseInt(parts[1]), second: parseInt(parts[2]) };
    } catch { return { hour: 0, minute: 0, second: 0 }; }
  }

  function secondsUntil(tz: string, targetHour: number, targetMinute: number) {
    try {
      const now = getHMSInZone(tz);
      const nowSec = now.hour * 3600 + now.minute * 60 + now.second;
      const targetSec = targetHour * 3600 + targetMinute * 60;
      let diff = targetSec - nowSec;
      if (diff <= 0) diff += 24 * 3600;
      return diff;
    } catch { return 0; }
  }

  useEffect(() => {
    const calc = () => {
      try {
        // Route hours: 8:00 AM PST (GMT-8) to 6:00 PM PST (9:00 PM EST)
        // We use PST only to simplify - 6 PM PST = 9 PM EST
        const pst = getHourInZone('America/Los_Angeles'); // GMT-8
        const pstHour = pst.hour;
        
        // Open from 8:00 AM PST (hour >= 8) until 6:00 PM PST (hour < 18)
        const open = pstHour >= 8 && pstHour < 18;
        setRoutesOpen(open);
        
        // Countdown: if open, countdown to 6 PM PST (close); if closed, countdown to 8 AM PST (open)
        const next = open ? secondsUntil('America/Los_Angeles', 18, 0) : secondsUntil('America/Los_Angeles', 8, 0);
        setCountdown(next);
      } catch (e) {
        console.error("Timer error:", e);
      }
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <img src={logoUrl} alt="Yubin Dash" className="h-10 w-auto cursor-pointer" />
          </Link>
          {(() => {
            const path = String(location);
            const page = path.startsWith('/send-sms') ? 'send' : path.startsWith('/inbox') ? 'inbox' : path.startsWith('/contacts') ? 'contacts' : path.startsWith('/message-history') ? 'history' : '';
            if (!page) return null;
            const LabelIcon = page === 'send' ? Send : (page === 'inbox' ? InboxIcon : (page === 'contacts' ? Users : List));
            const label = page === 'send' ? t('sendSms.title') : (page === 'inbox' ? t('inbox.title') : (page === 'contacts' ? t('contacts.title') : t('messageHistory.title')));
            return (
              <div className="flex items-center gap-2">
                <LabelIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xl md:text-3xl font-bold text-muted-foreground">{label}</span>
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 whitespace-nowrap" data-testid="routes-status">
            {routesOpen ? (
              <div className="flex items-center gap-3">
                <span className="text-xs md:text-sm font-semibold text-green-600">Route Status: Open</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{t('status.closesIn') || 'Closes in'}: {formatHMS(countdown)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className={`text-xs md:text-sm font-semibold ${routeOverrideEnabled ? 'text-amber-600' : 'text-red-600'}`}>
                  {routeOverrideEnabled ? 'Route Status: Overridden' : 'Route Status: Closed'}
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className={`${routeOverrideEnabled ? 'text-amber-600 hover:text-amber-700' : 'text-red-600 hover:text-red-700'} h-6 w-6`} aria-label="Routes Status help">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Route Status Information</DialogTitle>
                      <DialogDescription className="space-y-3">
                        <p><strong>Route Hours:</strong> Open from 8:00 AM PST to 6:00 PM PST (9:00 PM EST).</p>
                        {routeOverrideEnabled ? (
                          <p className="text-amber-600"><strong>Route Override Active:</strong> Admin/Supervisor single SMS allowed outside route hours.</p>
                        ) : (
                          <>
                            <p><strong>When Routes Are Closed:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li>❌ Cannot send SMS to NEW customers</li>
                              <li>✅ CAN reply to customers who have already replied to your initial SMS</li>
                              <li>Admin/Supervisor can enable Route Override to allow single SMS sends</li>
                            </ul>
                          </>
                        )}
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
                <span className="text-xs text-muted-foreground hidden sm:inline">{t('status.opensIn') || 'Opens in'}: {formatHMS(countdown)}</span>
              </div>
            )}
          </div>
          {profile?.user?.name && (
            <Badge variant="secondary" data-testid="badge-username">
              {profile.user.name}
              {displayCredits !== null ? ` · Credits ${displayCredits.toLocaleString()}` : ''}
            </Badge>
          )}
          {profile?.user?.role && (
            <Badge variant="outline" data-testid="badge-role">
              {profile.user.role === 'admin' ? 'Admin' : profile.user.role === 'supervisor' ? 'Supervisor' : 'User'}
            </Badge>
          )}
          <ThemeToggle />
          <LanguageToggle />
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Contact Support</DialogTitle>
                <DialogDescription className="space-y-3">
                  <p>Need help? Reach out to our support team:</p>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <Mail className="h-4 w-4" />
                    <a 
                      href={`mailto:${supportEmailData?.email || 'ibiki_dash@proton.me'}`}
                      className="font-mono text-sm text-blue-600 hover:underline"
                    >
                      {supportEmailData?.email || 'ibiki_dash@proton.me'}
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Our team will respond to your inquiry as soon as possible.
                  </p>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          {/* Retrieve Inbox action moved into Inbox page header */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceRefresh}
            data-testid="button-refresh"
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          {profile?.user?.role === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const r = await fetch('/api/admin/auth/invalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } });
                  if (!r.ok) throw new Error('Failed');
                  toast({ title: t('common.success'), description: 'All sessions invalidated' });
                } catch {
                  toast({ title: t('common.error'), description: 'Failed to invalidate tokens', variant: 'destructive' });
                }
              }}
            >
              Force Refresh Tokens
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </div>
      <div className="px-6 pb-2">
        <div className="text-xs text-muted-foreground"></div>
      </div>
    </header>
  );
}
