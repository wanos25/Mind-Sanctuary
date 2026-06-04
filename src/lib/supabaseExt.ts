/**
 * Typed escape hatch for tables not yet present in the
 * auto-generated `src/integrations/supabase/types.ts` (which we never edit by hand).
 * Use this for new tables introduced in migrations until the types regenerate.
 */
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sbExt = supabase as unknown as { from: (table: string) => any };
