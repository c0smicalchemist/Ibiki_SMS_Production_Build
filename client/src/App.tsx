import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { queryClient } from "./lib/queryClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import CryptoPayment from "@/pages/CryptoPayment"; // Direct import instead of lazy

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

/**
 * Generic protected route component
 * Reusable for any role-based access control
 */
function ProtectedRoute({ roles, children }: { roles: ("admin" | "supervisor" | "client")[]; children: React.ReactNode }) {
  const { allowed, isLoading } = useProtectedRoute(roles);

  if (isLoading) return null;
  if (!allowed) return null;

  return (
    <Suspense fallback={<div />}>
      {children}
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (<Suspense fallback={<div />}><Landing /></Suspense>)} />
      <Route path="/signup" component={() => (<Suspense fallback={<div />}><Signup /></Suspense>)} />
      <Route path="/login" component={() => (<Suspense fallback={<div />}><Login /></Suspense>)} />
      <Route path="/forgot-password" component={() => (<Suspense fallback={<div />}><ForgotPassword /></Suspense>)} />
      <Route path="/reset-password" component={() => (<Suspense fallback={<div />}><ResetPassword /></Suspense>)} />
      <Route path="/dashboard" component={() => (<Suspense fallback={<div />}><ClientDashboard /></Suspense>)} />
      <Route path="/docs" component={() => (<Suspense fallback={<div />}><ApiDocs /></Suspense>)} />
      <Route path="/admin" component={() => <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/adminsup" component={() => <ProtectedRoute roles={["admin", "supervisor"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/contacts" component={() => (<Suspense fallback={<div />}><Contacts /></Suspense>)} />
      <Route path="/send-sms" component={() => (<Suspense fallback={<div />}><SendSMS /></Suspense>)} />
      <Route path="/inbox" component={() => (<Suspense fallback={<div />}><Inbox /></Suspense>)} />
      <Route path="/message-history" component={() => (<Suspense fallback={<div />}><MessageHistory /></Suspense>)} />
      <Route path="/crypto-payment" component={CryptoPayment} />
      <Route component={() => (<Suspense fallback={<div />}><NotFound /></Suspense>)} />
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
