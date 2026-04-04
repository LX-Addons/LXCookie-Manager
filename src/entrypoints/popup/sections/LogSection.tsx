import { ClearLog } from "@/components/ClearLog";

interface LogSectionProps {
  onMessage: (text: string, isError?: boolean) => void;
}

export const LogSection = ({ onMessage }: LogSectionProps) => {
  return (
    <div className="tab-content" role="tabpanel" id="log-panel" aria-labelledby="log-tab">
      <ClearLog onMessage={onMessage} />
    </div>
  );
};
