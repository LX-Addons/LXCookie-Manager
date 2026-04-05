import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "@/hooks";
import type { IconName } from "@/components/Icon";
import { ModeType } from "@/types";
import type { Settings as SettingsType } from "@/types";

interface UsePopupTabsProps {
  settings: SettingsType;
}

interface UsePopupTabsReturn {
  activeTab: string;
  tabs: Array<{ id: string; label: string; iconName: IconName }>;
  tabRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  setActiveTab: (tab: string) => void;
  handleTabKeyDown: (e: React.KeyboardEvent) => void;
}

export function usePopupTabs({ settings }: UsePopupTabsProps): UsePopupTabsReturn {
  const [activeTab, setActiveTab] = useState("manage");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { t } = useTranslation();

  const tabs = useMemo<
    Array<{
      id: string;
      label: string;
      iconName: IconName;
    }>
  >(
    () => [
      { id: "manage", label: t("tabs.manage"), iconName: "cookie" },
      {
        id: "rules",
        label: settings.mode === ModeType.WHITELIST ? t("tabs.whitelist") : t("tabs.blacklist"),
        iconName: "list",
      },
      { id: "settings", label: t("tabs.settings"), iconName: "settings" },
      { id: "log", label: t("tabs.log"), iconName: "shield" },
    ],
    [settings.mode, t]
  );

  const getNewTabId = (e: React.KeyboardEvent, activeTab: string, tabs: Array<{ id: string }>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        return tabs[(currentIndex + 1) % tabs.length].id;
      case "ArrowLeft":
        e.preventDefault();
        return tabs[(currentIndex - 1 + tabs.length) % tabs.length].id;
      case "Home":
        e.preventDefault();
        return tabs[0].id;
      case "End":
        e.preventDefault();
        return tabs.at(-1)?.id;
      default:
        return null;
    }
  };

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const newTabId = getNewTabId(e, activeTab, tabs);

      if (newTabId && newTabId !== activeTab) {
        setActiveTab(newTabId);
        tabRefs.current[newTabId]?.focus();
      }
    },
    [activeTab, tabs]
  );

  return {
    activeTab,
    tabs,
    tabRefs,
    setActiveTab,
    handleTabKeyDown,
  };
}
