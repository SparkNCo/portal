// @ts-nocheck
import { supabase } from "../client.ts";

export async function createUserFromStripe({
  email,
  customerId,
  subscriptionId,
}: {
  email: string;
  customerId: string;
  subscriptionId: string;
}) {
  if (!email || !customerId || !subscriptionId) {
    console.error("❌ Missing required Stripe data");
    return;
  }

  console.log("👤 Creating user in Spark Portal:", {
    email,
    customerId,
    subscriptionId,
  });

  const { data: existingUser, error: lookupError } = await supabase
    .from("users")
    .select("id")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (lookupError) {
    console.error("❌ Error checking existing user", lookupError);
    return;
  }

  if (existingUser) {
    console.log("ℹ️ User already exists, skipping insert");
    return;
  }

  const { error: insertError } = await supabase.from("users").insert({
    email,
    customer_id: customerId,
    subscription_id: subscriptionId,
    role: "customer",
  });

  if (insertError) {
    console.error("❌ Failed to create user:", insertError);
    return;
  }

  console.log("✅ User created successfully");
}
