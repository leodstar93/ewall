"use client";

import { useEffect, useMemo, useState } from "react";

const SIDEBAR_STORAGE_KEY = "console.sidebar.preference";
const AUTO_COLLAPSE_QUERY = "(min-width: 960px) and (max-width: 1239px)";

type SidebarPreference = "collapsed" | "expanded" | null;

export function useSidebarPreference() {
  const [sidebarPreference, setSidebarPreference] = useState<SidebarPreference>(() => {
    if (typeof window === "undefined") return null;

    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === "collapsed" || stored === "expanded" ? stored : null;
  });
  const [isViewportCompact, setIsViewportCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(AUTO_COLLAPSE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(AUTO_COLLAPSE_QUERY);
    const syncViewport = () => setIsViewportCompact(media.matches);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncViewport);
      return () => media.removeEventListener("change", syncViewport);
    }

    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sidebarPreference) {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarPreference);
    } else {
      window.localStorage.removeItem(SIDEBAR_STORAGE_KEY);
    }
  }, [sidebarPreference]);

  const isSidebarCollapsed = useMemo(() => {
    if (sidebarPreference === "collapsed") return true;
    if (sidebarPreference === "expanded") return false;
    return isViewportCompact;
  }, [isViewportCompact, sidebarPreference]);

  const toggleSidebar = () => {
    const effectiveCollapsed =
      sidebarPreference === "collapsed"
        ? true
        : sidebarPreference === "expanded"
          ? false
          : isViewportCompact;

    setSidebarPreference(effectiveCollapsed ? "expanded" : "collapsed");
  };

  return {
    isSidebarCollapsed,
    sidebarPreference,
    toggleSidebar,
  };
}
