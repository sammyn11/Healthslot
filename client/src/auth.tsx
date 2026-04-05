import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { api } from "./api";

export type Role = "patient" | "staff" | "admin";

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  specialization?: string | null;
  clinic_id?: number | null;
  is_clinic_coordinator?: boolean;
  clinic_name?: string | null;
  clinic_address?: string | null;
  clinic_slug?: string | null;
};

export type ClinicCoordinatorState = {
  clinicName: string;
  needsInitialPassword: boolean;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  fetchClinicCoordinatorState: (slug: string) => Promise<ClinicCoordinatorState>;
  setupClinicCoordinatorPassword: (slug: string, password: string) => Promise<void>;
  loginClinicCoordinator: (slug: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api<{ user: User | null }>("/api/auth/me");
      flushSync(() => setUser(u));
    } catch {
      flushSync(() => setUser(null));
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    flushSync(() => setUser(u));
    return u;
  }, []);

  const fetchClinicCoordinatorState = useCallback(async (slug: string) => {
    const res = await fetch(
      `/api/auth/clinic-coordinator-state?slug=${encodeURIComponent(slug)}`,
      { credentials: "include" }
    );
    const text = await res.text();
    let data: { error?: string; clinicName?: string; needsInitialPassword?: boolean } = {};
    if (text) {
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        /* HTML error page */
      }
    }
    if (!res.ok) {
      throw new Error(
        data.error ??
          (res.status === 404
            ? "API returned 404. Run `npm run dev` from the project root and use http://localhost:5173"
            : "Could not load clinic")
      );
    }
    return {
      clinicName: data.clinicName ?? "",
      needsInitialPassword: !!data.needsInitialPassword,
    };
  }, []);

  const setupClinicCoordinatorPassword = useCallback(
    async (slug: string, password: string) => {
      await api("/api/auth/clinic-coordinator-setup", {
        method: "POST",
        body: JSON.stringify({ slug, password }),
      });
      await refresh();
    },
    [refresh]
  );

  const loginClinicCoordinator = useCallback(
    async (slug: string, password: string) => {
      await api("/api/auth/clinic-coordinator-login", {
        method: "POST",
        body: JSON.stringify({ slug, password }),
      });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user: u } = await api<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    flushSync(() => setUser(u));
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        refresh,
        login,
        fetchClinicCoordinatorState,
        setupClinicCoordinatorPassword,
        loginClinicCoordinator,
        logout,
        register,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
