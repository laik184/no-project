import { useEffect, useRef } from "react";
import { marked } from "marked";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markup";
import { MARKDOWN_STYLES } from "./agent-markdown-styles";

function parseMarkdown(raw: string): string {
  const renderer = new marked.Renderer();

  renderer.code = ({ text, lang }) => {
    const language = lang?.trim().toLowerCase() || "text";
    const grammar = (Prism.languages as Record<string, Prism.Grammar | undefined>)[language];
    const highlighted = grammar
      ? Prism.highlight(text, grammar, language)
      : text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const id = `code-${Math.random().toString(36).slice(2, 8)}`;
    return `
      <pre>
        <div class="code-block-header">
          <span class="code-lang-label">${language}</span>
          <button class="code-copy-btn" data-copy-id="${id}">Copy</button>
        </div>
        <code id="${id}" class="language-${language}">${highlighted}</code>
      </pre>`;
  };

  marked.setOptions({ breaks: true });
  return marked.parse(raw, { renderer }) as string;
}

interface AgentMarkdownProps {
  content: string;
}

export function AgentMarkdown({ content }: AgentMarkdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const buttons = ref.current.querySelectorAll<HTMLButtonElement>(".code-copy-btn");
    buttons.forEach((btn) => {
      const id = btn.getAttribute("data-copy-id");
      const codeEl = id ? ref.current!.querySelector<HTMLElement>(`#${id}`) : null;
      if (!codeEl) return;
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(codeEl.innerText ?? "").then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => { btn.textContent = "Copy"; }, 2000);
        });
      });
    });
  }, [content]);

  const html = parseMarkdown(content);

  return (
    <>
      <style>{MARKDOWN_STYLES}</style>
      <div
        ref={ref}
        className="agent-md"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
