import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtime({
  table,
  event = '*',
  schema = 'public',
  onChange,
}: {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  onChange: (payload: any) => void;
}) {
  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel(`realtime:${schema}:${table}`)
      .on(
        'postgres_changes' as any,
        { event, schema, table },
        payload => onChange(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, schema, onChange]);
}