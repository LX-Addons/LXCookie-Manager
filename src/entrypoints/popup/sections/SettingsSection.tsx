import { Settings } from "@/components/Settings";

interface SettingsSectionProps {
  onMessage: (text: string, isError?: boolean) => void;
}

export const SettingsSection = ({ onMessage }: SettingsSectionProps) => {
  return (
    <div className="tab-content" role="tabpanel" id="settings-panel" aria-labelledby="settings-tab">
      <Settings onMessage={onMessage} />
    </div>
  );
};
