import { HelpCircle, CheckCheck } from "lucide-react";
import type { QuestionData } from "./types";

interface QuestionCardProps {
  data: QuestionData;
  onAnswer: (questionId: string, runId: string, answer: string) => void;
}

export function QuestionCard({ data, onAnswer }: QuestionCardProps) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{ background: "rgba(124,141,255,0.07)", border: "1px solid rgba(124,141,255,0.2)" }}
      data-testid={`question-card-${data.questionId}`}>
      <div className="flex items-start gap-2">
        <HelpCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: "#a78bfa" }} />
        <p className="text-[12px] leading-relaxed text-foreground font-medium">{data.text}</p>
      </div>
      {data.answered ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: "rgba(74,222,128,0.08)" }}>
          <CheckCheck className="h-3 w-3" style={{ color: "#4ade80" }} />
          <span className="text-[11px]" style={{ color: "#4ade80" }}>
            Answered: <strong>{data.answered}</strong>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {data.options.map((opt) => (
            <button key={opt} onClick={() => onAnswer(data.questionId, data.runId, opt)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{ background: "rgba(124,141,255,0.12)", border: "1px solid rgba(124,141,255,0.28)", color: "rgba(226,232,240,0.9)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(124,141,255,0.25)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(124,141,255,0.12)"; }}
              data-testid={`question-option-${data.questionId}-${opt.replace(/\s+/g, "-").toLowerCase()}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
