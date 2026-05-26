
import React from "react";
import { Badge } from "@/components/ui/badge";

export type FileOperation = {
  path: string;
  operation: "create" | "overwrite";
  templateType: string;
  layer: string;
  featureName: string;
};

interface Props {
  operations: FileOperation[];
}

export default function FileOperationList({ operations }: Props) {
  if (!operations || operations.length === 0) {
    return <div className="text-gray-400 text-sm">No file operations detected.</div>;
  }

  return (
    <div className="space-y-3">
      {operations.map((op, i) => (
        <div key={i} className="border rounded-xl p-3 shadow-sm hover:shadow-md transition">
          <div className="font-medium mb-1 flex gap-2 items-center">
            <Badge variant="outline">{i + 1}</Badge>
            <span>{op.path}</span>
          </div>
          <div className="text-sm">
            <div><strong>Feature:</strong> {op.featureName}</div>
            <div><strong>Layer:</strong> <Badge>{op.layer}</Badge></div>
            <div><strong>Operation:</strong> {op.operation}</div>
            <div><strong>Template Type:</strong> <Badge variant="secondary">{op.templateType}</Badge></div>
          </div>
        </div>
      ))}
    </div>
  );
}
