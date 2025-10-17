import { createClient } from '@supabase/supabase-js'

// Supabase 客户端。请在项目根目录的 .env.local 中设置以下变量：
// NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""


export const supabase = createClient(supabaseUrl, supabaseAnonKey)
