import { HelpCircle, CheckCheck } from "lucide-react";
import type { QuestionData } from "./types";

interface QuestionCardProps {
  data: QuestionData;
  onAnswer: (questionId: string, runId: string, answer: string) => void;
}

export function QuestionCard({ data, onAnswer }: QuestionCardProps) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{ background: "#111827", border: "1px solid #263244" }}
      data-testid={`question-card-${data.questionId}`}>
      <div className="flex items-start gap-2">
        <HelpCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: "#3B82F6" }} />
        <p className="text-[12px] leading-relaxed font-medium" style={{ color: "#E5E7EB" }}>{data.text}</p>
      </div>
      {data.answered ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" }}>
          <CheckCheck className="h-3 w-3" style={{ color: "#22C55E" }} />
          <span className="text-[11px]" style={{ color: "#22C55E" }}>
            Answered: <strong>{data.answered}</strong>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {data.options.map((opt) => (
            <button key={opt} onClick={() => onAnswer(data.questionId, data.runId, opt)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{ background: "#1A2230", border: "1px solid #263244", color: "#E5E7EB" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#3B82F6"; (e.currentTarget as HTMLElement).style.color = "#E5E7EB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#263244"; (e.currentTarget as HTMLElement).style.color = "#E5E7EB"; }}
              data-testid={`question-option-${data.questionId}-${opt.replace(/\s+/g, "-").toLowerCase()}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
