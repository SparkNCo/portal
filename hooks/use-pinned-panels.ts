"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { PINNABLE_PANELS, type PinnablePanelId } from "@/lib/pinnable-panels";

export type PinnedPanel = {
  id: string;
  user_id: string;
  panel_id: string;
  source_dashboard: string;
  position: number;
  created_at: string;
};

const pinnedPanelsTable = () => supabase.schema("portal").from("pinned_panels");

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
