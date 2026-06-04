import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type AppRole = 'admin' | 'doctor' | 'user';

interface UseUserRoleResult {
  roles: AppRole[];
  isDoctor: boolean;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Reads the current user's roles from public.user_roles.
 * Uses RLS-safe self-select policy (user_roles self read).
 */
export function useUserRole(): UseUserRoleResult {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRoles([]);
      } else {
        setRoles((data ?? []).map((r: { role: AppRole }) => r.role));
        setError(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return {
    roles,
    isDoctor: roles.includes('doctor') || roles.includes('admin'),
    isAdmin: roles.includes('admin'),
    loading: authLoading || loading,
    error,
  };
}
