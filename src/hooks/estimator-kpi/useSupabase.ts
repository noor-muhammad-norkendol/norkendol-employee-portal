"use client";
import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export function useEKSupabase() {
  const supabase = useMemo(() => createClient(), []);
  const [userInfo, setUserInfo] = useState<{
    userId: string;
    orgId: string;
    email: string;
    fullName: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('users')
        .select('org_id, full_name, role')
        .eq('id', user.id)
        .single();
      if (profile) {
        setUserInfo({
          userId: user.id,
          orgId: profile.org_id,
          email: user.email || '',
          fullName: profile.full_name || '',
          role: profile.role || 'user',
        });
      }
    }
    load();
  }, [supabase]);

  return { supabase, userInfo };
}
