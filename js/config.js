import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// calendar_app と同じ Supabase プロジェクト
const SUPABASE_URL = 'https://abfuanjincelcyrlswsp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uZuTU24T38xW7iAsXJIQ-g_OfuLjyjJ';

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);