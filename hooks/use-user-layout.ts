"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUser } from "context/UserContext";
import { supabase } from "@/lib/supabase-client";
import { expandedPanelKey, setPanelExpanded } from "@/lib/user-layout";

// The signed-in user's own screen layout (portal.user_layout, one row per
// user; RLS lets each user read and write only their own): the sidebar's menu
// order (SPA-581) and the panels they widened on pages other than the
// Dashboard. See lib/user-layout.ts for how each is applied.

type UserLayout = { nav_order: string[]; expanded_panels: string[] };

const EMPTY: UserLayout = { nav_order: [], expanded_panels: [] };
const userLayoutTable = () => supabase.schema("portal").from("user_layout");
const queryKey = (userId: string | undefined) => ["user-layout", userId];

export function useUserLayout() {
  const { profile } = useUser();
  const userId = profile?.id;
  return useQuery({
    queryKey: queryKey(userId),
    queryFn: async (): Promise<UserLayout> => {
      const { data, error } = await userLayoutTable()
        .select("nav_order, expanded_panels")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? EMPTY;
    },
    enabled: !!userId,
    // Only this user changes it, from this browser tab.
    staleTime: Infinity,
  });
}

// Saves one part of the layout. The screen changes right away; if saving
// fails, it goes back and says so.
function useSaveLayout<K extends keyof UserLayout>(field: K, errorMessage: string) {
  const { profile } = useUser();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (value: UserLayout[K]) => {
      if (!userId) throw new Error("Missing user id");
      // Only this column: an upsert leaves the row's other columns as they are.
      const { error } = await userLayoutTable().upsert({
        user_id: userId,
        [field]: value,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: queryKey(userId) });
      const previous = queryClient.getQueryData<UserLayout>(queryKey(userId));
      queryClient.setQueryData<UserLayout>(queryKey(userId), { ...(previous ?? EMPTY), [field]: value });
      return { previous };
    },
    onError: (_err, _value, context) => {
      queryClient.setQueryData(queryKey(userId), context?.previous ?? EMPTY);
      toast.error(errorMessage);
    },
  });
}

export function useSaveNavOrder() {
  return useSaveLayout("nav_order", "Couldn't save the menu order. Please try again.");
}

// Whether a panel on a page (other than the Dashboard) is widened to the full
// page width, and a toggle for it.
export function usePanelExpanded(page: string, panelId: string) {
  const { data } = useUserLayout();
  const save = useSaveLayout("expanded_panels", "Couldn't save the panel size. Please try again.");
  const key = expandedPanelKey(page, panelId);
  const keys = data?.expanded_panels ?? [];
  const expanded = keys.includes(key);
  return {
    expanded,
    toggle: () => save.mutate(setPanelExpanded(keys, key, !expanded)),
  };
}
