import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";

// Resolves which `customers.customer_id` the current viewer's Settings
// sections (Staffing, Stakeholders) should scope their `assignments` query
// to.
//
// - Admin viewing a customer: `customerIdOverride` (the customer's own user
//   id, resolved by the caller) always wins.
// - A customer's own `profile.id` *is* the id `assignments.customer_id`
//   points at — no lookup needed.
// - A stakeholder's `users.customer_id` is never populated at creation (see
//   app/admin/users/AddStakeholderModal.tsx / supabase/functions/users/
//   createUser.ts — the stakeholder is created, then separately assigned),
//   so the only place their initiative is recorded is their own
//   `assignments` row. Same resolution useCometChat.ts's stakeholder branch
//   already relies on for the same reason.
export function useResolvedCustomerId(customerIdOverride?: string) {
  const { profile } = useUser();
  const isSelfStakeholder = !customerIdOverride && profile?.role === "stakeholder";

  const { data: ownAssignments } = useQuery({
    queryKey: ["own-assignments-for-customer-id", profile?.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${profile!.id}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to resolve your initiative");
      return res.json() as Promise<{ customer_id: string }[]>;
    },
    enabled: isSelfStakeholder && !!profile?.id,
  });

  if (customerIdOverride) return customerIdOverride;
  if (profile?.role === "customer") return profile?.id;
  if (isSelfStakeholder) return ownAssignments?.[0]?.customer_id;
  return undefined;
}
