// @ts-nocheck
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

// Stripe's SDK defaults to its Node-native HTTP client, which relies on Node
// compat polyfills (process.nextTick -> Deno.core.runMicrotasks) that break
// under Supabase's Edge Runtime Deno version. The fetch-based client avoids
// that whole code path — this is Stripe/Supabase's documented Deno fix.
export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});
