-- 02_enums.sql — all public enums (idempotent via DO blocks)

DO $$ BEGIN
  CREATE TYPE public.mood AS ENUM ('calm','anxious','overwhelmed','hopeful','neutral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.msg_role AS ENUM ('user','ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.session_stage AS ENUM ('assessment','exploration','action');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.memory_type AS ENUM (
    'person','goal','fear','trigger','recovery',
    'achievement','preference','theme','event','habit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','doctor','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
