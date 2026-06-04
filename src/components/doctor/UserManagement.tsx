import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, Stethoscope } from 'lucide-react';

interface UserRow {
  user_id: string;
  nickname: string | null;
  email: string | null;
  created_at: string;
  roles: ('admin' | 'doctor' | 'user')[];
}

/**
 * Admin/doctor-only user management. Admins can promote/demote;
 * doctors see roles read-only. RLS enforces inserts/deletes on user_roles.
 */
export default function UserManagement() {
  const { isAdmin } = useUserRole();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await (supabase as any)
      .from('profiles')
      .select('user_id, nickname, email, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    const { data: roleRows } = await (supabase as any)
      .from('user_roles')
      .select('user_id, role');
    const roleMap = new Map<string, ('admin' | 'doctor' | 'user')[]>();
    (roleRows ?? []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    setRows((profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      nickname: p.nickname,
      email: p.email,
      created_at: p.created_at,
      roles: roleMap.get(p.user_id) ?? ['user'],
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleDoctor = async (row: UserRow) => {
    if (!isAdmin) return;
    setBusy(row.user_id);
    try {
      if (row.roles.includes('doctor')) {
        const { error } = await (supabase as any)
          .from('user_roles')
          .delete()
          .eq('user_id', row.user_id)
          .eq('role', 'doctor');
        if (error) throw error;
        toast.success('Doctor role removed');
      } else {
        const { error } = await (supabase as any)
          .from('user_roles')
          .insert({ user_id: row.user_id, role: 'doctor' });
        if (error) throw error;
        toast.success('Doctor role granted');
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map(r => (
            <li key={r.user_id} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.nickname || r.email || 'Anonymous'}</p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">{r.user_id}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.roles.map(role => (
                  <Badge key={role} variant={role === 'admin' ? 'default' : role === 'doctor' ? 'secondary' : 'outline'} className="capitalize text-[10px]">
                    {role}
                  </Badge>
                ))}
              </div>
              {isAdmin && !r.roles.includes('admin') && (
                <Button
                  size="sm"
                  variant={r.roles.includes('doctor') ? 'outline' : 'default'}
                  disabled={busy === r.user_id}
                  onClick={() => toggleDoctor(r)}
                  className="shrink-0"
                >
                  {r.roles.includes('doctor') ? <ShieldOff className="w-3.5 h-3.5 me-1.5" /> : <Stethoscope className="w-3.5 h-3.5 me-1.5" />}
                  {r.roles.includes('doctor') ? 'Revoke' : 'Promote'}
                </Button>
              )}
              {!isAdmin && r.roles.includes('doctor') && (
                <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
