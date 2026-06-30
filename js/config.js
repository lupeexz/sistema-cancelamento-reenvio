const CONFIG = {
  // ── Google Apps Script (registros legados) ──
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyi1SB9CAVt1aercHP6QD1Hien_3stkC8lV8HaCwLQk5dvs8p4aGFK7lWXtiIWT26QV/exec",
  FORM_TOKEN:  "L4BRZxALPI3G8txFktdNYNy3RxV3p3QqnzuCLT7PKwc",

  // ── Supabase ──
  // 1. Acesse https://supabase.com e crie um projeto gratuito
  // 2. Vá em Settings > API e copie os valores abaixo
  SUPABASE_URL:    "COLE_AQUI_A_URL_DO_PROJETO",   // ex: https://xyzxyz.supabase.co
  SUPABASE_ANON:   "COLE_AQUI_A_ANON_KEY",         // chave pública anon

  // ── Auth ──
  SESSION_KEY: "cr_session_v5",
  PASSWORD_SHA256: "6bfed3fecf913bda7932eeeedcac6ff1e7e4927e7039fab4266d7dc9c74e0d34", // fallback senha mestre
};
