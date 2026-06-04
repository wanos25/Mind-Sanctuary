-- 01_extensions.sql — required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pg_stat_statements and supabase_vault are managed by Supabase itself.
