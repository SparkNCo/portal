"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { supabase } from "@/lib/supabase-client";
import { API_HEADERS } from "@/lib/api-headers";
import { PINNABLE_PANELS, type PinnablePanelId } from "@/lib/pinnable-panels";

export type PinnedPanel = {
  id: string;
  user_id: string;
  panel_id: string;
  source_dashboard: string;
  position: number;
  full_width: boolean;
  created_at: string;
};

const pinnedPanelsTable = () => supabase.schema("portal").from("pinned_panels");

// The `customer` param shows up in two different formats depending on how
// it was reached — CustomerCard links use the raw clientName ("Spark
// Portal"), while the set-password redirect slugifies it ("Spark-Portal")
// — so compare both sides case-insensitively with spaces/hyphens folded
// together instead of requiring an exact match.
function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[\s-]+/g, "-");
}

// Resolves whose pinned_panels row to read/write. When an admin/developer
// is viewing a specific customer's dashboard (via the Dashboards flow),
// that's the customer's own user record — `customerSlug` is the customer's
// clientName, not a user id, so it has to be looked up. Otherwise it's just
// the logged-in user's own dashboard.
export function usePinnedPanelsOwnerId(): string | undefined {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();

  const { data: customerLookup } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: !!customerSlug,
  });

  if (!customerSlug) return profile?.id;

  return customerLookup?.find(
    (c: { clientName: string }) => normalizeSlug(c.clientName) === normalizeSlug(customerSlug),
  )?.id;
}

export function usePinnedPanels(userId: string | undefined) {
  return useQuery({
    queryKey: ["pinned-panels", userId],
    queryFn: async () => {
      const { data, error } = await pinnedPanelsTable()
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (error) throw error;
      return data as PinnedPanel[];
    },
    enabled: !!userId,
  });
}

export function usePinPanel(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      panelId,
      sourceDashboard,
    }: {
      panelId: string;
      sourceDashboard: string;
    }) => {
      if (!userId) throw new Error("Missing user id");

      const existing = queryClient.getQueryData<PinnedPanel[]>([
        "pinned-panels",
        userId,
      ]);
      const nextPosition = existing?.length ?? 0;

      const { error } = await pinnedPanelsTable().insert({
        user_id: userId,
        panel_id: panelId,
        source_dashboard: sourceDashboard,
        position: nextPosition,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-panels", userId] });
    },
  });
}

export function useAddPanels(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (panelIds: PinnablePanelId[]) => {
      if (!userId) throw new Error("Missing user id");

      const existing = queryClient.getQueryData<PinnedPanel[]>([
        "pinned-panels",
        userId,
      ]);
      const existingIds = new Set(existing?.map((p) => p.panel_id) ?? []);
      const toAdd = panelIds.filter((id) => !existingIds.has(id));
      if (toAdd.length === 0) return;

      const startPosition = existing?.length ?? 0;
      const rows = toAdd.map((panelId, i) => ({
        user_id: userId,
        panel_id: panelId,
        source_dashboard: PINNABLE_PANELS[panelId].sourceDashboard,
        position: startPosition + i,
      }));

      const { error } = await pinnedPanelsTable().insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-panels", userId] });
    },
  });
}

export function useReorderPinnedPanels(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedPanelIds: string[]) => {
      if (!userId) throw new Error("Missing user id");

      await Promise.all(
        orderedPanelIds.map((panelId, position) =>
          pinnedPanelsTable()
            .update({ position })
            .eq("user_id", userId)
            .eq("panel_id", panelId),
        ),
      );
    },
    onMutate: (orderedPanelIds: string[]) => {
      const previous = queryClient.getQueryData<PinnedPanel[]>([
        "pinned-panels",
        userId,
      ]);
      if (!previous) return { previous };

      const byPanelId = new Map(previous.map((p) => [p.panel_id, p]));
      const reordered = orderedPanelIds
        .map((panelId, position) => {
          const pin = byPanelId.get(panelId);
          return pin ? { ...pin, position } : undefined;
        })
        .filter((pin): pin is PinnedPanel => !!pin);

      queryClient.setQueryData(["pinned-panels", userId], reordered);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pinned-panels", userId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-panels", userId] });
    },
  });
}

export function useTogglePanelWidth(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      panelId,
      fullWidth,
    }: {
      panelId: string;
      fullWidth: boolean;
    }) => {
      if (!userId) throw new Error("Missing user id");

      const { error } = await pinnedPanelsTable()
        .update({ full_width: fullWidth })
        .eq("user_id", userId)
        .eq("panel_id", panelId);

      if (error) throw error;
    },
    onMutate: ({ panelId, fullWidth }) => {
      const previous = queryClient.getQueryData<PinnedPanel[]>([
        "pinned-panels",
        userId,
      ]);
      if (!previous) return { previous };

      const next = previous.map((p) =>
        p.panel_id === panelId ? { ...p, full_width: fullWidth } : p,
      );
      queryClient.setQueryData(["pinned-panels", userId], next);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pinned-panels", userId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-panels", userId] });
    },
  });
}

export function useUnpinPanel(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (panelId: string) => {
      if (!userId) throw new Error("Missing user id");

      const { error } = await pinnedPanelsTable()
        .delete()
        .eq("user_id", userId)
        .eq("panel_id", panelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-panels", userId] });
    },
  });
}
