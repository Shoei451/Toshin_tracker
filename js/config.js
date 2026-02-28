import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// calendar_appと同じプロジェクト
const SUPABASE_URL      = 'https://abfuanjincelcyrlswsp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZnVhbmppbmNlbGN5cmxzd3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NjE4MDIsImV4cCI6MjA4MzQzNzgwMn0.OD7371E7A1ZRiqF6SGXnp2JSzPowg2zTt-V36GQ7x9A';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
