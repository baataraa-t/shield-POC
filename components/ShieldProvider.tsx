"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatShieldError, getDeviceIntelligence } from "@/lib/shield/client";
import type { ShieldClientResponse } from "@/lib/shield/types";

interface ShieldContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  sessionId: string | null;
  payload: ShieldClientResponse | null;
  refresh: (userId?: string) => Promise<void>;
}

const ShieldContext = createContext<ShieldContextValue | null>(null);

export function ShieldProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [payload, setPayload] = useState<ShieldClientResponse | null>(null);

  const ignoreRef = useRef(false);

  const refresh = useCallback(async (userId?: string) => {
    if (ignoreRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const response = await getDeviceIntelligence(userId);
      if (ignoreRef.current) return;
      setPayload(response);
      setSessionId(response.result?.session_id ?? null);
      setReady(true);
    } catch (err) {
      if (ignoreRef.current) return;
      setError(formatShieldError(err));
      setReady(false);
    } finally {
      if (!ignoreRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    ignoreRef.current = false;
    if (!ignoreRef.current) {
      void refresh();
    }
    return () => {
      ignoreRef.current = true;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ ready, loading, error, sessionId, payload, refresh }),
    [ready, loading, error, sessionId, payload, refresh],
  );

  return (
    <ShieldContext.Provider value={value}>{children}</ShieldContext.Provider>
  );
}

export function useShield() {
  const context = useContext(ShieldContext);
  if (!context) {
    throw new Error("useShield must be used within ShieldProvider");
  }
  return context;
}
