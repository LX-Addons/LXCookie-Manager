import { DomainManager } from "@/components/DomainManager";
import type { Settings as SettingsType } from "@/types";
import { ModeType } from "@/types";

interface RulesSectionProps {
  settings: SettingsType;
  currentDomain: string;
  onMessage: (text: string, isError?: boolean) => void;
  handleClearBlacklist: () => void;
}

export const RulesSection = ({
  settings,
  currentDomain,
  onMessage,
  handleClearBlacklist,
}: RulesSectionProps) => {
  const isBlacklistMode = settings.mode === ModeType.BLACKLIST;
  const type = isBlacklistMode ? "blacklist" : "whitelist";

  return (
    <div className="tab-content" role="tabpanel" id="rules-panel" aria-labelledby="rules-tab">
      <DomainManager
        type={type}
        currentDomain={currentDomain}
        onMessage={onMessage}
        onClearBlacklist={isBlacklistMode ? handleClearBlacklist : undefined}
      />
    </div>
  );
};
