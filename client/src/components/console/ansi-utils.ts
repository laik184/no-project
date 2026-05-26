/**
 * ANSI → React-compatible inline styles
 *
 * Converts ANSI escape sequences in a raw log string into an array of
 * {text, style} segments that can be rendered as styled <span> elements.
 * Handles the most common SGR codes (colors, bold, dim, reset).
 */

export interface AnsiSegment {
  text:  string;
  style: React.CSSProperties;
}

// Standard 16-color palette (dark + bright)
const FG_COLORS: Record<number, string> = {
  30: '#4d4d4d', 31: '#ff6b6b', 32: '#6bcb77', 33: '#ffd93d',
  34: '#4d9de0', 35: '#c77dff', 36: '#4cc9f0', 37: '#d4d4d4',
  90: '#808080', 91: '#ff8787', 92: '#87ff87', 93: '#ffff87',
  94: '#87afff', 95: '#ff87ff', 96: '#87ffff', 97: '#ffffff',
};

const BG_COLORS: Record<number, string> = {
  40: '#1a1a1a', 41: '#5a0000', 42: '#005a00', 43: '#5a4a00',
  44: '#00005a', 45: '#5a005a', 46: '#005a5a', 47: '#5a5a5a',
  100:'#3a3a3a',101:'#8b0000',102:'#008b00',103:'#8b7500',
  104:'#00008b',105:'#8b008b',106:'#008b8b',107:'#c8c8c8',
};

// Match a single ESC[ ... m sequence
const SGR_RE = /\x1b\[([0-9;]*)m/g;

interface SGRState {
  fg?:      string;
  bg?:      string;
  bold?:    boolean;
  dim?:     boolean;
  italic?:  boolean;
  underline?: boolean;
}

function applyCode(code: number, state: SGRState): void {
  if (code === 0)  { Object.assign(state, { fg: undefined, bg: undefined, bold: false, dim: false, italic: false, underline: false }); return; }
  if (code === 1)  { state.bold      = true;  return; }
  if (code === 2)  { state.dim       = true;  return; }
  if (code === 3)  { state.italic    = true;  return; }
  if (code === 4)  { state.underline = true;  return; }
  if (code === 22) { state.bold = state.dim = false; return; }
  if (FG_COLORS[code]) { state.fg = FG_COLORS[code]; return; }
  if (BG_COLORS[code]) { state.bg = BG_COLORS[code]; return; }
  if (code === 39) { state.fg = undefined; return; }
  if (code === 49) { state.bg = undefined; return; }
}

function stateToStyle(s: SGRState): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (s.fg)        style.color           = s.fg;
  if (s.bg)        style.backgroundColor = s.bg;
  if (s.bold)      style.fontWeight      = 'bold';
  if (s.dim)       style.opacity         = 0.6;
  if (s.italic)    style.fontStyle       = 'italic';
  if (s.underline) style.textDecoration  = 'underline';
  return style;
}

export function parseAnsi(raw: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const state: SGRState = {};
  let lastIndex = 0;

  SGR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SGR_RE.exec(raw)) !== null) {
    // Text before this escape
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index);
      if (text) segments.push({ text, style: stateToStyle(state) });
    }

    // Apply all codes in the sequence
    const codes = match[1] ? match[1].split(';').map(Number) : [0];
    for (const code of codes) applyCode(code, state);

    lastIndex = SGR_RE.lastIndex;
  }

  // Remaining text after last escape
  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex);
    if (text) segments.push({ text, style: stateToStyle(state) });
  }

  // If no escapes found, return the entire string as one segment
  if (segments.length === 0 && raw.length > 0) {
    return [{ text: raw, style: {} }];
  }

  return segments;
}

/** Strip all ANSI codes from a string (for clipboard copy, search, etc.) */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[mGKHF]/g, '');
}
