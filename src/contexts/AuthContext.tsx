import React, { createContext, useState, useContext, useEffect } from "react";
import { isAxiosError } from "axios";
import api from "@/apis/api";
import { disablePushNotifications } from "@/lib/pushNotifications";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import { Local } from "@/pages/structure/Products";

interface User {
  email: string;
  id: number;
  role: "ADMIN" | "CAISSIER";
  name: string;
  local: Local;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user?: User;
  checkSession: () => Promise<void>;
  /** Reloads the user (name, role, local) without the full-screen loader */
  refreshUser: () => Promise<void>;
  token?: string;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    setLoading(true);
    try {
      const response = await api.post(
        `/auth/check`,
        {},
        {
          withCredentials: true,
        }
      );
      if (response.data) {
        setUser(response.data);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Session verification failed:", error);
      setIsAuthenticated(false);
      setUser(undefined);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.post(`/auth/check`, {});
      // same data: keep the same object so pages don't refetch for nothing
      if (response.data) {
        setUser((prev) =>
          JSON.stringify(prev) === JSON.stringify(response.data)
            ? prev
            : response.data
        );
      }
    } catch (error) {
      // session ended or user banned: back to login; offline: keep what we have
      if (isAxiosError(error) && error.response?.status === 401) {
        setIsAuthenticated(false);
        setUser(undefined);
      }
    }
  };

  const login = async (password: string) => {
    // No global loading here: it would unmount the login page and lose its error state
    try {
      const response = await api.post(`/auth/login`, { password });
      const { user } = response.data;

      setUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (!confirmLogout) return;

    setLoading(true);

    try {
      // Before the session ends: this device stops getting this user's notifications
      await disablePushNotifications();
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("userSettings");
      setIsAuthenticated(false);
      setUser(undefined);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Pick up changes an admin made to this user (local, role, name) while the
  // app is open: when it comes back to the foreground, and every minute.
  const loggedIn = !!user;
  useEffect(() => {
    if (!loggedIn) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshUser();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = window.setInterval(onVisible, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(timer);
    };
  }, [loggedIn]);

  const value: AuthContextType = {
    isAuthenticated,
    user,
    login,
    logout,
    checkSession,
    refreshUser,
  };

  if (loading) {
    return <LoadingSpinning fullScreen />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
