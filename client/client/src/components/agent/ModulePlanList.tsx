
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const ModulePlanList = ({ modules }) => {
  if (!modules?.length) return null;
  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-xl font-bold">🧱 Feature → Module Breakdown</h2>
      {modules.map((m, i) => (
        <Card key={i} className="p-4 border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{m.priority ? m.priority : (i + 1)}. {m.featureName}</div>
              <div className="text-xs opacity-70">Files:
                <ul className="list-disc ml-4">
                {m.targetFiles.map((f, idx) => (<li key={idx}>{f}</li>))}
                </ul>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge>{m.layer}</Badge>{m.isCriticalPath && <Badge variant="outline">Critical</Badge>}
              <Badge variant="outline">{m.complexity}</Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
