import { PORTAL_SCHEMA } from "@/lib/supabase-client";

export const API_HEADERS = {
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
  apikey: process.env.NEXT_PUBLIC_APIKEY!,
  "x-portal-schema": PORTAL_SCHEMA,
};

export const API_JSON_HEADERS = {
  ...API_HEADERS,
  "Content-Type": "application/json",
};
