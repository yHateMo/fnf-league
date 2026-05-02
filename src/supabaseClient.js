import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qhfayxaaptogcjojmxsb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9y8q1f13X2qrwilLRb16gw_WFArwmsT";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);