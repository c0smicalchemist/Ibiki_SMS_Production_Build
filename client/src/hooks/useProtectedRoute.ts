import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

/**
 * Hook for protected routes requiring specific roles
 * Checks authentication and redirects to login if needed
 * @param requiredRoles - Array of roles allowed to access the route
 */
export function useProtectedRoute(requiredRoles: ("admin" | "supervisor" | "client")[] = ["client"]) {
  const [location, setLocation] = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      setLocation("/login");
      setAllowed(false);
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        // First, try to decode JWT locally (fast path)
        try {
          const payload = JSON.parse(atob(token.split(".")[1] || ""));
          const userRole = payload?.role?.toLowerCase();
          
          if (requiredRoles.map(r => r.toLowerCase()).includes(userRole)) {
            setAllowed(true);
            setIsLoading(false);
            return;
          }
        } catch {
          // Fallback if JWT decode fails
        }

        // If local decode fails, verify with server
        const profile = await apiRequest("/api/client/profile");
        const userRole = profile?.user?.role?.toLowerCase();

        if (requiredRoles.map(r => r.toLowerCase()).includes(userRole)) {
          setAllowed(true);
        } else {
          setLocation("/login");
          setAllowed(false);
        }
      } catch (error) {
        // Token invalid or expired
        localStorage.removeItem("token");
        setLocation("/login");
        setAllowed(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setLocation, requiredRoles]);

  return { allowed, isLoading };
}

/**
 * Hook to get current user info with error handling
 */
export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await apiRequest("/api/client/profile");
        setUser(profile?.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return { user, isLoading, error };
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(requiredRole: "admin" | "supervisor" | "client") {
  const { user } = useCurrentUser();
  return user?.role?.toLowerCase() === requiredRole.toLowerCase();
}
