import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Trash2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox as InboxIcon, MessageSquare, ArrowLeft, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { AdminModeBar } from "@/components/AdminModeBar";
import { DashboardHeader } from "@/components/DashboardHeader";
import ConversationInline from "@/components/ConversationInline";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface IncomingMessage {
  id: string;
  from: string;
  firstname: string | null;
  lastname: string | null;
  business: string | null;
  message: string;
  status: string;
  receiver: string;
  timestamp: string;
  messageId: string;
  isRead: boolean;
}

export default function Inbox() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [showConversationDialog, setShowConversationDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    return localStorage.getItem('selectedClientId');
  });
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return localStorage.getItem('isAdminMode') === 'true';
  });
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Store selected client in localStorage
  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem('selectedClientId', selectedClientId);
      setIsAdminMode(false);
    } else {
      localStorage.removeItem('selectedClientId');
    }
  }, [selectedClientId]);

  // Store admin mode in localStorage
  useEffect(() => {
    localStorage.setItem('isAdminMode', isAdminMode.toString());
  }, [isAdminMode]);

  // Fetch current user profile
  const { data: profile } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
  }>({
    queryKey: ['/api/client/profile']
  });

  const isAdmin = profile?.user?.role === 'admin' || profile?.user?.email === 'ibiki_dash@proton.me';
  const isSupervisor = profile?.user?.role === 'supervisor';
  const effectiveUserId = (isAdmin || isSupervisor) && !isAdminMode && selectedClientId ? selectedClientId : undefined;

  // Fetch inbox messages
  const { data: inboxData, isLoading, isFetching } = useQuery({
    queryKey: [showDeleted ? "/api/web/inbox/deleted" : "/api/web/inbox", effectiveUserId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const base = showDeleted ? '/api/web/inbox/deleted' : '/api/web/inbox';
      const url = effectiveUserId 
        ? `${base}?userId=${effectiveUserId}`
        : base;
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(t('inbox.error.fetchFailed'));
      return response.json();
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: 2,
    staleTime: 30000,
    gcTime: 600000,
    placeholderData: (prev) => prev,
  });

  const messages: IncomingMessage[] = (inboxData as any)?.messages || [];
  const deletedCount: number = (inboxData as any)?.count || 0;

  // Favorites
  const { data: favoritesData } = useQuery<{ success: boolean; favorites: string[] }>({
    queryKey: ['/api/web/inbox/favorites', effectiveUserId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = effectiveUserId ? `/api/web/inbox/favorites?userId=${effectiveUserId}` : '/api/web/inbox/favorites';
      const resp = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error('Failed to fetch favorites');
      return resp.json();
    }
  });
  const favorites = favoritesData?.favorites || [];
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ phoneNumber, favorite }: { phoneNumber: string; favorite: boolean }) => {
      const token = localStorage.getItem('token');
      const body: any = { phoneNumber, favorite };
      if (effectiveUserId) body.userId = effectiveUserId;
      const resp = await fetch('/api/web/inbox/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('Failed to update favorite');
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/web/inbox/favorites', effectiveUserId] as any, data);
    }
  });

  const [viewFavorites, setViewFavorites] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const { data: logsData } = useQuery<{ success: boolean; messages: Array<any> }>({
    queryKey: [
      (isAdmin ? '/api/admin/messages' : (isSupervisor ? '/api/supervisor/messages' : '/api/client/messages')),
      effectiveUserId
    ],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      let url = '/api/client/messages';
      if (isAdmin) {
        url = effectiveUserId ? `/api/admin/messages?userId=${effectiveUserId}` : '/api/admin/messages';
      } else if (isSupervisor) {
        url = effectiveUserId ? `/api/supervisor/messages?userId=${effectiveUserId}` : '/api/supervisor/messages';
      }
      const headers: Record<string,string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      try {
        const resp = await fetch(url, { headers, cache: 'no-store' });
        if (!resp.ok) throw new Error('Failed to fetch logs');
        return await resp.json();
      } catch (e) {
        let altUrl = url;
        if (isSupervisor && effectiveUserId) {
          altUrl = `/api/admin/messages?userId=${effectiveUserId}`;
        }
        const resp2 = await fetch(altUrl, { headers, cache: 'no-store' });
        if (!resp2.ok) throw new Error('Failed to fetch logs');
        return await resp2.json();
      }
    },
    enabled: !!localStorage.getItem('token'),
    retry: false,
    refetchInterval: 10000,
  });
  const lastOutByPhone: Record<string, number> = {};
  (logsData?.messages || []).forEach((l: any) => {
    const recips = Array.isArray(l?.recipients) ? l.recipients : (l?.recipient ? [l.recipient] : []);
    const ts = new Date(l?.createdAt).getTime();
    recips.forEach((r: any) => {
      const k = String(r);
      if (!lastOutByPhone[k] || ts > lastOutByPhone[k]) lastOutByPhone[k] = ts;
    });
  });

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('view') === 'favorites') setViewFavorites(true);
    } catch {}
  }, []);
  const seedExample = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = effectiveUserId || profile?.user?.id;
      await fetch('/api/admin/seed-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId })
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
    } catch {}
  };

  const seedExampleForAdmin = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = profile?.user?.id;
      await fetch('/api/admin/seed-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId })
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", undefined] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", undefined] });
    } catch {}
  };

  const deleteExample = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = effectiveUserId || profile?.user?.id;
      await fetch('/api/admin/seed-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId })
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
    } catch {}
  };

  const handleRetrieveInbox = async () => {
    try {
      const token = localStorage.getItem('token');
      const body: any = {};
      if (effectiveUserId) body.userId = effectiveUserId;
      const resp = await fetch('/api/web/inbox/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('Failed to retrieve inbox');
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      toast({ title: t('common.success'), description: t('inbox.retrieveSuccess') });
    } catch {}
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/web/inbox/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, userId: effectiveUserId })
      });
      if (!resp.ok) throw new Error('Failed to delete message');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
    }
  });

  const deletePermanentMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/web/inbox/delete-permanent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, userId: effectiveUserId })
      });
      if (!resp.ok) throw new Error('Failed to permanently delete message');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
    }
  });


  const handleOpenConversation = (phoneNumber: string) => {
    setSelectedPhoneNumber(phoneNumber);
    setShowConversationDialog(true);
  };

  const handleCloseConversation = () => {
    setShowConversationDialog(false);
    setSelectedPhoneNumber(null);
  };

  // Group messages by contact phone (sender or receiver)
  const groupedMessages = messages.reduce((acc: any, msg) => {
    const key = (msg.from || msg.receiver);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(msg);
    return acc;
  }, {});

  // Count unique conversations (filtered by favorites if needed)
  const conversationCount = Object.entries(groupedMessages).filter(([phone, msgs]: any[]) => {
    const isFav = favorites.includes(String(phone));
    if (viewFavorites && !isFav) return false;
    return true;
  }).length;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="mx-[2cm] p-6 space-y-6">
        {(isAdmin || isSupervisor) ? (
          <AdminModeBar
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
            isAdminMode={isAdminMode}
            onAdminModeChange={setIsAdminMode}
            isSupervisor={isSupervisor}
            backHref={isAdmin ? "/admin" : "/adminsup"}
          />
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button size="icon" data-testid="button-back" className="bg-blue-600 text-white hover:bg-blue-700 font-bold">
                <ArrowLeft className="h-5 w-5" strokeWidth={3} />
              </Button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
          {isLoading && !messages.length ? (
            <Card className={viewFavorites ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 ring-1 ring-yellow-300' : ''}>
              <CardContent className="p-6 text-center">
                {t('inbox.loading')}
              </CardContent>
            </Card>
          ) : messages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <InboxIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">{t('inbox.noMessages')}</h3>
                <p className="text-muted-foreground">
                  {t('inbox.noMessagesDesc')}
                </p>
                {isAdmin && (
                  <div className="mt-6 flex items-center gap-2 justify-center">
                    <Button onClick={seedExample} data-testid="button-seed-example-client">Add Example (Selected Client)</Button>
                    <Button variant="outline" onClick={seedExampleForAdmin} data-testid="button-seed-example-admin">Add Example (Admin)</Button>
                    <Button variant="outline-destructive" onClick={deleteExample} data-testid="button-delete-example">Delete Example</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <CardHeader className={viewFavorites ? 'py-2 px-4 border-t-4 border-yellow-400' : 'py-2 px-4'}>
                  <div className="flex items-center gap-2 flex-nowrap">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('inbox.search')} className="w-full" />
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                        <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">{conversationCount.toLocaleString()}</span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{t('inbox.indicator.all')}</span>
                      </div>
                      <UnreadIndicator userId={effectiveUserId} isAdmin={isAdmin} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
                    {!showDeleted && (
                      <Button
                        size="sm"
                        onClick={() => setViewFavorites(v => !v)}
                        className={`h-7 px-3 ${viewFavorites ? 'bg-yellow-100 text-yellow-800 border-yellow-400 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' : ''}`}
                        variant="outline"
                      >
                        <Star className={`h-3.5 w-3.5 ${viewFavorites ? 'fill-yellow-500 text-yellow-600' : ''}`} />
                        <span className="ml-1">{t('inbox.favorites')}</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setShowDeleted(d => !d)}
                      className={`h-7 px-3 ${showDeleted ? 'bg-red-100 text-red-700 border-red-400 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' : ''}`}
                      variant="outline"
                    >
                      {showDeleted ? (
                        <>
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span className="ml-1">Back to Inbox</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="ml-1">Deleted</span>
                        </>
                      )}
                    </Button>
                    {showDeleted && (
                      <Button
                        size="sm"
                        variant="outline-destructive"
                        className="h-7"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            const body: any = {};
                            if (effectiveUserId) body.userId = effectiveUserId;
                            await fetch('/api/web/inbox/purge-deleted', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify(body)
                            });
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
                          } catch {}
                        }}
                      >
                        Purge All
                      </Button>
                    )}
                    <div className="ml-auto">
                      <select 
                        className="h-7 px-2 text-xs border rounded-md bg-background hover:bg-muted/50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring" 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value as any)}
                      >
                        <option value="newest">{t('inbox.sort.mostRecent')}</option>
                        <option value="oldest">{t('inbox.sort.oldest')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="h-[72vh] overflow-y-auto">
                    {Object.entries(groupedMessages)
                      .filter(([phone, msgs]: any[]) => {
                        const q = search.trim().toLowerCase();
                        const latest = (msgs as any[])[(msgs as any[]).length - 1] || {};
                        const text = `${String(phone)} ${(latest.message||'')}`.toLowerCase();
                        const isFav = favorites.includes(String(phone));
                        if (viewFavorites && !isFav) return false;
                        return !q || text.includes(q);
                      })
                      .sort((a: any[], b: any[]) => {
                        const favA = favorites.includes(String(a[0])) ? 1 : 0;
                        const favB = favorites.includes(String(b[0])) ? 1 : 0;
                        if (favA !== favB) return favB - favA;
                        const msgsA = a[1] as any[];
                        const msgsB = b[1] as any[];
                        const ta = new Date(((msgsA.slice().sort((x:any,y:any)=>new Date((y.timestamp||y.createdAt)).getTime()-new Date((x.timestamp||x.createdAt)).getTime()))[0]||{}).timestamp || ((msgsA[0]||{}).createdAt||0)).getTime();
                        const tb = new Date(((msgsB.slice().sort((x:any,y:any)=>new Date((y.timestamp||y.createdAt)).getTime()-new Date((x.timestamp||x.createdAt)).getTime()))[0]||{}).timestamp || ((msgsB[0]||{}).createdAt||0)).getTime();
                        return sortOrder === 'newest' ? (tb - ta) : (ta - tb);
                      })
                      .map(([phone, msgs]: any[], index: number) => {
                        const latest = (msgs as any[]).slice().sort((a: any, b: any) => new Date((b.timestamp||b.createdAt)).getTime() - new Date((a.timestamp||a.createdAt)).getTime())[0];
                        
                        // Find the most recent outbound message to this phone number
                        const outboundToPhone = (logsData?.messages || [])
                          .filter((log: any) => {
                            const recips = Array.isArray(log?.recipients) ? log.recipients : (log?.recipient ? [log.recipient] : []);
                            return recips.some((r: any) => String(r) === String(phone));
                          })
                          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                        
                        // Determine which message is more recent (inbound or outbound)
                        const latestInboundTime = new Date((latest as any).timestamp || (latest as any).createdAt).getTime();
                        const latestOutboundTime = outboundToPhone ? new Date(outboundToPhone.createdAt).getTime() : 0;
                        
                        const mostRecentMessage = latestOutboundTime > latestInboundTime && outboundToPhone
                          ? { message: outboundToPhone.message, timestamp: outboundToPhone.createdAt, isOutbound: true }
                          : { message: (latest as any).message, timestamp: (latest as any).timestamp || (latest as any).createdAt, isOutbound: false };
                        
                        const dt = new Date(mostRecentMessage.timestamp);
                        const hasUnread = (msgs as any[]).some((m: any) => !m.isRead);
                        const isBlacklisted = (msgs as any[]).some((m: any) => /blacklist|blocked/i.test(String(m.status||'')) || !!m.matchedBlockWord);
                        const isFavorite = favorites.includes(String(phone));
                        const lastInboundTs = new Date(((latest as any).timestamp || (latest as any).createdAt)).getTime();
                        const pendingReply = lastInboundTs > (lastOutByPhone[String(phone)] || 0);
                        return (
                          <div 
                            key={phone} 
                            className={`
                              px-3 py-2.5 cursor-pointer transition-colors border-b border-border/50
                              ${selectedPhoneNumber === phone 
                                ? 'bg-primary/10 border-l-2 border-l-primary' 
                                : index % 2 === 0 
                                  ? 'bg-background hover:bg-muted/50' 
                                  : 'bg-muted/20 hover:bg-muted/50'
                              }
                            `} 
                            onClick={() => setSelectedPhoneNumber(phone)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {isFavorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                                <span className="font-mono font-medium text-sm truncate">{String(phone)}</span>
                                {hasUnread && <span className="inline-block w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" title="Unread" />}
                                {isBlacklisted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex-shrink-0">Blocked</span>}
                              </div>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{format(dt, 'MMM d, HH:mm')}</span>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1">
                              {mostRecentMessage.isOutbound && (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex-shrink-0">You:</span>
                              )}
                              <div className="text-xs text-muted-foreground truncate flex-1">{mostRecentMessage.message}</div>
                            </div>
                          </div>
                        );
                      })}
                  {isFetching && (
                    <div className="text-center py-2 text-xs text-muted-foreground">{t('inbox.loading')}</div>
                  )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-sm">
                        <div>{t('inbox.from')}: <span className="font-mono">{selectedPhoneNumber || '-'}</span></div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Save selected conversation to favourites (header star) - only show when NOT in deleted view */}
                      {!showDeleted && (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Save to favourites"
                          disabled={!selectedPhoneNumber}
                          onClick={() => {
                            if (!selectedPhoneNumber) return;
                            const fav = favorites.includes(selectedPhoneNumber);
                            toggleFavoriteMutation.mutate({ phoneNumber: selectedPhoneNumber, favorite: !fav });
                          }}
                        >
                          <Star className={`h-4 w-4 ${selectedPhoneNumber && favorites.includes(selectedPhoneNumber) ? 'text-yellow-600 fill-yellow-500' : ''}`} />
                        </Button>
                      )}
                      {/* Show restore button when in deleted view, delete button otherwise */}
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Restore conversation"
                          disabled={!selectedPhoneNumber}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-500 dark:hover:bg-green-950"
                          onClick={async () => {
                            if (!selectedPhoneNumber) return;
                            try {
                              const token = localStorage.getItem('token');
                              const body: any = { phoneNumber: selectedPhoneNumber };
                              if (effectiveUserId) body.userId = effectiveUserId;
                              const resp = await fetch('/api/web/inbox/restore-conversation', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                                body: JSON.stringify(body)
                              });
                              if (resp.ok) {
                                toast({ title: t('common.success'), description: 'Conversation restored successfully' });
                              } else {
                                throw new Error('Failed to restore');
                              }
                            } catch (e) {
                              toast({ title: t('common.error'), description: 'Failed to restore conversation', variant: 'destructive' });
                            }
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
                            setSelectedPhoneNumber(null);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 text-green-600 dark:text-green-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Delete conversation"
                          disabled={!selectedPhoneNumber}
                          onClick={async () => {
                            if (!selectedPhoneNumber) return;
                            try {
                              const token = localStorage.getItem('token');
                              const body: any = { phoneNumber: selectedPhoneNumber };
                              if (effectiveUserId) body.userId = effectiveUserId;
                              const resp = await fetch('/api/web/inbox/delete-conversation', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                                body: JSON.stringify(body)
                              });
                              if (resp.ok) {
                                toast({ title: t('common.success'), description: 'Conversation deleted successfully' });
                              } else {
                                throw new Error('Failed to delete');
                              }
                            } catch (e) {
                              toast({ title: t('common.error'), description: 'Failed to delete conversation', variant: 'destructive' });
                            }
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
                            setSelectedPhoneNumber(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedPhoneNumber ? (
                    <ConversationInline
                      phoneNumber={selectedPhoneNumber}
                      userId={effectiveUserId}
                      isAdmin={isAdmin || isSupervisor}
                      inboxGroup={(groupedMessages as any)[selectedPhoneNumber] || []}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">Select a conversation on the left</div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Inline conversation replaces dialog */}
    </div>
  );
}

function UnreadIndicator({ userId, isAdmin }: { userId?: string; isAdmin?: boolean }) {
  const { t } = useLanguage();
  const params = new URLSearchParams(userId ? { userId } : {});
  const { data } = useQuery<{ success: boolean; unread: number }>({
    queryKey: ['/api/web/inbox/unread-count', userId || 'me'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/web/inbox/unread-count${params.toString() ? `?${params.toString()}` : ''}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (r.status === 401) return { success: false, pending: 0 } as any;
      if (!r.ok) return { success: false, pending: 0 } as any;
      return r.json();
    },
    enabled: !!localStorage.getItem('token'),
    retry: false,
    refetchInterval: 10000,
  });
  const count = data?.unread ?? 0;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 dark:bg-blue-700 border border-blue-500 dark:border-blue-600">
      <span className="text-lg font-semibold text-white">{count.toLocaleString()}</span>
      <span className="text-xs font-medium text-white uppercase tracking-wide">{t('inbox.unreadIndicator')}</span>
    </div>
  );
}
