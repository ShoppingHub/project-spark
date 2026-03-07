import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";

export type CustomMenuItem = "finance" | "gym";

const ALL_CUSTOM_ITEMS: CustomMenuItem[] = ["finance", "gym"];
const MAX_ACTIVE = 2;

interface MenuConfigContextType {
  customItems: CustomMenuItem[];
  toggleItem: (item: CustomMenuItem) => void;
  isItemActive: (item: CustomMenuItem) => boolean;
  canActivateMore: boolean;
  gymAreaId: string | null;
  hasGymArea: boolean;
  loading: boolean;
}

const MenuConfigContext = createContext<MenuConfigContextType>({
  customItems: [],
  toggleItem: () => {},
  isItemActive: () => false,
  canActivateMore: true,
  gymAreaId: null,
  hasGymArea: false,
  loading: true,
});

export function MenuConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const [customItems, setCustomItems] = useState<CustomMenuItem[]>([]);
  const [gymAreaId, setGymAreaId] = useState<string | null>(null);
  const [hasGymArea, setHasGymArea] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch menu config and gym area
  useEffect(() => {
    if (isDemo) {
      setCustomItems(["finance"]);
      setLoading(false);
      return;
    }
    if (!user) return;

    const fetchData = async () => {
      const [{ data: userData }, { data: areasData }] = await Promise.all([
        supabase.from("users").select("menu_custom_items").eq("user_id", user.id).single(),
        supabase.from("areas").select("id, name, type").eq("user_id", user.id).is("archived_at", null),
      ]);

      // Find gym area
      const gym = areasData?.find(
        (a) => a.type === "health" && /^(gym|palestra)$/i.test(a.name)
      );
      setGymAreaId(gym?.id ?? null);
      setHasGymArea(!!gym);

      // Parse menu items, filter out gym if area was deleted
      const raw = (userData?.menu_custom_items as string[] | null) ?? [];
      const valid = raw.filter((item): item is CustomMenuItem =>
        ALL_CUSTOM_ITEMS.includes(item as CustomMenuItem) &&
        (item !== "gym" || !!gym)
      );
      setCustomItems(valid);

      // If gym was in DB but area is gone, clean up
      if (raw.includes("gym") && !gym) {
        const cleaned = raw.filter((i) => i !== "gym");
        await supabase.from("users").update({ menu_custom_items: cleaned } as any).eq("user_id", user.id);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, isDemo]);

  // Listen for area changes to detect gym deletion
  useEffect(() => {
    if (isDemo || !user) return;

    const channel = supabase
      .channel("areas-menu-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "areas", filter: `user_id=eq.${user.id}` }, async () => {
        const { data: areasData } = await supabase
          .from("areas").select("id, name, type").eq("user_id", user.id).is("archived_at", null);
        const gym = areasData?.find(
          (a) => a.type === "health" && /^(gym|palestra)$/i.test(a.name)
        );
        setGymAreaId(gym?.id ?? null);
        setHasGymArea(!!gym);

        if (!gym) {
          setCustomItems((prev) => {
            const next = prev.filter((i) => i !== "gym");
            if (next.length !== prev.length) {
              supabase.from("users").update({ menu_custom_items: next } as any).eq("user_id", user.id).then();
            }
            return next;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isDemo]);

  const toggleItem = useCallback((item: CustomMenuItem) => {
    setCustomItems((prev) => {
      const isActive = prev.includes(item);
      let next: CustomMenuItem[];
      if (isActive) {
        next = prev.filter((i) => i !== item);
      } else {
        if (prev.length >= MAX_ACTIVE) return prev;
        next = [...prev, item];
      }
      // Save to DB silently
      if (user && !isDemo) {
        supabase.from("users").update({ menu_custom_items: next } as any).eq("user_id", user.id).then();
      }
      return next;
    });
  }, [user, isDemo]);

  const isItemActive = useCallback((item: CustomMenuItem) => customItems.includes(item), [customItems]);
  const canActivateMore = customItems.length < MAX_ACTIVE;

  return (
    <MenuConfigContext.Provider value={{ customItems, toggleItem, isItemActive, canActivateMore, gymAreaId, hasGymArea, loading }}>
      {children}
    </MenuConfigContext.Provider>
  );
}

export const useMenuConfig = () => useContext(MenuConfigContext);
