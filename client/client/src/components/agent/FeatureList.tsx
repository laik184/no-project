
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const FeatureList = ({ features }) => {
  if (!features) return null;
  return (
    <Card className="p-4 mt-4">
      <h3 className="font-bold text-lg">🧠 Core Product Features</h3>
      <div className="mt-2 space-y-2">
        {features.explicitFeatures?.length > 0 && (
          <div>
            <h4 className="font-semibold">🎯 Explicit Features:</h4>
            <ul className="list-disc ml-4">
              {features.explicitFeatures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {features.implicitFeatures?.length > 0 && (
          <div>
            <h4 className="font-semibold">🧠 Implicit Features:</h4>
            <ul className="list-disc ml-4">
              {features.implicitFeatures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {features.mandatoryFeatures?.length > 0 && (
          <div>
            <h4 className="font-semibold">⚠ Mandatory Features:</h4>
            <ul className="list-disc ml-4">
              {features.mandatoryFeatures.map((f, i) => (
                <li key={i}>{f}</li>))}
            </ul>
          </div>
        )}
        {features.niceToHaveFeatures?.length > 0 && (
          <div>
            <h4 className="font-semibold">✨ Nice To Have:</h4>
            <ul className="list-disc ml-4">
              {features.niceToHaveFeatures.map((f, i) => (
                <li key={i}>{f}</li>))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};
