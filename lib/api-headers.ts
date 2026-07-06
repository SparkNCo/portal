export const API_HEADERS = {
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_KEY}`,
  apikey: process.env.NEXT_PUBLIC_SUPABASE_KEY!,
};

export const API_JSON_HEADERS = {
  ...API_HEADERS,
  "Content-Type": "application/json",
};
