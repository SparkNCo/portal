


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "external";


ALTER SCHEMA "external" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "marketing";


ALTER SCHEMA "marketing" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "portal";


ALTER SCHEMA "portal" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "portaldev";


ALTER SCHEMA "portaldev" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "stripe";


ALTER SCHEMA "stripe" OWNER TO "postgres";


COMMENT ON SCHEMA "stripe" IS 'stripe-sync v1.0.18 installed';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgmq";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE TYPE "stripe"."invoice_status" AS ENUM (
    'draft',
    'open',
    'paid',
    'uncollectible',
    'void',
    'deleted'
);


ALTER TYPE "stripe"."invoice_status" OWNER TO "postgres";


CREATE TYPE "stripe"."pricing_tiers" AS ENUM (
    'graduated',
    'volume'
);


ALTER TYPE "stripe"."pricing_tiers" OWNER TO "postgres";


CREATE TYPE "stripe"."pricing_type" AS ENUM (
    'one_time',
    'recurring'
);


ALTER TYPE "stripe"."pricing_type" OWNER TO "postgres";


CREATE TYPE "stripe"."subscription_schedule_status" AS ENUM (
    'not_started',
    'active',
    'completed',
    'released',
    'canceled'
);


ALTER TYPE "stripe"."subscription_schedule_status" OWNER TO "postgres";


CREATE TYPE "stripe"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'unpaid',
    'paused'
);


ALTER TYPE "stripe"."subscription_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."can_access_chat"("target_chat_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'portal', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM portal.users u
    WHERE u.email = auth.email()
      AND (
        u.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM portal.chat_participants cp
          WHERE cp.chat_id = target_chat_id AND cp.user_id = u.id
        )
      )
  );
$$;


ALTER FUNCTION "portal"."can_access_chat"("target_chat_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."current_portal_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'portal', 'pg_catalog'
    AS $$
  SELECT id FROM portal.users WHERE email = auth.email();
$$;


ALTER FUNCTION "portal"."current_portal_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."delete_customer_ticket_token"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'ticket_token:' || OLD.customer_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "portal"."delete_customer_ticket_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."delete_data_source_vault_secret"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.password_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.password_secret_id;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "portal"."delete_data_source_vault_secret"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."delete_ticket_token"("p_customer_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  DELETE FROM vault.secrets WHERE name = 'ticket_token:' || p_customer_id;
$$;


ALTER FUNCTION "portal"."delete_ticket_token"("p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."get_data_source_password"("p_data_source_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT s.decrypted_secret
  FROM portal.data_sources d
  JOIN vault.decrypted_secrets s ON s.id = d.password_secret_id
  WHERE d.id = p_data_source_id;
$$;


ALTER FUNCTION "portal"."get_data_source_password"("p_data_source_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."get_ticket_token"("p_customer_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ticket_token:' || p_customer_id;
$$;


ALTER FUNCTION "portal"."get_ticket_token"("p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."match_documents"("query_embedding" "public"."vector", "match_project_slug" "text", "match_count" integer DEFAULT 20) RETURNS TABLE("id" bigint, "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'portal', 'public', 'pg_catalog'
    AS $$
  SELECT d.id, 1 - (d.embedding <=> query_embedding) AS similarity
  FROM portal.documents d
  WHERE d.embedding IS NOT NULL AND d.project_slug ILIKE match_project_slug
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "portal"."match_documents"("query_embedding" "public"."vector", "match_project_slug" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."match_issues"("query_embedding" "public"."vector", "match_project_slug" "text", "match_kind" "text" DEFAULT NULL::"text", "use_title_only" boolean DEFAULT false, "match_count" integer DEFAULT 3) RETURNS TABLE("id" "text", "title" "text", "kind" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'portal', 'public', 'pg_catalog'
    AS $$
  SELECT
    v.id,
    v.title,
    v.kind,
    1 - ((CASE WHEN use_title_only THEN v.title_embedding ELSE v.combined_embedding END) <=> query_embedding) AS similarity
  FROM portal.issue_vectors v
  WHERE v.project_slug ILIKE match_project_slug
    AND (match_kind IS NULL OR v.kind = match_kind)
    AND (CASE WHEN use_title_only THEN v.title_embedding ELSE v.combined_embedding END) IS NOT NULL
  ORDER BY (CASE WHEN use_title_only THEN v.title_embedding ELSE v.combined_embedding END) <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "portal"."match_issues"("query_embedding" "public"."vector", "match_project_slug" "text", "match_kind" "text", "use_title_only" boolean, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."match_tests"("query_embedding" "public"."vector", "match_project_slug" "text", "match_count" integer DEFAULT 3) RETURNS TABLE("id" "uuid", "title" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'portal', 'public', 'pg_catalog'
    AS $$
  SELECT t.id, t.title, 1 - (t.embedding <=> query_embedding) AS similarity
  FROM portal.tests t
  WHERE t.embedding IS NOT NULL AND t.project_slug ILIKE match_project_slug
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "portal"."match_tests"("query_embedding" "public"."vector", "match_project_slug" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."notify_chat_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'portal', 'pg_catalog'
    AS $$
DECLARE
  new_event_id uuid;
  recipient RECORD;
  existing_notification_id uuid;
  chat_title text;
BEGIN
  SELECT title INTO chat_title FROM portal.chats WHERE id = NEW.chat_id;

  INSERT INTO portal.events (actor_user_id, actor_email, action, object_type, object_id, object_title, preview, link)
  VALUES (
    NEW.user_id,
    (SELECT email FROM portal.users WHERE id = NEW.user_id),
    'chat_message',
    'chat',
    NEW.chat_id::text,
    chat_title,
    -- A message with only files has no text; say what it carried instead.
    COALESCE(
      NULLIF(left(NEW.body, 140), ''),
      CASE jsonb_array_length(COALESCE(NEW.metadata->'attachments', '[]'::jsonb))
        WHEN 0 THEN ''
        WHEN 1 THEN 'Sent an attachment'
        ELSE 'Sent ' || jsonb_array_length(NEW.metadata->'attachments') || ' attachments'
      END
    ),
    -- A generic fallback, not a deep link to this specific conversation —
    -- the frontend NotificationBell resolves the real, role-prefixed inbox
    -- path for `object_type = 'chat'` at click time.
    '/chat'
  )
  RETURNING id INTO new_event_id;

  FOR recipient IN
    SELECT r.user_id FROM (
      SELECT cp.user_id FROM portal.chat_participants cp WHERE cp.chat_id = NEW.chat_id
      UNION
      SELECT u.id FROM portal.users u WHERE u.role = 'admin'
    ) AS r(user_id)
    WHERE r.user_id IS DISTINCT FROM NEW.user_id
  LOOP
    -- One unread notification per (user, chat) — a chat's Nth message while
    -- the (N-1)th is still unread re-points the existing notification at
    -- this newest event instead of piling up another row.
    SELECT n.id INTO existing_notification_id
    FROM portal.notifications n
    JOIN portal.events e ON e.id = n.event_id
    WHERE n.user_id = recipient.user_id
      AND n.read = false
      AND e.object_type = 'chat'
      AND e.object_id = NEW.chat_id::text
    LIMIT 1;

    IF existing_notification_id IS NOT NULL THEN
      UPDATE portal.notifications SET event_id = new_event_id, created_at = now() WHERE id = existing_notification_id;
    ELSE
      INSERT INTO portal.notifications (user_id, event_id, read) VALUES (recipient.user_id, new_event_id, false);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."notify_chat_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."set_data_source_password"("p_data_source_id" "uuid", "p_password" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  existing_secret_id uuid;
BEGIN
  SELECT password_secret_id INTO existing_secret_id
  FROM portal.data_sources WHERE id = p_data_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data source % not found', p_data_source_id;
  END IF;

  IF existing_secret_id IS NULL THEN
    UPDATE portal.data_sources
    SET password_secret_id = vault.create_secret(
      p_password,
      'data_source_password_' || p_data_source_id,
      'Password for portal.data_sources ' || p_data_source_id
    )
    WHERE id = p_data_source_id;
  ELSE
    PERFORM vault.update_secret(existing_secret_id, p_password);
  END IF;
END;
$$;


ALTER FUNCTION "portal"."set_data_source_password"("p_data_source_id" "uuid", "p_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."set_ticket_token"("p_customer_id" "uuid", "p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  secret_name text := 'ticket_token:' || p_customer_id;
  existing_secret_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM portal.customers WHERE customer_id = p_customer_id) THEN
    RAISE EXCEPTION 'Customer % not found', p_customer_id;
  END IF;

  SELECT id INTO existing_secret_id FROM vault.secrets WHERE name = secret_name;

  IF existing_secret_id IS NULL THEN
    PERFORM vault.create_secret(p_token, secret_name, 'Ticket system API token for portal.customers ' || p_customer_id);
  ELSE
    PERFORM vault.update_secret(existing_secret_id, p_token);
  END IF;
END;
$$;


ALTER FUNCTION "portal"."set_ticket_token"("p_customer_id" "uuid", "p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."touch_chat_last_message_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE portal.chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."touch_chat_last_message_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."touch_data_sources_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."touch_data_sources_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."update_chats_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."update_chats_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."update_design_resources_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."update_design_resources_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."update_hours_logged_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."update_hours_logged_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."update_suggested_features_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."update_suggested_features_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."update_test_executions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."update_test_executions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."update_tests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."update_tests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "portal"."update_vector_sync_state_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "portal"."update_vector_sync_state_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new._updated_at = now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_metadata"() OWNER TO "postgres";


CREATE FOREIGN DATA WRAPPER "airtable" HANDLER "extensions"."airtable_fdw_handler" VALIDATOR "extensions"."airtable_fdw_validator";




CREATE FOREIGN DATA WRAPPER "cal" HANDLER "extensions"."wasm_fdw_handler" VALIDATOR "extensions"."wasm_fdw_validator";




CREATE FOREIGN DATA WRAPPER "notion" HANDLER "extensions"."wasm_fdw_handler" VALIDATOR "extensions"."wasm_fdw_validator";




CREATE SERVER "airtable_server" FOREIGN DATA WRAPPER "airtable" OPTIONS (
    "api_key_id" 'cfa05454-3480-40b0-9154-b6f7bf64d078'
);


ALTER SERVER "airtable_server" OWNER TO "postgres";


CREATE SERVER "cal_server" FOREIGN DATA WRAPPER "cal" OPTIONS (
    "api_key_id" '4eb01c64-e01e-4e09-ac33-48ccb94a359b',
    "api_url" 'https://api.cal.com/v2',
    "fdw_package_checksum" 'bca8a82d6c5f8da0aa58011940c4ddb40bb2c909c02dd89b488289c4fff890c1',
    "fdw_package_name" 'supabase:cal-fdw',
    "fdw_package_url" 'https://github.com/supabase/wrappers/releases/download/wasm_cal_fdw_v0.1.0/cal_fdw.wasm',
    "fdw_package_version" '0.1.0'
);


ALTER SERVER "cal_server" OWNER TO "postgres";


CREATE SERVER "notion_server" FOREIGN DATA WRAPPER "notion" OPTIONS (
    "api_key_id" 'a3f8864a-a96d-4f5f-b142-09be5588120c',
    "api_url" 'https://api.notion.com/v1',
    "fdw_package_checksum" '6dea3014f462aafd0c051c37d163fe326e7650c26a7eb5d8017a30634b5a46de',
    "fdw_package_name" 'supabase:notion-fdw',
    "fdw_package_url" 'https://github.com/supabase/wrappers/releases/download/wasm_notion_fdw_v0.1.1/notion_fdw.wasm',
    "fdw_package_version" '0.1.1'
);


ALTER SERVER "notion_server" OWNER TO "postgres";


CREATE FOREIGN TABLE "external"."airtable" (
    "Notes" "text",
    "Assignee" "text",
    "Status" "text"
)
SERVER "airtable_server"
OPTIONS (
    "base_id" 'appFz7B4zPErBwIDt',
    "schema" 'external',
    "table_id" 'tblcpLRw4snDfEANv'
);


ALTER FOREIGN TABLE "external"."airtable" OWNER TO "postgres";


CREATE FOREIGN TABLE "external"."availability" (
    "attrs" "jsonb"
)
SERVER "cal_server"
OPTIONS (
    "id" '62749',
    "object" 'calendars',
    "schema" 'external'
);


ALTER FOREIGN TABLE "external"."availability" OWNER TO "postgres";


CREATE FOREIGN TABLE "external"."notion_pges" (
    "id" "text",
    "url" "text",
    "created_time" timestamp without time zone,
    "last_edited_time" timestamp without time zone,
    "archived" boolean,
    "attrs" "jsonb"
)
SERVER "notion_server"
OPTIONS (
    "object" 'page',
    "schema" 'external'
);


ALTER FOREIGN TABLE "external"."notion_pges" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "marketing"."leads" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "description" "text",
    "budget_min" numeric,
    "budget_max" numeric,
    "company" "text",
    "industry" "text",
    "selected_date" "text",
    "selected_time" "text",
    "lead_id" "uuid" NOT NULL,
    "formatted_date" timestamp with time zone,
    "estimateTime_min" integer,
    "estimateTime_max" integer,
    "scheduling_url" "text",
    "email_sent" boolean,
    "booking_status" "text",
    "email_sent_at" "text",
    "discovery_state" "text",
    "build_scale" "text"
);


ALTER TABLE "marketing"."leads" OWNER TO "postgres";


ALTER TABLE "marketing"."leads" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "marketing"."Leads_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "marketing"."architect_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "recommended_stack" "text",
    "answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "report_sent" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "marketing"."architect_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "marketing"."ig_posts" (
    "blog_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "img" "text",
    "author" "text",
    "tags" "text"[],
    "slide_two" "text",
    "slide_three" "text",
    "contentful_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "slide_three_title" "text"
);


ALTER TABLE "marketing"."ig_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "marketing"."proposals" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "passcode" "text" NOT NULL,
    "proposal_id" "uuid",
    "stage" "text",
    "updated_at" timestamp with time zone,
    "lead_id" "uuid",
    "creator_email" "text",
    "signature_url" "text",
    "signed_at" timestamp with time zone,
    "summary_items" "jsonb",
    "client_name" "text",
    "provider_name" "text",
    "proposal_title" "text",
    "proposal_date" "date",
    "valid_until" "date",
    "signatures" "jsonb",
    "disclaimer" "jsonb",
    "timeline_and_milestones" "jsonb",
    "summary" "jsonb",
    "problem_and_context" "jsonb",
    "solution_overview" "jsonb",
    "pricing_and_commercial" "jsonb",
    "objectives_and_success_criteria" "jsonb",
    "next_steps" "jsonb",
    "assurance_and_quality" "jsonb",
    "risk_and_responsabilities" "jsonb",
    "assumptions_and_dependencies" "jsonb",
    "change_management_process" "jsonb",
    "history_and_case_studies" "jsonb",
    "technology_and_architecture" "jsonb",
    "team_and_communication" "jsonb",
    "deliverables" "jsonb",
    "meetingDate" "text"
);


ALTER TABLE "marketing"."proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "marketing"."requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proposal_id" "uuid" DEFAULT "gen_random_uuid"(),
    "submission_id" "text",
    "integration_text" "text",
    "description" "text",
    "purpose" "text",
    "feature_name" "text",
    "tech_constraints" "text"
);


ALTER TABLE "marketing"."requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "marketing"."stacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "tagline" "text",
    "description" "text" NOT NULL,
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "frameworks" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hosting" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "best_for" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sample_repo_url" "text",
    "speed" integer DEFAULT 3 NOT NULL,
    "customizability" integer DEFAULT 3 NOT NULL,
    "portability" integer DEFAULT 3 NOT NULL,
    "integrated" integer DEFAULT 3 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "marketing"."stacks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "customer_id" "uuid",
    "role" "text" DEFAULT 'developer'::"text" NOT NULL,
    "allocation" integer DEFAULT 0 NOT NULL,
    "joined" "date" DEFAULT CURRENT_DATE NOT NULL,
    "linearId" "text",
    CONSTRAINT "assignments_role_check" CHECK (("role" = ANY (ARRAY['developer'::"text", 'customer'::"text", 'stakeholder'::"text"])))
);


ALTER TABLE "portal"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."chat_participants" (
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portal"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_slug" "text",
    "title" "text",
    "type" "text" DEFAULT 'group'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    "issue_id" "text",
    CONSTRAINT "chats_type_check" CHECK (("type" = ANY (ARRAY['direct'::"text", 'group'::"text", 'issue'::"text"])))
);


ALTER TABLE "portal"."chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."customers" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proposal_id" "text",
    "stripe_customer_id" "text",
    "linear_name" "text",
    "linear_slug" "text",
    "email" "text",
    "linear_initiative_id" "text",
    "linear_projects" "text"[],
    "customer_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_url" "text"[],
    "clientName" "text",
    "billing_mode" "text" DEFAULT 'automatic'::"text" NOT NULL,
    "invoice_amount_cents" integer,
    "invoice_interval" "text",
    "invoice_interval_count" integer DEFAULT 1 NOT NULL,
    "preview_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "systems" "jsonb" DEFAULT '{"chat": "cometchat", "vector": "upstash"}'::"jsonb" NOT NULL,
    CONSTRAINT "customers_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['automatic'::"text", 'manual'::"text"]))),
    CONSTRAINT "customers_invoice_amount_cents_check" CHECK ((("invoice_amount_cents" IS NULL) OR ("invoice_amount_cents" > 0))),
    CONSTRAINT "customers_invoice_interval_check" CHECK ((("invoice_interval" IS NULL) OR ("invoice_interval" = ANY (ARRAY['day'::"text", 'week'::"text", 'month'::"text", 'year'::"text"])))),
    CONSTRAINT "customers_invoice_interval_count_check" CHECK (("invoice_interval_count" > 0)),
    CONSTRAINT "customers_systems_valid" CHECK ((("systems" ? 'chat'::"text") AND (("systems" ->> 'chat'::"text") = ANY (ARRAY['cometchat'::"text", 'supabase_realtime'::"text"])) AND ("systems" ? 'vector'::"text") AND (("systems" ->> 'vector'::"text") = ANY (ARRAY['upstash'::"text", 'pgvector'::"text"]))))
);


ALTER TABLE "portal"."customers" OWNER TO "postgres";


ALTER TABLE "portal"."customers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "portal"."customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "portal"."cycle_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "project_id" "text" NOT NULL,
    "cycle_id" "text" NOT NULL,
    "name" "text",
    "description" "text",
    "number" integer,
    "completed_at" timestamp with time zone,
    "scope_history" integer[] DEFAULT '{}'::integer[],
    "completed_scope_history" integer[] DEFAULT '{}'::integer[],
    "uncompleted_issues_upon_close" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "is_active" boolean,
    "starts_at" timestamp with time zone,
    "issues_averages" "jsonb"[],
    "project_name" "text",
    "cycle_issue_ids" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "portal"."cycle_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."data_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'postgres'::"text" NOT NULL,
    "host" "text" NOT NULL,
    "port" integer DEFAULT 5432 NOT NULL,
    "database_name" "text" NOT NULL,
    "username" "text" NOT NULL,
    "ssl" boolean DEFAULT true NOT NULL,
    "password_secret_id" "uuid",
    "schema_path" "text",
    "schema_refreshed_at" timestamp with time zone,
    "schema_error" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_sources_port_check" CHECK ((("port" >= 1) AND ("port" <= 65535))),
    CONSTRAINT "data_sources_type_check" CHECK (("type" = ANY (ARRAY['postgres'::"text", 'sqlserver'::"text", 'mysql'::"text"])))
);


ALTER TABLE "portal"."data_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "text" NOT NULL,
    "status" boolean,
    "owner_email" "text" NOT NULL,
    "question" "text" NOT NULL,
    "decisions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posted_to_linear" boolean DEFAULT false NOT NULL,
    "decision_by" "text",
    "decided_at" timestamp with time zone,
    "decision" "text",
    "type" "text" DEFAULT 'question'::"text" NOT NULL,
    CONSTRAINT "decisions_type_check" CHECK (("type" = ANY (ARRAY['question'::"text", 'requirement_update'::"text"])))
);


ALTER TABLE "portal"."decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."demo_video_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "demo_video_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portal"."demo_video_comments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "portal"."demo_videos_demo_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "portal"."demo_videos_demo_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."demo_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "source_type" "text" NOT NULL,
    "file_name" "text",
    "file_url" "text",
    "storage_path" "text",
    "embed_url" "text",
    "embed_provider" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text" NOT NULL,
    "demo_number" bigint DEFAULT "nextval"('"portal"."demo_videos_demo_number_seq"'::"regclass") NOT NULL,
    CONSTRAINT "demo_videos_source_fields_check" CHECK (((("source_type" = 'upload'::"text") AND ("storage_path" IS NOT NULL)) OR (("source_type" = 'embed'::"text") AND ("embed_url" IS NOT NULL)))),
    CONSTRAINT "demo_videos_source_type_check" CHECK (("source_type" = ANY (ARRAY['upload'::"text", 'embed'::"text"])))
);


ALTER TABLE "portal"."demo_videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."design_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "text" NOT NULL,
    "project_slug" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "design_resources_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['figma'::"text", 'v0'::"text"])))
);


ALTER TABLE "portal"."design_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."developers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "policies_approved" boolean DEFAULT false,
    "policy_notion_url" "text",
    "bio" "text",
    "tech_stack" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "developer_type" "text" DEFAULT 'spark_fde'::"text" NOT NULL,
    "rate_amount" numeric,
    "rate_type" "text",
    CONSTRAINT "developers_developer_type_check" CHECK (("developer_type" = ANY (ARRAY['spark_fde'::"text", 'internal'::"text"]))),
    CONSTRAINT "developers_rate_type_check" CHECK (("rate_type" = ANY (ARRAY['hourly'::"text", 'monthly'::"text", 'annual'::"text"])))
);


ALTER TABLE "portal"."developers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."diagrams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "issue_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "storage_path" "text" NOT NULL,
    "mermaid_source" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portal"."diagrams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."document_permissions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" bigint NOT NULL,
    "permission" "text" NOT NULL
);


ALTER TABLE "portal"."document_permissions" OWNER TO "postgres";


ALTER TABLE "portal"."document_permissions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "portal"."document_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "portal"."document_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_slug" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "text",
    "project_id" "text",
    "project_name" "text",
    "claimed_by" "text",
    "claimed_at" timestamp with time zone,
    "related_request_id" "uuid"
);


ALTER TABLE "portal"."document_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."documents" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_name" "text",
    "link" "text",
    "category" "text",
    "size" "text",
    "owner_id" "uuid",
    "project_slug" "text",
    "embedding" "public"."vector"(384)
);


ALTER TABLE "portal"."documents" OWNER TO "postgres";


ALTER TABLE "portal"."documents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "portal"."documents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "portal"."dora_branch_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repo" "text" NOT NULL,
    "branch_name" "text" NOT NULL,
    "linear_issue_id" "text" NOT NULL,
    "branch_type" "text" NOT NULL,
    "branch_created_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" smallint,
    "closed_date" timestamp with time zone,
    CONSTRAINT "dora_branch_events_branch_type_check" CHECK (("branch_type" = ANY (ARRAY['feat'::"text", 'fix'::"text"])))
);


ALTER TABLE "portal"."dora_branch_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."dora_metrics" (
    "dorametrics_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "averages" "jsonb",
    "cfr_details" "jsonb",
    "lead_time_details" "jsonb",
    "mttr_details" "jsonb",
    "deploy_freq_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_called" timestamp with time zone,
    "customer_id" "uuid" NOT NULL,
    "linear_slug" "text",
    "url" "text",
    "feature_cycle_details" "jsonb",
    "fix_cycle_details" "jsonb",
    "defect_escape_details" "jsonb",
    "code_coverage_details" "jsonb",
    "sonar_quality_gate_details" "jsonb"
);


ALTER TABLE "portal"."dora_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "object_type" "text" NOT NULL,
    "object_id" "text" NOT NULL,
    "issue_code" "text",
    "issue_id" "text",
    "preview" "text",
    "link" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "object_title" "text"
);


ALTER TABLE "portal"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."hours_logged" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "developer_id" "uuid" NOT NULL,
    "developer_email" "text" NOT NULL,
    "project_slug" "text" NOT NULL,
    "project_name" "text" NOT NULL,
    "hours" integer NOT NULL,
    "issue_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "worked_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT "hours_logged_hours_check" CHECK (("hours" > 0))
);


ALTER TABLE "portal"."hours_logged" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."issue_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "text" NOT NULL,
    "project_id" "text" NOT NULL,
    "status" "text",
    "label" "text",
    "count" integer DEFAULT 0,
    "points" numeric DEFAULT 0,
    "cycle" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cycle_issue_id" "text",
    "title" "text"[]
);


ALTER TABLE "portal"."issue_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."issue_requests" (
    "issue_id" "text" NOT NULL,
    "requested_by" "uuid",
    "requested_by_email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portal"."issue_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."issue_updates" (
    "issue_id" "text" NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "seen" boolean DEFAULT false NOT NULL
);


ALTER TABLE "portal"."issue_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."issue_vectors" (
    "id" "text" NOT NULL,
    "project_slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "kind" "text",
    "title_embedding" "public"."vector"(384),
    "combined_embedding" "public"."vector"(384),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "issue_vectors_kind_check" CHECK ((("kind" = ANY (ARRAY['bug'::"text", 'feature'::"text"])) OR ("kind" IS NULL)))
);


ALTER TABLE "portal"."issue_vectors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."issue_views" (
    "issue_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portal"."issue_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "body" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portal"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."milestone_cycle_snapshots" (
    "milestone_id" "text" NOT NULL,
    "cycle_id" "text" NOT NULL,
    "linear_slug" "text" NOT NULL,
    "status" "text" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "milestone_cycle_snapshots_status_check" CHECK (("status" = ANY (ARRAY['done'::"text", 'overdue'::"text"])))
);


ALTER TABLE "portal"."milestone_cycle_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "read" boolean DEFAULT false NOT NULL
);


ALTER TABLE "portal"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."pinned_panels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "panel_id" "text" NOT NULL,
    "source_dashboard" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_width" boolean DEFAULT false NOT NULL
);


ALTER TABLE "portal"."pinned_panels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_slug" "text" NOT NULL
);


ALTER TABLE "portal"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."suggested_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_slug" "text" NOT NULL,
    "linear_project_id" "text" NOT NULL,
    "linear_project_name" "text" NOT NULL,
    "linear_milestone_id" "text",
    "linear_milestone_name" "text",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" "text",
    "linear_issue_id" "text",
    "linear_issue_identifier" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suggested_features_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "suggested_features_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "portal"."suggested_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."test_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "issue_id" "text" NOT NULL,
    "expected" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "text",
    "approved_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "test_executions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'passed'::"text", 'failed'::"text"])))
);


ALTER TABLE "portal"."test_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_slug" "text",
    "title" "text" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_passed_execution_id" "uuid",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "public"."vector"(384)
);


ALTER TABLE "portal"."tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."tests_legacy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb",
    "expected" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "created_by" "text" NOT NULL,
    "approved_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "actual" "jsonb"[]
);


ALTER TABLE "portal"."tests_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text",
    "customer_id" "text",
    "subscription_id" "text",
    "project_ids" "text"[],
    "initiative_ids" "text"[],
    "auth_id" "text",
    "proposal_id" "text",
    "userName" "text",
    "assignment_id" "text"[],
    "phoneNumber" "text",
    "firstName" "text",
    "lastName" "text"
);


ALTER TABLE "portal"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portal"."vector_sync_state" (
    "linear_slug" "text" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "portal"."vector_sync_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "customer_id" "uuid",
    "role" "text" DEFAULT 'developer'::"text" NOT NULL,
    "allocation" integer DEFAULT 0 NOT NULL,
    "joined" "date" DEFAULT CURRENT_DATE NOT NULL,
    "linearId" "text",
    CONSTRAINT "assignments_role_check" CHECK (("role" = ANY (ARRAY['developer'::"text", 'customer'::"text", 'stakeholder'::"text"])))
);


ALTER TABLE "portaldev"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."customers" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proposal_id" "text",
    "stripe_customer_id" "text",
    "linear_name" "text",
    "linear_slug" "text",
    "email" "text",
    "linear_initiative_id" "text",
    "linear_projects" "text"[],
    "customer_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_url" "text"[],
    "clientName" "text"
);


ALTER TABLE "portaldev"."customers" OWNER TO "postgres";


ALTER TABLE "portaldev"."customers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "portaldev"."customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "portaldev"."cycle_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "project_id" "text" NOT NULL,
    "cycle_id" "text" NOT NULL,
    "name" "text",
    "description" "text",
    "number" integer,
    "completed_at" timestamp with time zone,
    "scope_history" integer[] DEFAULT '{}'::integer[],
    "completed_scope_history" integer[] DEFAULT '{}'::integer[],
    "uncompleted_issues_upon_close" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "is_active" boolean,
    "starts_at" timestamp with time zone,
    "issues_averages" "jsonb"[],
    "project_name" "text",
    "cycle_issue_ids" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "portaldev"."cycle_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "text" NOT NULL,
    "status" boolean,
    "owner_email" "text" NOT NULL,
    "question" "text" NOT NULL,
    "decisions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posted_to_linear" boolean DEFAULT false NOT NULL,
    "decision_by" "text",
    "decided_at" timestamp with time zone,
    "decision" "text"
);


ALTER TABLE "portaldev"."decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."developers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "policies_approved" boolean DEFAULT false,
    "policy_notion_url" "text"
);


ALTER TABLE "portaldev"."developers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."diagrams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "issue_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "storage_path" "text" NOT NULL,
    "mermaid_source" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portaldev"."diagrams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."document_permissions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" bigint NOT NULL,
    "permission" "text" NOT NULL
);


ALTER TABLE "portaldev"."document_permissions" OWNER TO "postgres";


ALTER TABLE "portaldev"."document_permissions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "portaldev"."document_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "portaldev"."document_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_slug" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "text",
    "project_id" "text",
    "project_name" "text",
    "claimed_by" "text",
    "claimed_at" timestamp with time zone
);


ALTER TABLE "portaldev"."document_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."documents" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_name" "text",
    "link" "text",
    "category" "text",
    "size" "text",
    "owner_id" "uuid",
    "project_slug" "text"
);


ALTER TABLE "portaldev"."documents" OWNER TO "postgres";


ALTER TABLE "portaldev"."documents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "portaldev"."documents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "portaldev"."dora_metrics" (
    "dorametrics_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "averages" "jsonb",
    "cfr_details" "jsonb",
    "lead_time_details" "jsonb",
    "mttr_details" "jsonb",
    "deploy_freq_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_called" timestamp with time zone,
    "customer_id" "uuid" NOT NULL,
    "linear_slug" "text",
    "url" "text"
);


ALTER TABLE "portaldev"."dora_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."issue_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "text" NOT NULL,
    "project_id" "text" NOT NULL,
    "status" "text",
    "label" "text",
    "count" integer DEFAULT 0,
    "points" numeric DEFAULT 0,
    "cycle" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cycle_issue_id" "text",
    "title" "text"[]
);


ALTER TABLE "portaldev"."issue_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."issue_updates" (
    "issue_id" "text" NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "seen" boolean DEFAULT false NOT NULL
);


ALTER TABLE "portaldev"."issue_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."pinned_panels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "panel_id" "text" NOT NULL,
    "source_dashboard" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "portaldev"."pinned_panels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_slug" "text" NOT NULL
);


ALTER TABLE "portaldev"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb",
    "expected" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "created_by" "text" NOT NULL,
    "approved_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "actual" "jsonb"[]
);


ALTER TABLE "portaldev"."tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "portaldev"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text",
    "customer_id" "text",
    "subscription_id" "text",
    "project_ids" "text"[],
    "initiative_ids" "text"[],
    "auth_id" "text",
    "proposal_id" "text",
    "userName" "text",
    "assignment_id" "text"[],
    "phoneNumber" "text",
    "firstName" "text",
    "lastName" "text"
);


ALTER TABLE "portaldev"."users" OWNER TO "postgres";


CREATE FOREIGN TABLE "public"."notion_content" (
    "id" "text",
    "page_id" "text",
    "type" "text",
    "created_time" timestamp without time zone,
    "last_edited_time" timestamp without time zone,
    "archived" boolean,
    "attrs" "jsonb"
)
SERVER "notion_server"
OPTIONS (
    "object" 'block',
    "schema" 'public'
);


ALTER FOREIGN TABLE "public"."notion_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."_managed_webhooks" (
    "id" "text" NOT NULL,
    "object" "text",
    "url" "text" NOT NULL,
    "enabled_events" "jsonb" NOT NULL,
    "description" "text",
    "enabled" boolean,
    "livemode" boolean,
    "metadata" "jsonb",
    "secret" "text" NOT NULL,
    "status" "text",
    "api_version" "text",
    "created" integer,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_synced_at" timestamp with time zone,
    "account_id" "text" NOT NULL
);


ALTER TABLE "stripe"."_managed_webhooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."_migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "stripe"."_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."_sync_obj_runs" (
    "_account_id" "text" NOT NULL,
    "run_started_at" timestamp with time zone NOT NULL,
    "object" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "processed_count" integer DEFAULT 0,
    "cursor" "text",
    "error_message" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "_sync_obj_run_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'complete'::"text", 'error'::"text"])))
);


ALTER TABLE "stripe"."_sync_obj_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."_sync_runs" (
    "_account_id" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "max_concurrent" integer DEFAULT 3 NOT NULL,
    "error_message" "text",
    "triggered_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone
);


ALTER TABLE "stripe"."_sync_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."accounts" (
    "_raw_data" "jsonb" NOT NULL,
    "first_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "_last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "_updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_name" "text" GENERATED ALWAYS AS ((("_raw_data" -> 'business_profile'::"text") ->> 'name'::"text")) STORED,
    "email" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'email'::"text")) STORED,
    "type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'type'::"text")) STORED,
    "charges_enabled" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'charges_enabled'::"text"))::boolean) STORED,
    "payouts_enabled" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'payouts_enabled'::"text"))::boolean) STORED,
    "details_submitted" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'details_submitted'::"text"))::boolean) STORED,
    "country" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'country'::"text")) STORED,
    "default_currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'default_currency'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "api_key_hashes" "text"[] DEFAULT '{}'::"text"[],
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."active_entitlements" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "feature" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'feature'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "lookup_key" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'lookup_key'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."active_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."charges" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "paid" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'paid'::"text"))::boolean) STORED,
    "order" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'order'::"text")) STORED,
    "amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount'::"text"))::bigint) STORED,
    "review" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'review'::"text")) STORED,
    "source" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'source'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "dispute" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'dispute'::"text")) STORED,
    "invoice" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'invoice'::"text")) STORED,
    "outcome" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'outcome'::"text")) STORED,
    "refunds" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'refunds'::"text")) STORED,
    "updated" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'updated'::"text"))::integer) STORED,
    "captured" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'captured'::"text"))::boolean) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "refunded" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'refunded'::"text"))::boolean) STORED,
    "shipping" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping'::"text")) STORED,
    "application" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'application'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "destination" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'destination'::"text")) STORED,
    "failure_code" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'failure_code'::"text")) STORED,
    "on_behalf_of" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'on_behalf_of'::"text")) STORED,
    "fraud_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'fraud_details'::"text")) STORED,
    "receipt_email" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'receipt_email'::"text")) STORED,
    "payment_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_intent'::"text")) STORED,
    "receipt_number" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'receipt_number'::"text")) STORED,
    "transfer_group" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'transfer_group'::"text")) STORED,
    "amount_refunded" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_refunded'::"text"))::bigint) STORED,
    "application_fee" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'application_fee'::"text")) STORED,
    "failure_message" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'failure_message'::"text")) STORED,
    "source_transfer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'source_transfer'::"text")) STORED,
    "balance_transaction" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'balance_transaction'::"text")) STORED,
    "statement_descriptor" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_descriptor'::"text")) STORED,
    "payment_method_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'payment_method_details'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."checkout_session_line_items" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "price" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'price'::"text")) STORED,
    "quantity" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'quantity'::"text"))::integer) STORED,
    "checkout_session" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'checkout_session'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "amount_discount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_discount'::"text"))::bigint) STORED,
    "amount_subtotal" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_subtotal'::"text"))::bigint) STORED,
    "amount_tax" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_tax'::"text"))::bigint) STORED,
    "amount_total" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_total'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."checkout_session_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."checkout_sessions" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "adaptive_pricing" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'adaptive_pricing'::"text")) STORED,
    "after_expiration" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'after_expiration'::"text")) STORED,
    "allow_promotion_codes" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'allow_promotion_codes'::"text"))::boolean) STORED,
    "automatic_tax" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'automatic_tax'::"text")) STORED,
    "billing_address_collection" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'billing_address_collection'::"text")) STORED,
    "cancel_url" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'cancel_url'::"text")) STORED,
    "client_reference_id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'client_reference_id'::"text")) STORED,
    "client_secret" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'client_secret'::"text")) STORED,
    "collected_information" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'collected_information'::"text")) STORED,
    "consent" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'consent'::"text")) STORED,
    "consent_collection" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'consent_collection'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "currency_conversion" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'currency_conversion'::"text")) STORED,
    "custom_fields" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'custom_fields'::"text")) STORED,
    "custom_text" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'custom_text'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "customer_creation" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer_creation'::"text")) STORED,
    "customer_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'customer_details'::"text")) STORED,
    "customer_email" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer_email'::"text")) STORED,
    "discounts" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'discounts'::"text")) STORED,
    "expires_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'expires_at'::"text"))::integer) STORED,
    "invoice" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'invoice'::"text")) STORED,
    "invoice_creation" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'invoice_creation'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "locale" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'locale'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "mode" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'mode'::"text")) STORED,
    "optional_items" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'optional_items'::"text")) STORED,
    "payment_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_intent'::"text")) STORED,
    "payment_link" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_link'::"text")) STORED,
    "payment_method_collection" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_method_collection'::"text")) STORED,
    "payment_method_configuration_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'payment_method_configuration_details'::"text")) STORED,
    "payment_method_options" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'payment_method_options'::"text")) STORED,
    "payment_method_types" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'payment_method_types'::"text")) STORED,
    "payment_status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_status'::"text")) STORED,
    "permissions" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'permissions'::"text")) STORED,
    "phone_number_collection" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'phone_number_collection'::"text")) STORED,
    "presentment_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'presentment_details'::"text")) STORED,
    "recovered_from" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'recovered_from'::"text")) STORED,
    "redirect_on_completion" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'redirect_on_completion'::"text")) STORED,
    "return_url" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'return_url'::"text")) STORED,
    "saved_payment_method_options" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'saved_payment_method_options'::"text")) STORED,
    "setup_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'setup_intent'::"text")) STORED,
    "shipping_address_collection" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping_address_collection'::"text")) STORED,
    "shipping_cost" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping_cost'::"text")) STORED,
    "shipping_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping_details'::"text")) STORED,
    "shipping_options" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping_options'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "submit_type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'submit_type'::"text")) STORED,
    "subscription" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'subscription'::"text")) STORED,
    "success_url" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'success_url'::"text")) STORED,
    "tax_id_collection" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'tax_id_collection'::"text")) STORED,
    "total_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'total_details'::"text")) STORED,
    "ui_mode" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'ui_mode'::"text")) STORED,
    "url" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'url'::"text")) STORED,
    "wallet_options" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'wallet_options'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "amount_subtotal" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_subtotal'::"text"))::bigint) STORED,
    "amount_total" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_total'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."checkout_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."coupons" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "name" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'name'::"text")) STORED,
    "valid" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'valid'::"text"))::boolean) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "updated" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'updated'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "duration" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'duration'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "redeem_by" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'redeem_by'::"text"))::integer) STORED,
    "amount_off" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_off'::"text"))::bigint) STORED,
    "percent_off" double precision GENERATED ALWAYS AS ((("_raw_data" ->> 'percent_off'::"text"))::double precision) STORED,
    "times_redeemed" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'times_redeemed'::"text"))::bigint) STORED,
    "max_redemptions" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'max_redemptions'::"text"))::bigint) STORED,
    "duration_in_months" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'duration_in_months'::"text"))::bigint) STORED,
    "percent_off_precise" double precision GENERATED ALWAYS AS ((("_raw_data" ->> 'percent_off_precise'::"text"))::double precision) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."credit_notes" (
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "customer_balance_transaction" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer_balance_transaction'::"text")) STORED,
    "discount_amounts" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'discount_amounts'::"text")) STORED,
    "invoice" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'invoice'::"text")) STORED,
    "lines" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'lines'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "memo" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'memo'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "number" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'number'::"text")) STORED,
    "pdf" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'pdf'::"text")) STORED,
    "reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'reason'::"text")) STORED,
    "refund" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'refund'::"text")) STORED,
    "shipping_cost" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping_cost'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "tax_amounts" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'tax_amounts'::"text")) STORED,
    "type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'type'::"text")) STORED,
    "voided_at" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'voided_at'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount'::"text"))::bigint) STORED,
    "amount_shipping" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_shipping'::"text"))::bigint) STORED,
    "discount_amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'discount_amount'::"text"))::bigint) STORED,
    "out_of_band_amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'out_of_band_amount'::"text"))::bigint) STORED,
    "subtotal" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'subtotal'::"text"))::bigint) STORED,
    "subtotal_excluding_tax" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'subtotal_excluding_tax'::"text"))::bigint) STORED,
    "total" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'total'::"text"))::bigint) STORED,
    "total_excluding_tax" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'total_excluding_tax'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."credit_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."customers" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "address" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'address'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "email" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'email'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "name" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'name'::"text")) STORED,
    "phone" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'phone'::"text")) STORED,
    "shipping" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "default_source" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'default_source'::"text")) STORED,
    "delinquent" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'delinquent'::"text"))::boolean) STORED,
    "discount" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'discount'::"text")) STORED,
    "invoice_prefix" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'invoice_prefix'::"text")) STORED,
    "invoice_settings" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'invoice_settings'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "next_invoice_sequence" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'next_invoice_sequence'::"text"))::integer) STORED,
    "preferred_locales" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'preferred_locales'::"text")) STORED,
    "tax_exempt" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'tax_exempt'::"text")) STORED,
    "deleted" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'deleted'::"text"))::boolean) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "balance" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'balance'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."disputes" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount'::"text"))::bigint) STORED,
    "charge" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'charge'::"text")) STORED,
    "reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'reason'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "updated" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'updated'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "evidence" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'evidence'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "evidence_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'evidence_details'::"text")) STORED,
    "balance_transactions" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'balance_transactions'::"text")) STORED,
    "is_charge_refundable" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'is_charge_refundable'::"text"))::boolean) STORED,
    "payment_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_intent'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."early_fraud_warnings" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "actionable" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'actionable'::"text"))::boolean) STORED,
    "charge" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'charge'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "fraud_type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'fraud_type'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "payment_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_intent'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."early_fraud_warnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."events" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "data" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'data'::"text")) STORED,
    "type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'type'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "request" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'request'::"text")) STORED,
    "updated" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'updated'::"text"))::integer) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "api_version" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'api_version'::"text")) STORED,
    "pending_webhooks" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'pending_webhooks'::"text"))::bigint) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."exchange_rates_from_usd" (
    "_raw_data" "jsonb" NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_updated_at" timestamp with time zone DEFAULT "now"(),
    "_account_id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "sell_currency" "text" NOT NULL,
    "buy_currency_exchange_rates" "text" GENERATED ALWAYS AS (NULLIF(("_raw_data" ->> 'buy_currency_exchange_rates'::"text"), ''::"text")) STORED
);


ALTER TABLE "stripe"."exchange_rates_from_usd" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."features" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "name" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'name'::"text")) STORED,
    "lookup_key" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'lookup_key'::"text")) STORED,
    "active" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'active'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."invoices" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "auto_advance" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'auto_advance'::"text"))::boolean) STORED,
    "collection_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'collection_method'::"text")) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "hosted_invoice_url" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'hosted_invoice_url'::"text")) STORED,
    "lines" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'lines'::"text")) STORED,
    "period_end" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'period_end'::"text"))::integer) STORED,
    "period_start" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'period_start'::"text"))::integer) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "total" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'total'::"text"))::bigint) STORED,
    "account_country" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'account_country'::"text")) STORED,
    "account_name" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'account_name'::"text")) STORED,
    "account_tax_ids" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'account_tax_ids'::"text")) STORED,
    "amount_due" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_due'::"text"))::bigint) STORED,
    "amount_paid" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_paid'::"text"))::bigint) STORED,
    "amount_remaining" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_remaining'::"text"))::bigint) STORED,
    "application_fee_amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'application_fee_amount'::"text"))::bigint) STORED,
    "attempt_count" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'attempt_count'::"text"))::integer) STORED,
    "attempted" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'attempted'::"text"))::boolean) STORED,
    "billing_reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'billing_reason'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "custom_fields" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'custom_fields'::"text")) STORED,
    "customer_address" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'customer_address'::"text")) STORED,
    "customer_email" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer_email'::"text")) STORED,
    "customer_name" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer_name'::"text")) STORED,
    "customer_phone" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer_phone'::"text")) STORED,
    "customer_shipping" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'customer_shipping'::"text")) STORED,
    "customer_tax_exempt" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer_tax_exempt'::"text")) STORED,
    "customer_tax_ids" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'customer_tax_ids'::"text")) STORED,
    "default_tax_rates" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'default_tax_rates'::"text")) STORED,
    "discount" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'discount'::"text")) STORED,
    "discounts" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'discounts'::"text")) STORED,
    "due_date" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'due_date'::"text"))::integer) STORED,
    "footer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'footer'::"text")) STORED,
    "invoice_pdf" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'invoice_pdf'::"text")) STORED,
    "last_finalization_error" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'last_finalization_error'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "next_payment_attempt" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'next_payment_attempt'::"text"))::integer) STORED,
    "number" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'number'::"text")) STORED,
    "paid" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'paid'::"text"))::boolean) STORED,
    "payment_settings" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'payment_settings'::"text")) STORED,
    "receipt_number" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'receipt_number'::"text")) STORED,
    "statement_descriptor" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_descriptor'::"text")) STORED,
    "status_transitions" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'status_transitions'::"text")) STORED,
    "total_discount_amounts" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'total_discount_amounts'::"text")) STORED,
    "total_tax_amounts" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'total_tax_amounts'::"text")) STORED,
    "transfer_data" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'transfer_data'::"text")) STORED,
    "webhooks_delivered_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'webhooks_delivered_at'::"text"))::integer) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "subscription" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'subscription'::"text")) STORED,
    "payment_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_intent'::"text")) STORED,
    "default_payment_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'default_payment_method'::"text")) STORED,
    "default_source" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'default_source'::"text")) STORED,
    "on_behalf_of" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'on_behalf_of'::"text")) STORED,
    "charge" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'charge'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "ending_balance" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'ending_balance'::"text"))::bigint) STORED,
    "starting_balance" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'starting_balance'::"text"))::bigint) STORED,
    "subtotal" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'subtotal'::"text"))::bigint) STORED,
    "tax" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'tax'::"text"))::bigint) STORED,
    "post_payment_credit_notes_amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'post_payment_credit_notes_amount'::"text"))::bigint) STORED,
    "pre_payment_credit_notes_amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'pre_payment_credit_notes_amount'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."payment_intents" (
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "amount_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'amount_details'::"text")) STORED,
    "application" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'application'::"text")) STORED,
    "automatic_payment_methods" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'automatic_payment_methods'::"text")) STORED,
    "canceled_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'canceled_at'::"text"))::integer) STORED,
    "cancellation_reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'cancellation_reason'::"text")) STORED,
    "capture_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'capture_method'::"text")) STORED,
    "client_secret" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'client_secret'::"text")) STORED,
    "confirmation_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'confirmation_method'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "invoice" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'invoice'::"text")) STORED,
    "last_payment_error" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'last_payment_error'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "next_action" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'next_action'::"text")) STORED,
    "on_behalf_of" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'on_behalf_of'::"text")) STORED,
    "payment_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_method'::"text")) STORED,
    "payment_method_options" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'payment_method_options'::"text")) STORED,
    "payment_method_types" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'payment_method_types'::"text")) STORED,
    "processing" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'processing'::"text")) STORED,
    "receipt_email" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'receipt_email'::"text")) STORED,
    "review" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'review'::"text")) STORED,
    "setup_future_usage" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'setup_future_usage'::"text")) STORED,
    "shipping" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'shipping'::"text")) STORED,
    "statement_descriptor" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_descriptor'::"text")) STORED,
    "statement_descriptor_suffix" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_descriptor_suffix'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "transfer_data" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'transfer_data'::"text")) STORED,
    "transfer_group" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'transfer_group'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount'::"text"))::bigint) STORED,
    "amount_capturable" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_capturable'::"text"))::bigint) STORED,
    "amount_received" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_received'::"text"))::bigint) STORED,
    "application_fee_amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'application_fee_amount'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."payment_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."payment_methods" (
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'type'::"text")) STORED,
    "billing_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'billing_details'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "card" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'card'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."payouts" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "date" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'date'::"text")) STORED,
    "type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'type'::"text")) STORED,
    "amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount'::"text"))::bigint) STORED,
    "method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'method'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "updated" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'updated'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "automatic" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'automatic'::"text"))::boolean) STORED,
    "recipient" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'recipient'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "destination" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'destination'::"text")) STORED,
    "source_type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'source_type'::"text")) STORED,
    "arrival_date" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'arrival_date'::"text")) STORED,
    "bank_account" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'bank_account'::"text")) STORED,
    "failure_code" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'failure_code'::"text")) STORED,
    "transfer_group" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'transfer_group'::"text")) STORED,
    "amount_reversed" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount_reversed'::"text"))::bigint) STORED,
    "failure_message" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'failure_message'::"text")) STORED,
    "source_transaction" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'source_transaction'::"text")) STORED,
    "balance_transaction" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'balance_transaction'::"text")) STORED,
    "statement_descriptor" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_descriptor'::"text")) STORED,
    "statement_description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_description'::"text")) STORED,
    "failure_balance_transaction" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'failure_balance_transaction'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."plans" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "name" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'name'::"text")) STORED,
    "tiers" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'tiers'::"text")) STORED,
    "active" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'active'::"text"))::boolean) STORED,
    "amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount'::"text"))::bigint) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "product" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'product'::"text")) STORED,
    "updated" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'updated'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "interval" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'interval'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "nickname" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'nickname'::"text")) STORED,
    "tiers_mode" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'tiers_mode'::"text")) STORED,
    "usage_type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'usage_type'::"text")) STORED,
    "billing_scheme" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'billing_scheme'::"text")) STORED,
    "interval_count" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'interval_count'::"text"))::bigint) STORED,
    "aggregate_usage" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'aggregate_usage'::"text")) STORED,
    "transform_usage" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'transform_usage'::"text")) STORED,
    "trial_period_days" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'trial_period_days'::"text"))::bigint) STORED,
    "statement_descriptor" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_descriptor'::"text")) STORED,
    "statement_description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_description'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."prices" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "active" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'active'::"text"))::boolean) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "nickname" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'nickname'::"text")) STORED,
    "recurring" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'recurring'::"text")) STORED,
    "type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'type'::"text")) STORED,
    "billing_scheme" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'billing_scheme'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "lookup_key" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'lookup_key'::"text")) STORED,
    "tiers_mode" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'tiers_mode'::"text")) STORED,
    "transform_quantity" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'transform_quantity'::"text")) STORED,
    "unit_amount_decimal" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'unit_amount_decimal'::"text")) STORED,
    "product" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'product'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "unit_amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'unit_amount'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."products" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "active" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'active'::"text"))::boolean) STORED,
    "default_price" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'default_price'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "name" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'name'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "images" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'images'::"text")) STORED,
    "marketing_features" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'marketing_features'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "package_dimensions" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'package_dimensions'::"text")) STORED,
    "shippable" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'shippable'::"text"))::boolean) STORED,
    "statement_descriptor" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'statement_descriptor'::"text")) STORED,
    "unit_label" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'unit_label'::"text")) STORED,
    "updated" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'updated'::"text"))::integer) STORED,
    "url" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'url'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."refunds" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "balance_transaction" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'balance_transaction'::"text")) STORED,
    "charge" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'charge'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "currency" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'currency'::"text")) STORED,
    "destination_details" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'destination_details'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "payment_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_intent'::"text")) STORED,
    "reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'reason'::"text")) STORED,
    "receipt_number" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'receipt_number'::"text")) STORED,
    "source_transfer_reversal" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'source_transfer_reversal'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "transfer_reversal" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'transfer_reversal'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL,
    "amount" bigint GENERATED ALWAYS AS ((("_raw_data" ->> 'amount'::"text"))::bigint) STORED
);


ALTER TABLE "stripe"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."reviews" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "billing_zip" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'billing_zip'::"text")) STORED,
    "charge" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'charge'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "closed_reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'closed_reason'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "ip_address" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'ip_address'::"text")) STORED,
    "ip_address_location" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'ip_address_location'::"text")) STORED,
    "open" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'open'::"text"))::boolean) STORED,
    "opened_reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'opened_reason'::"text")) STORED,
    "payment_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_intent'::"text")) STORED,
    "reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'reason'::"text")) STORED,
    "session" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'session'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."setup_intents" (
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "description" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'description'::"text")) STORED,
    "payment_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'payment_method'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "usage" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'usage'::"text")) STORED,
    "cancellation_reason" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'cancellation_reason'::"text")) STORED,
    "latest_attempt" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'latest_attempt'::"text")) STORED,
    "mandate" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'mandate'::"text")) STORED,
    "single_use_mandate" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'single_use_mandate'::"text")) STORED,
    "on_behalf_of" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'on_behalf_of'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."setup_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."subscription_item_change_events_v2_beta" (
    "_raw_data" "jsonb" NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_updated_at" timestamp with time zone DEFAULT "now"(),
    "_account_id" "text" NOT NULL,
    "event_timestamp" timestamp with time zone NOT NULL,
    "event_type" "text" NOT NULL,
    "subscription_item_id" "text" NOT NULL,
    "currency" "text" GENERATED ALWAYS AS (NULLIF(("_raw_data" ->> 'currency'::"text"), ''::"text")) STORED,
    "mrr_change" bigint GENERATED ALWAYS AS ((NULLIF(("_raw_data" ->> 'mrr_change'::"text"), ''::"text"))::bigint) STORED,
    "quantity_change" bigint GENERATED ALWAYS AS ((NULLIF(("_raw_data" ->> 'quantity_change'::"text"), ''::"text"))::bigint) STORED,
    "subscription_id" "text" GENERATED ALWAYS AS (NULLIF(("_raw_data" ->> 'subscription_id'::"text"), ''::"text")) STORED,
    "customer_id" "text" GENERATED ALWAYS AS (NULLIF(("_raw_data" ->> 'customer_id'::"text"), ''::"text")) STORED,
    "price_id" "text" GENERATED ALWAYS AS (NULLIF(("_raw_data" ->> 'price_id'::"text"), ''::"text")) STORED,
    "product_id" "text" GENERATED ALWAYS AS (NULLIF(("_raw_data" ->> 'product_id'::"text"), ''::"text")) STORED,
    "local_event_timestamp" "text" GENERATED ALWAYS AS (NULLIF(("_raw_data" ->> 'local_event_timestamp'::"text"), ''::"text")) STORED
);


ALTER TABLE "stripe"."subscription_item_change_events_v2_beta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."subscription_items" (
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "billing_thresholds" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'billing_thresholds'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "deleted" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'deleted'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "quantity" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'quantity'::"text"))::integer) STORED,
    "price" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'price'::"text")) STORED,
    "subscription" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'subscription'::"text")) STORED,
    "tax_rates" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'tax_rates'::"text")) STORED,
    "current_period_end" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'current_period_end'::"text"))::integer) STORED,
    "current_period_start" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'current_period_start'::"text"))::integer) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."subscription_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."subscription_schedules" (
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "application" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'application'::"text")) STORED,
    "canceled_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'canceled_at'::"text"))::integer) STORED,
    "completed_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'completed_at'::"text"))::integer) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "current_phase" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'current_phase'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "default_settings" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'default_settings'::"text")) STORED,
    "end_behavior" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'end_behavior'::"text")) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "phases" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'phases'::"text")) STORED,
    "released_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'released_at'::"text"))::integer) STORED,
    "released_subscription" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'released_subscription'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "subscription" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'subscription'::"text")) STORED,
    "test_clock" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'test_clock'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."subscription_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."subscriptions" (
    "_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "cancel_at_period_end" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'cancel_at_period_end'::"text"))::boolean) STORED,
    "current_period_end" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'current_period_end'::"text"))::integer) STORED,
    "current_period_start" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'current_period_start'::"text"))::integer) STORED,
    "default_payment_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'default_payment_method'::"text")) STORED,
    "items" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'items'::"text")) STORED,
    "metadata" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'metadata'::"text")) STORED,
    "pending_setup_intent" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'pending_setup_intent'::"text")) STORED,
    "pending_update" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'pending_update'::"text")) STORED,
    "status" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'status'::"text")) STORED,
    "application_fee_percent" double precision GENERATED ALWAYS AS ((("_raw_data" ->> 'application_fee_percent'::"text"))::double precision) STORED,
    "billing_cycle_anchor" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'billing_cycle_anchor'::"text"))::integer) STORED,
    "billing_thresholds" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'billing_thresholds'::"text")) STORED,
    "cancel_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'cancel_at'::"text"))::integer) STORED,
    "canceled_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'canceled_at'::"text"))::integer) STORED,
    "collection_method" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'collection_method'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "days_until_due" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'days_until_due'::"text"))::integer) STORED,
    "default_source" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'default_source'::"text")) STORED,
    "default_tax_rates" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'default_tax_rates'::"text")) STORED,
    "discount" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'discount'::"text")) STORED,
    "ended_at" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'ended_at'::"text"))::integer) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "next_pending_invoice_item_invoice" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'next_pending_invoice_item_invoice'::"text"))::integer) STORED,
    "pause_collection" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'pause_collection'::"text")) STORED,
    "pending_invoice_item_interval" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'pending_invoice_item_interval'::"text")) STORED,
    "start_date" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'start_date'::"text"))::integer) STORED,
    "transfer_data" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'transfer_data'::"text")) STORED,
    "trial_end" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'trial_end'::"text")) STORED,
    "trial_start" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'trial_start'::"text")) STORED,
    "schedule" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'schedule'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "latest_invoice" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'latest_invoice'::"text")) STORED,
    "plan" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'plan'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."subscriptions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "stripe"."sync_runs" AS
 SELECT "r"."_account_id" AS "account_id",
    "r"."started_at",
    "r"."closed_at",
    "r"."triggered_by",
    "r"."max_concurrent",
    COALESCE("sum"("o"."processed_count"), (0)::bigint) AS "total_processed",
    "count"("o".*) AS "total_objects",
    "count"(*) FILTER (WHERE ("o"."status" = 'complete'::"text")) AS "complete_count",
    "count"(*) FILTER (WHERE ("o"."status" = 'error'::"text")) AS "error_count",
    "count"(*) FILTER (WHERE ("o"."status" = 'running'::"text")) AS "running_count",
    "count"(*) FILTER (WHERE ("o"."status" = 'pending'::"text")) AS "pending_count",
    "string_agg"("o"."error_message", '; '::"text") FILTER (WHERE ("o"."error_message" IS NOT NULL)) AS "error_message",
        CASE
            WHEN (("r"."closed_at" IS NULL) AND ("count"(*) FILTER (WHERE ("o"."status" = 'running'::"text")) > 0)) THEN 'running'::"text"
            WHEN (("r"."closed_at" IS NULL) AND (("count"("o".*) = 0) OR ("count"("o".*) = "count"(*) FILTER (WHERE ("o"."status" = 'pending'::"text"))))) THEN 'pending'::"text"
            WHEN ("r"."closed_at" IS NULL) THEN 'running'::"text"
            WHEN ("count"(*) FILTER (WHERE ("o"."status" = 'error'::"text")) > 0) THEN 'error'::"text"
            ELSE 'complete'::"text"
        END AS "status"
   FROM ("stripe"."_sync_runs" "r"
     LEFT JOIN "stripe"."_sync_obj_runs" "o" ON ((("o"."_account_id" = "r"."_account_id") AND ("o"."run_started_at" = "r"."started_at"))))
  GROUP BY "r"."_account_id", "r"."started_at", "r"."closed_at", "r"."triggered_by", "r"."max_concurrent";


ALTER VIEW "stripe"."sync_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stripe"."tax_ids" (
    "_last_synced_at" timestamp with time zone,
    "_raw_data" "jsonb",
    "_account_id" "text" NOT NULL,
    "object" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'object'::"text")) STORED,
    "country" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'country'::"text")) STORED,
    "customer" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'customer'::"text")) STORED,
    "type" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'type'::"text")) STORED,
    "value" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'value'::"text")) STORED,
    "created" integer GENERATED ALWAYS AS ((("_raw_data" ->> 'created'::"text"))::integer) STORED,
    "livemode" boolean GENERATED ALWAYS AS ((("_raw_data" ->> 'livemode'::"text"))::boolean) STORED,
    "owner" "jsonb" GENERATED ALWAYS AS (("_raw_data" -> 'owner'::"text")) STORED,
    "id" "text" GENERATED ALWAYS AS (("_raw_data" ->> 'id'::"text")) STORED NOT NULL
);


ALTER TABLE "stripe"."tax_ids" OWNER TO "postgres";


ALTER TABLE ONLY "marketing"."leads"
    ADD CONSTRAINT "Leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "marketing"."architect_leads"
    ADD CONSTRAINT "architect_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "marketing"."ig_posts"
    ADD CONSTRAINT "ig_posts_pkey" PRIMARY KEY ("blog_id");



ALTER TABLE ONLY "marketing"."leads"
    ADD CONSTRAINT "leads_lead_id_key" UNIQUE ("lead_id");



ALTER TABLE ONLY "marketing"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("passcode");



ALTER TABLE ONLY "marketing"."requirements"
    ADD CONSTRAINT "requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "marketing"."stacks"
    ADD CONSTRAINT "stacks_name_key" UNIQUE ("name");



ALTER TABLE ONLY "marketing"."stacks"
    ADD CONSTRAINT "stacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("chat_id", "user_id");



ALTER TABLE ONLY "portal"."chats"
    ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "portal"."cycle_metrics"
    ADD CONSTRAINT "cycle_metrics_customer_id_project_id_cycle_id_key" UNIQUE ("customer_id", "project_id", "cycle_id");



ALTER TABLE ONLY "portal"."cycle_metrics"
    ADD CONSTRAINT "cycle_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."data_sources"
    ADD CONSTRAINT "data_sources_customer_id_name_key" UNIQUE ("customer_id", "name");



ALTER TABLE ONLY "portal"."data_sources"
    ADD CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."decisions"
    ADD CONSTRAINT "decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."demo_video_comments"
    ADD CONSTRAINT "demo_video_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."demo_videos"
    ADD CONSTRAINT "demo_videos_issue_id_version_key" UNIQUE ("issue_id", "version");



ALTER TABLE ONLY "portal"."demo_videos"
    ADD CONSTRAINT "demo_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."design_resources"
    ADD CONSTRAINT "design_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."developers"
    ADD CONSTRAINT "developers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."developers"
    ADD CONSTRAINT "developers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "portal"."diagrams"
    ADD CONSTRAINT "diagrams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."diagrams"
    ADD CONSTRAINT "diagrams_service_id_version_key" UNIQUE ("service_id", "version");



ALTER TABLE ONLY "portal"."document_permissions"
    ADD CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."document_requests"
    ADD CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."dora_branch_events"
    ADD CONSTRAINT "dora_branch_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."dora_branch_events"
    ADD CONSTRAINT "dora_branch_events_repo_branch_name_key" UNIQUE ("repo", "branch_name");



ALTER TABLE ONLY "portal"."dora_metrics"
    ADD CONSTRAINT "dora_metrics_pkey" PRIMARY KEY ("dorametrics_id");



ALTER TABLE ONLY "portal"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."hours_logged"
    ADD CONSTRAINT "hours_logged_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."issue_metrics"
    ADD CONSTRAINT "issue_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."issue_requests"
    ADD CONSTRAINT "issue_requests_pkey" PRIMARY KEY ("issue_id");



ALTER TABLE ONLY "portal"."issue_updates"
    ADD CONSTRAINT "issue_updates_pkey" PRIMARY KEY ("issue_id");



ALTER TABLE ONLY "portal"."issue_vectors"
    ADD CONSTRAINT "issue_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."issue_views"
    ADD CONSTRAINT "issue_views_pkey" PRIMARY KEY ("issue_id", "user_id");



ALTER TABLE ONLY "portal"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."milestone_cycle_snapshots"
    ADD CONSTRAINT "milestone_cycle_snapshots_pkey" PRIMARY KEY ("milestone_id", "cycle_id");



ALTER TABLE ONLY "portal"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."pinned_panels"
    ADD CONSTRAINT "pinned_panels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."pinned_panels"
    ADD CONSTRAINT "pinned_panels_user_id_panel_id_key" UNIQUE ("user_id", "panel_id");



ALTER TABLE ONLY "portal"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."services"
    ADD CONSTRAINT "services_project_slug_name_key" UNIQUE ("project_slug", "name");



ALTER TABLE ONLY "portal"."suggested_features"
    ADD CONSTRAINT "suggested_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."test_executions"
    ADD CONSTRAINT "test_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."tests_legacy"
    ADD CONSTRAINT "tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."tests"
    ADD CONSTRAINT "tests_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portal"."vector_sync_state"
    ADD CONSTRAINT "vector_sync_state_pkey" PRIMARY KEY ("linear_slug");



ALTER TABLE ONLY "portaldev"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "portaldev"."cycle_metrics"
    ADD CONSTRAINT "cycle_metrics_customer_id_project_id_cycle_id_key" UNIQUE ("customer_id", "project_id", "cycle_id");



ALTER TABLE ONLY "portaldev"."cycle_metrics"
    ADD CONSTRAINT "cycle_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."decisions"
    ADD CONSTRAINT "decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."developers"
    ADD CONSTRAINT "developers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."developers"
    ADD CONSTRAINT "developers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "portaldev"."diagrams"
    ADD CONSTRAINT "diagrams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."diagrams"
    ADD CONSTRAINT "diagrams_service_id_version_key" UNIQUE ("service_id", "version");



ALTER TABLE ONLY "portaldev"."document_permissions"
    ADD CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."document_requests"
    ADD CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."dora_metrics"
    ADD CONSTRAINT "dora_metrics_pkey" PRIMARY KEY ("dorametrics_id");



ALTER TABLE ONLY "portaldev"."issue_metrics"
    ADD CONSTRAINT "issue_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."issue_updates"
    ADD CONSTRAINT "issue_updates_pkey" PRIMARY KEY ("issue_id");



ALTER TABLE ONLY "portaldev"."pinned_panels"
    ADD CONSTRAINT "pinned_panels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."pinned_panels"
    ADD CONSTRAINT "pinned_panels_user_id_panel_id_key" UNIQUE ("user_id", "panel_id");



ALTER TABLE ONLY "portaldev"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."services"
    ADD CONSTRAINT "services_project_slug_name_key" UNIQUE ("project_slug", "name");



ALTER TABLE ONLY "portaldev"."tests"
    ADD CONSTRAINT "tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "portaldev"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."_migrations"
    ADD CONSTRAINT "_migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "stripe"."_migrations"
    ADD CONSTRAINT "_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."_sync_obj_runs"
    ADD CONSTRAINT "_sync_obj_run_pkey" PRIMARY KEY ("_account_id", "run_started_at", "object");



ALTER TABLE ONLY "stripe"."_sync_runs"
    ADD CONSTRAINT "_sync_run_pkey" PRIMARY KEY ("_account_id", "started_at");



ALTER TABLE ONLY "stripe"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."active_entitlements"
    ADD CONSTRAINT "active_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."charges"
    ADD CONSTRAINT "charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."checkout_session_line_items"
    ADD CONSTRAINT "checkout_session_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."credit_notes"
    ADD CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."disputes"
    ADD CONSTRAINT "disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."early_fraud_warnings"
    ADD CONSTRAINT "early_fraud_warnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."exchange_rates_from_usd"
    ADD CONSTRAINT "exchange_rates_from_usd_pkey" PRIMARY KEY ("_account_id", "date", "sell_currency");



ALTER TABLE ONLY "stripe"."features"
    ADD CONSTRAINT "features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."_managed_webhooks"
    ADD CONSTRAINT "managed_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."_managed_webhooks"
    ADD CONSTRAINT "managed_webhooks_url_account_unique" UNIQUE ("url", "account_id");



ALTER TABLE ONLY "stripe"."_sync_runs"
    ADD CONSTRAINT "one_active_run_per_account" EXCLUDE USING "btree" ("_account_id" WITH =) WHERE (("closed_at" IS NULL));



ALTER TABLE ONLY "stripe"."payment_intents"
    ADD CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."prices"
    ADD CONSTRAINT "prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."setup_intents"
    ADD CONSTRAINT "setup_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."subscription_item_change_events_v2_beta"
    ADD CONSTRAINT "subscription_item_change_events_v2_beta_pkey" PRIMARY KEY ("_account_id", "event_timestamp", "event_type", "subscription_item_id");



ALTER TABLE ONLY "stripe"."subscription_items"
    ADD CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."subscription_schedules"
    ADD CONSTRAINT "subscription_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stripe"."tax_ids"
    ADD CONSTRAINT "tax_ids_pkey" PRIMARY KEY ("id");



CREATE INDEX "architect_leads_email_idx" ON "marketing"."architect_leads" USING "btree" ("email");



CREATE INDEX "data_sources_customer_id_idx" ON "portal"."data_sources" USING "btree" ("customer_id");



CREATE INDEX "diagrams_issue_id_idx" ON "portal"."diagrams" USING "btree" ("issue_id");



CREATE INDEX "diagrams_service_id_idx" ON "portal"."diagrams" USING "btree" ("service_id");



CREATE INDEX "dora_branch_events_linear_issue_id_idx" ON "portal"."dora_branch_events" USING "btree" ("linear_issue_id");



CREATE INDEX "idx_chat_participants_user_id" ON "portal"."chat_participants" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_chats_issue_id_unique" ON "portal"."chats" USING "btree" ("issue_id") WHERE ("type" = 'issue'::"text");



CREATE INDEX "idx_chats_project_slug" ON "portal"."chats" USING "btree" ("project_slug");



CREATE INDEX "idx_design_resources_created_at" ON "portal"."design_resources" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_design_resources_issue_id" ON "portal"."design_resources" USING "btree" ("issue_id");



CREATE INDEX "idx_design_resources_project_slug" ON "portal"."design_resources" USING "btree" ("project_slug");



CREATE INDEX "idx_documents_embedding" ON "portal"."documents" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_events_thread_issue" ON "portal"."events" USING "btree" ("object_type", "issue_id");



CREATE INDEX "idx_events_thread_object" ON "portal"."events" USING "btree" ("object_type", "object_id");



CREATE INDEX "idx_hours_logged_created_at" ON "portal"."hours_logged" USING "btree" ("created_at");



CREATE INDEX "idx_hours_logged_developer_id" ON "portal"."hours_logged" USING "btree" ("developer_id");



CREATE INDEX "idx_hours_logged_project_slug" ON "portal"."hours_logged" USING "btree" ("project_slug");



CREATE INDEX "idx_hours_logged_worked_on" ON "portal"."hours_logged" USING "btree" ("worked_on");



CREATE INDEX "idx_issue_vectors_combined_embedding" ON "portal"."issue_vectors" USING "hnsw" ("combined_embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_issue_vectors_project_slug" ON "portal"."issue_vectors" USING "btree" ("project_slug");



CREATE INDEX "idx_issue_vectors_title_embedding" ON "portal"."issue_vectors" USING "hnsw" ("title_embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_issue_views_user_id" ON "portal"."issue_views" USING "btree" ("user_id");



CREATE INDEX "idx_messages_chat_id_created_at" ON "portal"."messages" USING "btree" ("chat_id", "created_at");



CREATE INDEX "idx_messages_user_id" ON "portal"."messages" USING "btree" ("user_id");



CREATE INDEX "idx_milestone_cycle_snapshots_linear_slug" ON "portal"."milestone_cycle_snapshots" USING "btree" ("linear_slug");



CREATE INDEX "idx_notifications_user_unread" ON "portal"."notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("read" = false);



CREATE INDEX "idx_suggested_features_project_slug" ON "portal"."suggested_features" USING "btree" ("project_slug");



CREATE INDEX "idx_suggested_features_status" ON "portal"."suggested_features" USING "btree" ("status");



CREATE INDEX "idx_test_executions_issue_id" ON "portal"."test_executions" USING "btree" ("issue_id");



CREATE INDEX "idx_test_executions_test_id" ON "portal"."test_executions" USING "btree" ("test_id");



CREATE INDEX "idx_tests_embedding" ON "portal"."tests" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_tests_project_slug" ON "portal"."tests" USING "btree" ("project_slug");



CREATE INDEX "idx_tests_title_trgm" ON "portal"."tests" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "issue_metrics_unique" ON "portal"."issue_metrics" USING "btree" ("cycle_issue_id");



CREATE INDEX "diagrams_issue_id_idx" ON "portaldev"."diagrams" USING "btree" ("issue_id");



CREATE INDEX "diagrams_service_id_idx" ON "portaldev"."diagrams" USING "btree" ("service_id");



CREATE UNIQUE INDEX "issue_metrics_cycle_issue_id_idx" ON "portaldev"."issue_metrics" USING "btree" ("cycle_issue_id");



CREATE UNIQUE INDEX "active_entitlements_lookup_key_key" ON "stripe"."active_entitlements" USING "btree" ("lookup_key") WHERE ("lookup_key" IS NOT NULL);



CREATE UNIQUE INDEX "features_lookup_key_key" ON "stripe"."features" USING "btree" ("lookup_key") WHERE ("lookup_key" IS NOT NULL);



CREATE INDEX "idx_accounts_api_key_hashes" ON "stripe"."accounts" USING "gin" ("api_key_hashes");



CREATE INDEX "idx_accounts_business_name" ON "stripe"."accounts" USING "btree" ("business_name");



CREATE INDEX "idx_exchange_rates_from_usd_date" ON "stripe"."exchange_rates_from_usd" USING "btree" ("date");



CREATE INDEX "idx_exchange_rates_from_usd_sell_currency" ON "stripe"."exchange_rates_from_usd" USING "btree" ("sell_currency");



CREATE INDEX "idx_sync_obj_runs_status" ON "stripe"."_sync_obj_runs" USING "btree" ("_account_id", "run_started_at", "status");



CREATE INDEX "idx_sync_runs_account_status" ON "stripe"."_sync_runs" USING "btree" ("_account_id", "closed_at");



CREATE INDEX "stripe_active_entitlements_customer_idx" ON "stripe"."active_entitlements" USING "btree" ("customer");



CREATE INDEX "stripe_active_entitlements_feature_idx" ON "stripe"."active_entitlements" USING "btree" ("feature");



CREATE INDEX "stripe_checkout_session_line_items_price_idx" ON "stripe"."checkout_session_line_items" USING "btree" ("price");



CREATE INDEX "stripe_checkout_session_line_items_session_idx" ON "stripe"."checkout_session_line_items" USING "btree" ("checkout_session");



CREATE INDEX "stripe_checkout_sessions_customer_idx" ON "stripe"."checkout_sessions" USING "btree" ("customer");



CREATE INDEX "stripe_checkout_sessions_invoice_idx" ON "stripe"."checkout_sessions" USING "btree" ("invoice");



CREATE INDEX "stripe_checkout_sessions_payment_intent_idx" ON "stripe"."checkout_sessions" USING "btree" ("payment_intent");



CREATE INDEX "stripe_checkout_sessions_subscription_idx" ON "stripe"."checkout_sessions" USING "btree" ("subscription");



CREATE INDEX "stripe_credit_notes_customer_idx" ON "stripe"."credit_notes" USING "btree" ("customer");



CREATE INDEX "stripe_credit_notes_invoice_idx" ON "stripe"."credit_notes" USING "btree" ("invoice");



CREATE INDEX "stripe_dispute_created_idx" ON "stripe"."disputes" USING "btree" ("created");



CREATE INDEX "stripe_early_fraud_warnings_charge_idx" ON "stripe"."early_fraud_warnings" USING "btree" ("charge");



CREATE INDEX "stripe_early_fraud_warnings_payment_intent_idx" ON "stripe"."early_fraud_warnings" USING "btree" ("payment_intent");



CREATE INDEX "stripe_invoices_customer_idx" ON "stripe"."invoices" USING "btree" ("customer");



CREATE INDEX "stripe_invoices_subscription_idx" ON "stripe"."invoices" USING "btree" ("subscription");



CREATE INDEX "stripe_managed_webhooks_enabled_idx" ON "stripe"."_managed_webhooks" USING "btree" ("enabled");



CREATE INDEX "stripe_managed_webhooks_status_idx" ON "stripe"."_managed_webhooks" USING "btree" ("status");



CREATE INDEX "stripe_payment_intents_customer_idx" ON "stripe"."payment_intents" USING "btree" ("customer");



CREATE INDEX "stripe_payment_intents_invoice_idx" ON "stripe"."payment_intents" USING "btree" ("invoice");



CREATE INDEX "stripe_payment_methods_customer_idx" ON "stripe"."payment_methods" USING "btree" ("customer");



CREATE INDEX "stripe_refunds_charge_idx" ON "stripe"."refunds" USING "btree" ("charge");



CREATE INDEX "stripe_refunds_payment_intent_idx" ON "stripe"."refunds" USING "btree" ("payment_intent");



CREATE INDEX "stripe_reviews_charge_idx" ON "stripe"."reviews" USING "btree" ("charge");



CREATE INDEX "stripe_reviews_payment_intent_idx" ON "stripe"."reviews" USING "btree" ("payment_intent");



CREATE INDEX "stripe_setup_intents_customer_idx" ON "stripe"."setup_intents" USING "btree" ("customer");



CREATE INDEX "stripe_tax_ids_customer_idx" ON "stripe"."tax_ids" USING "btree" ("customer");



CREATE OR REPLACE TRIGGER "Make.com" AFTER INSERT OR UPDATE ON "marketing"."leads" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://hook.us2.make.com/t98uzsoqnogsx8ucwo34ignqfezcta5y', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "customers_delete_ticket_token" AFTER DELETE ON "portal"."customers" FOR EACH ROW EXECUTE FUNCTION "portal"."delete_customer_ticket_token"();



CREATE OR REPLACE TRIGGER "data_sources_delete_vault_secret" AFTER DELETE ON "portal"."data_sources" FOR EACH ROW EXECUTE FUNCTION "portal"."delete_data_source_vault_secret"();



CREATE OR REPLACE TRIGGER "data_sources_updated_at" BEFORE UPDATE ON "portal"."data_sources" FOR EACH ROW EXECUTE FUNCTION "portal"."touch_data_sources_updated_at"();



CREATE OR REPLACE TRIGGER "notify_chat_message" AFTER INSERT ON "portal"."messages" FOR EACH ROW EXECUTE FUNCTION "portal"."notify_chat_message"();



CREATE OR REPLACE TRIGGER "touch_chat_last_message_at" AFTER INSERT ON "portal"."messages" FOR EACH ROW EXECUTE FUNCTION "portal"."touch_chat_last_message_at"();



CREATE OR REPLACE TRIGGER "update_chats_updated_at" BEFORE UPDATE ON "portal"."chats" FOR EACH ROW EXECUTE FUNCTION "portal"."update_chats_updated_at"();



CREATE OR REPLACE TRIGGER "update_design_resources_updated_at" BEFORE UPDATE ON "portal"."design_resources" FOR EACH ROW EXECUTE FUNCTION "portal"."update_design_resources_updated_at"();



CREATE OR REPLACE TRIGGER "update_hours_logged_updated_at" BEFORE UPDATE ON "portal"."hours_logged" FOR EACH ROW EXECUTE FUNCTION "portal"."update_hours_logged_updated_at"();



CREATE OR REPLACE TRIGGER "update_suggested_features_updated_at" BEFORE UPDATE ON "portal"."suggested_features" FOR EACH ROW EXECUTE FUNCTION "portal"."update_suggested_features_updated_at"();



CREATE OR REPLACE TRIGGER "update_test_executions_updated_at" BEFORE UPDATE ON "portal"."test_executions" FOR EACH ROW EXECUTE FUNCTION "portal"."update_test_executions_updated_at"();



CREATE OR REPLACE TRIGGER "update_tests_updated_at" BEFORE UPDATE ON "portal"."tests" FOR EACH ROW EXECUTE FUNCTION "portal"."update_tests_updated_at"();



CREATE OR REPLACE TRIGGER "update_vector_sync_state_updated_at" BEFORE UPDATE ON "portal"."vector_sync_state" FOR EACH ROW EXECUTE FUNCTION "portal"."update_vector_sync_state_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."_managed_webhooks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_metadata"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."_sync_obj_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_metadata"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."_sync_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_metadata"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."active_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."charges" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."checkout_session_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."checkout_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."disputes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."early_fraud_warnings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."exchange_rates_from_usd" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."features" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."payouts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."prices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."refunds" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."subscription_item_change_events_v2_beta" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "stripe"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "marketing"."proposals"
    ADD CONSTRAINT "proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "marketing"."leads"("lead_id");



ALTER TABLE ONLY "marketing"."requirements"
    ADD CONSTRAINT "requirements_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "marketing"."proposals"("passcode");



ALTER TABLE ONLY "portal"."assignments"
    ADD CONSTRAINT "assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."chat_participants"
    ADD CONSTRAINT "chat_participants_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "portal"."chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "portal"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."chats"
    ADD CONSTRAINT "chats_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."data_sources"
    ADD CONSTRAINT "data_sources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "portal"."data_sources"
    ADD CONSTRAINT "data_sources_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "portal"."customers"("customer_id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."demo_video_comments"
    ADD CONSTRAINT "demo_video_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."demo_video_comments"
    ADD CONSTRAINT "demo_video_comments_demo_video_id_fkey" FOREIGN KEY ("demo_video_id") REFERENCES "portal"."demo_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."demo_videos"
    ADD CONSTRAINT "demo_videos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."design_resources"
    ADD CONSTRAINT "design_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."developers"
    ADD CONSTRAINT "developers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."diagrams"
    ADD CONSTRAINT "diagrams_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "portal"."services"("id");



ALTER TABLE ONLY "portal"."diagrams"
    ADD CONSTRAINT "diagrams_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."document_permissions"
    ADD CONSTRAINT "document_permissions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "portal"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."document_requests"
    ADD CONSTRAINT "document_requests_related_request_id_fkey" FOREIGN KEY ("related_request_id") REFERENCES "portal"."document_requests"("id");



ALTER TABLE ONLY "portal"."dora_metrics"
    ADD CONSTRAINT "dora_metrics_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "portal"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."events"
    ADD CONSTRAINT "events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."assignments"
    ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "portal"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."hours_logged"
    ADD CONSTRAINT "hours_logged_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."issue_requests"
    ADD CONSTRAINT "issue_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "portal"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "portal"."issue_views"
    ADD CONSTRAINT "issue_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "portal"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."messages"
    ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "portal"."chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."notifications"
    ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "portal"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "portal"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."pinned_panels"
    ADD CONSTRAINT "pinned_panels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "portal"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."services"
    ADD CONSTRAINT "services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal"."users"("id");



ALTER TABLE ONLY "portal"."test_executions"
    ADD CONSTRAINT "test_executions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "portal"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "portal"."tests"
    ADD CONSTRAINT "tests_last_passed_execution_fk" FOREIGN KEY ("last_passed_execution_id") REFERENCES "portal"."test_executions"("id");



ALTER TABLE ONLY "portaldev"."diagrams"
    ADD CONSTRAINT "diagrams_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "portaldev"."services"("id");



ALTER TABLE ONLY "portaldev"."diagrams"
    ADD CONSTRAINT "diagrams_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "portaldev"."users"("id");



ALTER TABLE ONLY "portaldev"."services"
    ADD CONSTRAINT "services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portaldev"."users"("id");



ALTER TABLE ONLY "stripe"."active_entitlements"
    ADD CONSTRAINT "fk_active_entitlements_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."charges"
    ADD CONSTRAINT "fk_charges_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."checkout_session_line_items"
    ADD CONSTRAINT "fk_checkout_session_line_items_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."checkout_sessions"
    ADD CONSTRAINT "fk_checkout_sessions_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."credit_notes"
    ADD CONSTRAINT "fk_credit_notes_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."customers"
    ADD CONSTRAINT "fk_customers_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."disputes"
    ADD CONSTRAINT "fk_disputes_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."early_fraud_warnings"
    ADD CONSTRAINT "fk_early_fraud_warnings_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."exchange_rates_from_usd"
    ADD CONSTRAINT "fk_exchange_rates_from_usd_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."features"
    ADD CONSTRAINT "fk_features_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."invoices"
    ADD CONSTRAINT "fk_invoices_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."_managed_webhooks"
    ADD CONSTRAINT "fk_managed_webhooks_account" FOREIGN KEY ("account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."payment_intents"
    ADD CONSTRAINT "fk_payment_intents_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."payment_methods"
    ADD CONSTRAINT "fk_payment_methods_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."plans"
    ADD CONSTRAINT "fk_plans_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."prices"
    ADD CONSTRAINT "fk_prices_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."products"
    ADD CONSTRAINT "fk_products_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."refunds"
    ADD CONSTRAINT "fk_refunds_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."reviews"
    ADD CONSTRAINT "fk_reviews_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."setup_intents"
    ADD CONSTRAINT "fk_setup_intents_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."subscription_item_change_events_v2_beta"
    ADD CONSTRAINT "fk_subscription_item_change_events_v2_beta_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."subscription_items"
    ADD CONSTRAINT "fk_subscription_items_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."subscription_schedules"
    ADD CONSTRAINT "fk_subscription_schedules_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."subscriptions"
    ADD CONSTRAINT "fk_subscriptions_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."_sync_obj_runs"
    ADD CONSTRAINT "fk_sync_obj_runs_parent" FOREIGN KEY ("_account_id", "run_started_at") REFERENCES "stripe"."_sync_runs"("_account_id", "started_at");



ALTER TABLE ONLY "stripe"."_sync_runs"
    ADD CONSTRAINT "fk_sync_run_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



ALTER TABLE ONLY "stripe"."tax_ids"
    ADD CONSTRAINT "fk_tax_ids_account" FOREIGN KEY ("_account_id") REFERENCES "stripe"."accounts"("id");



CREATE POLICY "Allow authenticated insert" ON "marketing"."leads" USING (true) WITH CHECK (true);



CREATE POLICY "add proposals" ON "marketing"."proposals" USING (true) WITH CHECK (true);



CREATE POLICY "allow-all" ON "marketing"."requirements" USING (true) WITH CHECK (true);



CREATE POLICY "allowproposals" ON "marketing"."proposals" USING (true) WITH CHECK (true);



ALTER TABLE "marketing"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "marketing"."proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "marketing"."requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "updateLeads" ON "marketing"."leads" USING (true) WITH CHECK (true);



ALTER TABLE "portal"."chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "portal"."chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chats_select" ON "portal"."chats" FOR SELECT USING ("portal"."can_access_chat"("id"));



ALTER TABLE "portal"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "portal"."data_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete own pins" ON "portal"."pinned_panels" FOR DELETE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "portal"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_select_via_notification" ON "portal"."events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "portal"."notifications" "n"
  WHERE (("n"."event_id" = "events"."id") AND ("n"."user_id" = "portal"."current_portal_user_id"())))));



CREATE POLICY "insert own pins" ON "portal"."pinned_panels" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "portal"."issue_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "portal"."issue_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "portal"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert" ON "portal"."messages" FOR INSERT WITH CHECK (("portal"."can_access_chat"("chat_id") AND ("user_id" = "portal"."current_portal_user_id"())));



CREATE POLICY "messages_select" ON "portal"."messages" FOR SELECT USING ("portal"."can_access_chat"("chat_id"));



ALTER TABLE "portal"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select" ON "portal"."notifications" FOR SELECT USING (("user_id" = "portal"."current_portal_user_id"()));



CREATE POLICY "notifications_update_own" ON "portal"."notifications" FOR UPDATE USING (("user_id" = "portal"."current_portal_user_id"())) WITH CHECK (("user_id" = "portal"."current_portal_user_id"()));



CREATE POLICY "select own pins" ON "portal"."pinned_panels" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "update own pins" ON "portal"."pinned_panels" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "portal"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users" ON "portal"."users" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "portal"."chats";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "portal"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "portal"."notifications";






GRANT USAGE ON SCHEMA "marketing" TO "anon";
GRANT USAGE ON SCHEMA "marketing" TO "authenticated";
GRANT USAGE ON SCHEMA "marketing" TO "service_role";






GRANT USAGE ON SCHEMA "portal" TO "anon";
GRANT USAGE ON SCHEMA "portal" TO "authenticated";
GRANT USAGE ON SCHEMA "portal" TO "service_role";



GRANT USAGE ON SCHEMA "portaldev" TO "anon";
GRANT USAGE ON SCHEMA "portaldev" TO "authenticated";
GRANT USAGE ON SCHEMA "portaldev" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON SCHEMA "public" TO "prisma";









GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";




































































































































































































































































































































GRANT ALL ON FUNCTION "portal"."can_access_chat"("target_chat_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "portal"."can_access_chat"("target_chat_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "portal"."current_portal_user_id"() TO "anon";
GRANT ALL ON FUNCTION "portal"."current_portal_user_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "portal"."delete_customer_ticket_token"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "portal"."delete_data_source_vault_secret"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "portal"."delete_ticket_token"("p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "portal"."delete_ticket_token"("p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "portal"."get_data_source_password"("p_data_source_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "portal"."get_data_source_password"("p_data_source_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "portal"."get_ticket_token"("p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "portal"."get_ticket_token"("p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "portal"."set_data_source_password"("p_data_source_id" "uuid", "p_password" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "portal"."set_data_source_password"("p_data_source_id" "uuid", "p_password" "text") TO "service_role";



REVOKE ALL ON FUNCTION "portal"."set_ticket_token"("p_customer_id" "uuid", "p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "portal"."set_ticket_token"("p_customer_id" "uuid", "p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "prisma";



GRANT ALL ON FUNCTION "public"."set_updated_at_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_metadata"() TO "service_role";
GRANT ALL ON FUNCTION "public"."set_updated_at_metadata"() TO "prisma";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";


















GRANT ALL ON TABLE "marketing"."leads" TO "anon";
GRANT ALL ON TABLE "marketing"."leads" TO "authenticated";
GRANT ALL ON TABLE "marketing"."leads" TO "service_role";
GRANT ALL ON TABLE "marketing"."leads" TO "prisma";



GRANT ALL ON SEQUENCE "marketing"."Leads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "marketing"."Leads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "marketing"."Leads_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "marketing"."Leads_id_seq" TO "prisma";



GRANT ALL ON TABLE "marketing"."ig_posts" TO "anon";
GRANT ALL ON TABLE "marketing"."ig_posts" TO "authenticated";
GRANT ALL ON TABLE "marketing"."ig_posts" TO "service_role";
GRANT ALL ON TABLE "marketing"."ig_posts" TO "prisma";



GRANT ALL ON TABLE "marketing"."proposals" TO "anon";
GRANT ALL ON TABLE "marketing"."proposals" TO "authenticated";
GRANT ALL ON TABLE "marketing"."proposals" TO "service_role";
GRANT ALL ON TABLE "marketing"."proposals" TO "prisma";



GRANT ALL ON TABLE "marketing"."requirements" TO "anon";
GRANT ALL ON TABLE "marketing"."requirements" TO "authenticated";
GRANT ALL ON TABLE "marketing"."requirements" TO "service_role";
GRANT ALL ON TABLE "marketing"."requirements" TO "prisma";



GRANT ALL ON TABLE "portal"."assignments" TO "anon";
GRANT ALL ON TABLE "portal"."assignments" TO "authenticated";
GRANT ALL ON TABLE "portal"."assignments" TO "service_role";
GRANT ALL ON TABLE "portal"."assignments" TO "prisma";



GRANT ALL ON TABLE "portal"."chat_participants" TO "anon";
GRANT ALL ON TABLE "portal"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "portal"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "portal"."chats" TO "anon";
GRANT ALL ON TABLE "portal"."chats" TO "authenticated";
GRANT ALL ON TABLE "portal"."chats" TO "service_role";



GRANT ALL ON TABLE "portal"."customers" TO "anon";
GRANT ALL ON TABLE "portal"."customers" TO "authenticated";
GRANT ALL ON TABLE "portal"."customers" TO "service_role";
GRANT ALL ON TABLE "portal"."customers" TO "prisma";



GRANT ALL ON SEQUENCE "portal"."customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "portal"."customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "portal"."customers_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "portal"."customers_id_seq" TO "prisma";



GRANT ALL ON TABLE "portal"."cycle_metrics" TO "anon";
GRANT ALL ON TABLE "portal"."cycle_metrics" TO "authenticated";
GRANT ALL ON TABLE "portal"."cycle_metrics" TO "service_role";
GRANT ALL ON TABLE "portal"."cycle_metrics" TO "prisma";



GRANT ALL ON TABLE "portal"."data_sources" TO "anon";
GRANT ALL ON TABLE "portal"."data_sources" TO "authenticated";
GRANT ALL ON TABLE "portal"."data_sources" TO "service_role";



GRANT ALL ON TABLE "portal"."decisions" TO "anon";
GRANT ALL ON TABLE "portal"."decisions" TO "authenticated";
GRANT ALL ON TABLE "portal"."decisions" TO "service_role";
GRANT ALL ON TABLE "portal"."decisions" TO "prisma";



GRANT ALL ON TABLE "portal"."demo_video_comments" TO "anon";
GRANT ALL ON TABLE "portal"."demo_video_comments" TO "authenticated";
GRANT ALL ON TABLE "portal"."demo_video_comments" TO "service_role";



GRANT ALL ON SEQUENCE "portal"."demo_videos_demo_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "portal"."demo_videos_demo_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "portal"."demo_videos_demo_number_seq" TO "service_role";



GRANT ALL ON TABLE "portal"."demo_videos" TO "anon";
GRANT ALL ON TABLE "portal"."demo_videos" TO "authenticated";
GRANT ALL ON TABLE "portal"."demo_videos" TO "service_role";



GRANT ALL ON TABLE "portal"."design_resources" TO "anon";
GRANT ALL ON TABLE "portal"."design_resources" TO "authenticated";
GRANT ALL ON TABLE "portal"."design_resources" TO "service_role";



GRANT ALL ON TABLE "portal"."developers" TO "anon";
GRANT ALL ON TABLE "portal"."developers" TO "authenticated";
GRANT ALL ON TABLE "portal"."developers" TO "service_role";



GRANT ALL ON TABLE "portal"."diagrams" TO "anon";
GRANT ALL ON TABLE "portal"."diagrams" TO "authenticated";
GRANT ALL ON TABLE "portal"."diagrams" TO "service_role";



GRANT ALL ON TABLE "portal"."document_permissions" TO "anon";
GRANT ALL ON TABLE "portal"."document_permissions" TO "authenticated";
GRANT ALL ON TABLE "portal"."document_permissions" TO "service_role";
GRANT ALL ON TABLE "portal"."document_permissions" TO "prisma";



GRANT ALL ON SEQUENCE "portal"."document_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "portal"."document_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "portal"."document_permissions_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "portal"."document_permissions_id_seq" TO "prisma";



GRANT ALL ON TABLE "portal"."document_requests" TO "anon";
GRANT ALL ON TABLE "portal"."document_requests" TO "authenticated";
GRANT ALL ON TABLE "portal"."document_requests" TO "service_role";



GRANT ALL ON TABLE "portal"."documents" TO "anon";
GRANT ALL ON TABLE "portal"."documents" TO "authenticated";
GRANT ALL ON TABLE "portal"."documents" TO "service_role";
GRANT ALL ON TABLE "portal"."documents" TO "prisma";



GRANT ALL ON SEQUENCE "portal"."documents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "portal"."documents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "portal"."documents_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "portal"."documents_id_seq" TO "prisma";



GRANT ALL ON TABLE "portal"."dora_branch_events" TO "anon";
GRANT ALL ON TABLE "portal"."dora_branch_events" TO "authenticated";
GRANT ALL ON TABLE "portal"."dora_branch_events" TO "service_role";



GRANT ALL ON TABLE "portal"."dora_metrics" TO "anon";
GRANT ALL ON TABLE "portal"."dora_metrics" TO "authenticated";
GRANT ALL ON TABLE "portal"."dora_metrics" TO "service_role";
GRANT ALL ON TABLE "portal"."dora_metrics" TO "prisma";



GRANT ALL ON TABLE "portal"."events" TO "anon";
GRANT ALL ON TABLE "portal"."events" TO "authenticated";
GRANT ALL ON TABLE "portal"."events" TO "service_role";



GRANT ALL ON TABLE "portal"."hours_logged" TO "anon";
GRANT ALL ON TABLE "portal"."hours_logged" TO "authenticated";
GRANT ALL ON TABLE "portal"."hours_logged" TO "service_role";



GRANT ALL ON TABLE "portal"."issue_metrics" TO "anon";
GRANT ALL ON TABLE "portal"."issue_metrics" TO "authenticated";
GRANT ALL ON TABLE "portal"."issue_metrics" TO "service_role";
GRANT ALL ON TABLE "portal"."issue_metrics" TO "prisma";



GRANT ALL ON TABLE "portal"."issue_requests" TO "anon";
GRANT ALL ON TABLE "portal"."issue_requests" TO "authenticated";
GRANT ALL ON TABLE "portal"."issue_requests" TO "service_role";



GRANT ALL ON TABLE "portal"."issue_updates" TO "anon";
GRANT ALL ON TABLE "portal"."issue_updates" TO "authenticated";
GRANT ALL ON TABLE "portal"."issue_updates" TO "service_role";



GRANT ALL ON TABLE "portal"."issue_vectors" TO "anon";
GRANT ALL ON TABLE "portal"."issue_vectors" TO "authenticated";
GRANT ALL ON TABLE "portal"."issue_vectors" TO "service_role";



GRANT ALL ON TABLE "portal"."issue_views" TO "anon";
GRANT ALL ON TABLE "portal"."issue_views" TO "authenticated";
GRANT ALL ON TABLE "portal"."issue_views" TO "service_role";



GRANT ALL ON TABLE "portal"."messages" TO "anon";
GRANT ALL ON TABLE "portal"."messages" TO "authenticated";
GRANT ALL ON TABLE "portal"."messages" TO "service_role";



GRANT ALL ON TABLE "portal"."milestone_cycle_snapshots" TO "anon";
GRANT ALL ON TABLE "portal"."milestone_cycle_snapshots" TO "authenticated";
GRANT ALL ON TABLE "portal"."milestone_cycle_snapshots" TO "service_role";



GRANT ALL ON TABLE "portal"."notifications" TO "anon";
GRANT ALL ON TABLE "portal"."notifications" TO "authenticated";
GRANT ALL ON TABLE "portal"."notifications" TO "service_role";



GRANT ALL ON TABLE "portal"."pinned_panels" TO "anon";
GRANT ALL ON TABLE "portal"."pinned_panels" TO "authenticated";
GRANT ALL ON TABLE "portal"."pinned_panels" TO "service_role";



GRANT ALL ON TABLE "portal"."services" TO "anon";
GRANT ALL ON TABLE "portal"."services" TO "authenticated";
GRANT ALL ON TABLE "portal"."services" TO "service_role";



GRANT ALL ON TABLE "portal"."suggested_features" TO "anon";
GRANT ALL ON TABLE "portal"."suggested_features" TO "authenticated";
GRANT ALL ON TABLE "portal"."suggested_features" TO "service_role";



GRANT ALL ON TABLE "portal"."test_executions" TO "anon";
GRANT ALL ON TABLE "portal"."test_executions" TO "authenticated";
GRANT ALL ON TABLE "portal"."test_executions" TO "service_role";



GRANT ALL ON TABLE "portal"."tests" TO "anon";
GRANT ALL ON TABLE "portal"."tests" TO "authenticated";
GRANT ALL ON TABLE "portal"."tests" TO "service_role";



GRANT ALL ON TABLE "portal"."tests_legacy" TO "anon";
GRANT ALL ON TABLE "portal"."tests_legacy" TO "authenticated";
GRANT ALL ON TABLE "portal"."tests_legacy" TO "service_role";
GRANT ALL ON TABLE "portal"."tests_legacy" TO "prisma";



GRANT ALL ON TABLE "portal"."users" TO "anon";
GRANT ALL ON TABLE "portal"."users" TO "authenticated";
GRANT ALL ON TABLE "portal"."users" TO "service_role";
GRANT ALL ON TABLE "portal"."users" TO "prisma";



GRANT ALL ON TABLE "portal"."vector_sync_state" TO "anon";
GRANT ALL ON TABLE "portal"."vector_sync_state" TO "authenticated";
GRANT ALL ON TABLE "portal"."vector_sync_state" TO "service_role";



GRANT ALL ON TABLE "portaldev"."assignments" TO "anon";
GRANT ALL ON TABLE "portaldev"."assignments" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."assignments" TO "service_role";



GRANT ALL ON TABLE "portaldev"."customers" TO "anon";
GRANT ALL ON TABLE "portaldev"."customers" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."customers" TO "service_role";



GRANT ALL ON SEQUENCE "portaldev"."customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "portaldev"."customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "portaldev"."customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "portaldev"."cycle_metrics" TO "anon";
GRANT ALL ON TABLE "portaldev"."cycle_metrics" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."cycle_metrics" TO "service_role";



GRANT ALL ON TABLE "portaldev"."decisions" TO "anon";
GRANT ALL ON TABLE "portaldev"."decisions" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."decisions" TO "service_role";



GRANT ALL ON TABLE "portaldev"."developers" TO "anon";
GRANT ALL ON TABLE "portaldev"."developers" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."developers" TO "service_role";



GRANT ALL ON TABLE "portaldev"."diagrams" TO "anon";
GRANT ALL ON TABLE "portaldev"."diagrams" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."diagrams" TO "service_role";



GRANT ALL ON TABLE "portaldev"."document_permissions" TO "anon";
GRANT ALL ON TABLE "portaldev"."document_permissions" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."document_permissions" TO "service_role";



GRANT ALL ON SEQUENCE "portaldev"."document_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "portaldev"."document_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "portaldev"."document_permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "portaldev"."document_requests" TO "anon";
GRANT ALL ON TABLE "portaldev"."document_requests" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."document_requests" TO "service_role";



GRANT ALL ON TABLE "portaldev"."documents" TO "anon";
GRANT ALL ON TABLE "portaldev"."documents" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."documents" TO "service_role";



GRANT ALL ON SEQUENCE "portaldev"."documents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "portaldev"."documents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "portaldev"."documents_id_seq" TO "service_role";



GRANT ALL ON TABLE "portaldev"."dora_metrics" TO "anon";
GRANT ALL ON TABLE "portaldev"."dora_metrics" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."dora_metrics" TO "service_role";



GRANT ALL ON TABLE "portaldev"."issue_metrics" TO "anon";
GRANT ALL ON TABLE "portaldev"."issue_metrics" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."issue_metrics" TO "service_role";



GRANT ALL ON TABLE "portaldev"."issue_updates" TO "anon";
GRANT ALL ON TABLE "portaldev"."issue_updates" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."issue_updates" TO "service_role";



GRANT ALL ON TABLE "portaldev"."pinned_panels" TO "anon";
GRANT ALL ON TABLE "portaldev"."pinned_panels" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."pinned_panels" TO "service_role";



GRANT ALL ON TABLE "portaldev"."services" TO "anon";
GRANT ALL ON TABLE "portaldev"."services" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."services" TO "service_role";



GRANT ALL ON TABLE "portaldev"."tests" TO "anon";
GRANT ALL ON TABLE "portaldev"."tests" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."tests" TO "service_role";



GRANT ALL ON TABLE "portaldev"."users" TO "anon";
GRANT ALL ON TABLE "portaldev"."users" TO "authenticated";
GRANT ALL ON TABLE "portaldev"."users" TO "service_role";



GRANT ALL ON TABLE "public"."notion_content" TO "anon";
GRANT ALL ON TABLE "public"."notion_content" TO "authenticated";
GRANT ALL ON TABLE "public"."notion_content" TO "service_role";
GRANT ALL ON TABLE "public"."notion_content" TO "prisma";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portal" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portal" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portal" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portal" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portal" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portal" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "portaldev" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "prisma";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "prisma";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "prisma";































