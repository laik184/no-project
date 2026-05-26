export const MARKDOWN_STYLES = `
.agent-md { font-size: 11.5px; line-height: 1.65; color: rgba(226,232,240,0.92); }

/* Headings */
.agent-md h1, .agent-md h2, .agent-md h3, .agent-md h4 {
  font-weight: 600; margin: 0.9em 0 0.35em; color: rgba(226,232,240,1);
  line-height: 1.3;
}
.agent-md h1 { font-size: 15px; }
.agent-md h2 { font-size: 13px; }
.agent-md h3 { font-size: 12px; }
.agent-md h4 { font-size: 11.5px; }
.agent-md h1:first-child, .agent-md h2:first-child,
.agent-md h3:first-child, .agent-md h4:first-child { margin-top: 0; }

/* Paragraphs */
.agent-md p { margin: 0 0 0.6em; }
.agent-md p:last-child { margin-bottom: 0; }

/* Bold / Italic */
.agent-md strong { font-weight: 600; color: rgba(226,232,240,1); }
.agent-md em { font-style: italic; color: rgba(196,212,230,0.9); }

/* Inline code */
.agent-md code:not([class]) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 10.5px;
  background: rgba(124,141,255,0.12);
  border: 1px solid rgba(124,141,255,0.22);
  color: #a78bfa;
  padding: 1px 5px;
  border-radius: 5px;
  white-space: nowrap;
}

/* Code blocks */
.agent-md pre {
  margin: 0.65em 0;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(8,10,20,0.75);
  border: 1px solid rgba(255,255,255,0.08);
}
.agent-md pre:last-child { margin-bottom: 0; }

.agent-md .code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  background: rgba(255,255,255,0.04);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.agent-md .code-lang-label {
  font-size: 9.5px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148,163,184,0.55);
  font-family: 'JetBrains Mono', monospace;
}
.agent-md .code-copy-btn {
  font-size: 9.5px;
  color: rgba(148,163,184,0.4);
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.07);
  background: transparent;
  transition: all 0.15s;
}
.agent-md .code-copy-btn:hover {
  color: rgba(167,139,250,0.9);
  border-color: rgba(124,141,255,0.3);
  background: rgba(124,141,255,0.08);
}

.agent-md pre code {
  display: block;
  padding: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 10.5px;
  line-height: 1.7;
  color: rgba(203,213,225,0.92);
  background: transparent !important;
  border: none !important;
  overflow-x: auto;
  white-space: pre;
}

/* Prism token colors — Replit-style dark theme */
.agent-md .token.comment    { color: rgba(100,116,139,0.8); font-style: italic; }
.agent-md .token.string     { color: #86efac; }
.agent-md .token.number     { color: #fb923c; }
.agent-md .token.keyword    { color: #818cf8; font-style: italic; }
.agent-md .token.function   { color: #38bdf8; }
.agent-md .token.class-name { color: #f472b6; }
.agent-md .token.operator   { color: rgba(203,213,225,0.7); }
.agent-md .token.punctuation{ color: rgba(148,163,184,0.6); }
.agent-md .token.property   { color: #7dd3fc; }
.agent-md .token.boolean    { color: #fb923c; }
.agent-md .token.tag        { color: #818cf8; }
.agent-md .token.attr-name  { color: #38bdf8; }
.agent-md .token.attr-value { color: #86efac; }
.agent-md .token.selector   { color: #f472b6; }
.agent-md .token.regex      { color: #f59e0b; }
.agent-md .token.builtin    { color: #34d399; }
.agent-md .token.important  { color: #f472b6; font-weight: 600; }

/* Lists */
.agent-md ul, .agent-md ol {
  margin: 0.4em 0 0.6em;
  padding-left: 18px;
}
.agent-md ul:last-child, .agent-md ol:last-child { margin-bottom: 0; }
.agent-md li { margin: 0.15em 0; }
.agent-md ul { list-style: none; padding-left: 0; }
.agent-md ul li { padding-left: 14px; position: relative; }
.agent-md ul li::before {
  content: '';
  position: absolute; left: 0; top: 7px;
  width: 4px; height: 4px;
  border-radius: 50%;
  background: rgba(124,141,255,0.7);
}
.agent-md ol { list-style: decimal; }
.agent-md ol li { color: rgba(226,232,240,0.9); }

/* Nested lists */
.agent-md li > ul, .agent-md li > ol { margin: 0.1em 0 0; }

/* Blockquote */
.agent-md blockquote {
  margin: 0.5em 0;
  padding: 6px 10px;
  border-left: 2.5px solid rgba(124,141,255,0.5);
  background: rgba(124,141,255,0.05);
  border-radius: 0 6px 6px 0;
  color: rgba(203,213,225,0.8);
}
.agent-md blockquote p { margin: 0; }

/* Horizontal rule */
.agent-md hr {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.08);
  margin: 0.8em 0;
}

/* Links */
.agent-md a {
  color: #7c8dff;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: rgba(124,141,255,0.4);
}
.agent-md a:hover { color: #a78bfa; text-decoration-color: rgba(167,139,250,0.6); }

/* Tables */
.agent-md table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.6em 0;
  font-size: 11px;
}
.agent-md th {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 5px 10px;
  text-align: left;
  font-weight: 600;
  color: rgba(226,232,240,0.9);
}
.agent-md td {
  border: 1px solid rgba(255,255,255,0.07);
  padding: 4px 10px;
  color: rgba(203,213,225,0.85);
}
.agent-md tr:hover td { background: rgba(255,255,255,0.02); }
`;
