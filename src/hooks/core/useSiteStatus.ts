import { useMemo } from "react";
import { isInList } from "@/utils/domain";
import { ModeType } from "@/types";
import type { DomainList } from "@/types";
import type { IconName } from "@/components/Icon";

export type SiteStatus = "protected" | "priority-cleanup" | "normal";

export interface SiteStatusInfo {
  status: SiteStatus;
  statusText: string;
  statusIcon: IconName;
  isInWhitelist: boolean;
  isInBlacklist: boolean;
}

interface UseSiteStatusProps {
  currentDomain: string;
  mode: ModeType;
  whitelist: DomainList;
  blacklist: DomainList;
  t: (key: string) => string;
}

export function useSiteStatus({
  currentDomain,
  mode,
  whitelist,
  blacklist,
  t,
}: UseSiteStatusProps): SiteStatusInfo {
  return useMemo(() => {
    const isInWhitelist = currentDomain ? isInList(currentDomain, whitelist) : false;
    const isInBlacklist = currentDomain ? isInList(currentDomain, blacklist) : false;

    let status: SiteStatus;
    let statusText: string;
    let statusIcon: IconName;

    if (mode === ModeType.WHITELIST) {
      if (isInWhitelist) {
        status = "protected";
        statusText = t("popup.siteStatus.protected");
        statusIcon = "shield";
      } else {
        status = "priority-cleanup";
        statusText = t("popup.siteStatus.priorityCleanup");
        statusIcon = "alertTriangle";
      }
    } else if (isInBlacklist) {
      status = "priority-cleanup";
      statusText = t("popup.siteStatus.priorityCleanup");
      statusIcon = "alertTriangle";
    } else {
      status = "normal";
      statusText = t("popup.siteStatus.normal");
      statusIcon = "checkCircle";
    }

    return {
      status,
      statusText,
      statusIcon,
      isInWhitelist,
      isInBlacklist,
    };
  }, [currentDomain, mode, whitelist, blacklist, t]);
}
