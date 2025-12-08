import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState, Suspense, lazy } from "react";
import { apiRequest } from "./lib/queryClient";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const Signup = lazy(() => import("@/pages/Signup"));
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const ApiDocs = lazy(() => import("@/pages/ApiDocs"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const SendSMS = lazy(() => import("@/pages/SendSMS"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const MessageHistory = lazy(() => import("@/pages/MessageHistory"));
import ErrorBoundary from "@/components/ErrorBoundary";

function ProtectedAdmin() {
  const [location, setLocation] = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLocation('/login');
      setAllowed(false);
      return;
    }
    (async () => {
      try {
        // Prefer local token decode to avoid proxy/header issues
        try {
          const payload = JSON.parse(atob(token.split('.')[1] || ''));
          if (payload?.role === 'admin') {
            setAllowed(true);
            return;
          }
        } catch {}
        const me = await apiRequest('/api/client/profile');
        if (me?.user?.role === 'admin') {
          setAllowed(true);
        } else {
          setLocation('/login');
          setAllowed(false);
        }
      } catch {
        setLocation('/login');
        setAllowed(false);
      }
    })();
  }, [setLocation]);

  if (allowed === null) return null;
  return (
    <Suspense fallback={<div />}> 
      <AdminDashboard />
    </Suspense>
  );
}

function ProtectedSupervisor() {
  const [location, setLocation] = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLocation('/login');
      setAllowed(false);
      return;
    }
    (async () => {
      try {
        try {
          const payload = JSON.parse(atob(token.split('.')[1] || ''));
          if (payload?.role === 'supervisor') { setAllowed(true); return; }
        } catch {}
        const me = await apiRequest('/api/client/profile');
        if (me?.user?.role === 'supervisor') { setAllowed(true); }
        else { setLocation('/login'); setAllowed(false); }
      } catch {
        setLocation('/login'); setAllowed(false);
      }
    })();
  }, [setLocation]);

  if (allowed === null) return null;
  return (
    <Suspense fallback={<div />}> 
      <AdminDashboard />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (<Suspense fallback={<div />}> <Landing /> </Suspense>)} />
      <Route path="/signup" component={() => (<Suspense fallback={<div />}> <Signup /> </Suspense>)} />
      <Route path="/login" component={() => (<Suspense fallback={<div />}> <Login /> </Suspense>)} />
      <Route path="/forgot-password" component={() => (<Suspense fallback={<div />}> <ForgotPassword /> </Suspense>)} />
      <Route path="/reset-password" component={() => (<Suspense fallback={<div />}> <ResetPassword /> </Suspense>)} />
      <Route path="/dashboard" component={() => (<Suspense fallback={<div />}> <ClientDashboard /> </Suspense>)} />
      <Route path="/docs" component={() => (<Suspense fallback={<div />}> <ApiDocs /> </Suspense>)} />
      <Route path="/admin" component={ProtectedAdmin} />
      <Route path="/adminsup" component={ProtectedSupervisor} />
      <Route path="/contacts" component={() => (<Suspense fallback={<div />}> <Contacts /> </Suspense>)} />
      <Route path="/send-sms" component={() => (<Suspense fallback={<div />}> <SendSMS /> </Suspense>)} />
      <Route path="/inbox" component={() => (<Suspense fallback={<div />}> <Inbox /> </Suspense>)} />
      <Route path="/message-history" component={() => (<Suspense fallback={<div />}> <MessageHistory /> </Suspense>)} />
      <Route component={() => (<Suspense fallback={<div />}> <NotFound /> </Suspense>)} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
