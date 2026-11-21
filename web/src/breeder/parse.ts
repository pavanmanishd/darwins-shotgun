export interface ParsedBrain {
  name: string;
  note: string;
  code: string;
}

const FENCED = /```[\w-]*[ \t]*\n([\s\S]*?)```/;
const NAME_LINE = /^[ \t]*\/\/[ \t]*NAME:[ \t]*(.*?)[ \t]*(?:\|[ \t]*NOTE:[ \t]*(.*?))?[ \t]*$/m;
const THINK = /function\s+think\s*\(/;
const DECLARATION = /^[ \t]*(?:function|const|let|var)\s/m;

export function parseBrain(text: string): ParsedBrain | null {
  const src = FENCED.exec(text)?.[1] ?? text;
  const think = THINK.exec(src);
  if (!think || functionEnd(src, think.index) === null) return null;

  const header = NAME_LINE.exec(src);
  const firstDeclaration = DECLARATION.exec(src)?.index ?? think.index;
  const start = header && header.index < think.index ? Math.min(header.index, firstDeclaration) : firstDeclaration;
  return {
    name: (header && header.index < think.index && header[1]) || "Unnamed",
    note: header && header.index < think.index ? (header[2] ?? "") : "",
    code: src.slice(start, lastTopLevelClose(src, start)).trim(),
  };
}

function lastTopLevelClose(src: string, from: number): number {
  let last = src.length;
  let pos = from;
  for (;;) {
    const open = src.indexOf("{", pos);
    if (open === -1) return last;
    const end = functionEnd(src, open);
    if (end === null) return last;
    last = src[end] === ";" ? end + 1 : end;
    pos = end;
  }
}

function functionEnd(src: string, from: number): number | null {
  const open = src.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i, c);
    } else if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i === -1) return null;
    } else if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2) + 1;
      if (i === 0) return null;
    } else if (c === "{") {
      depth++;
    } else if (c === "}" && --depth === 0) {
      return i + 1;
    }
  }
  return null;
}

function skipString(src: string, from: number, quote: string): number {
  for (let i = from + 1; i < src.length; i++) {
    if (src[i] === "\\") i++;
    else if (src[i] === quote) return i;
  }
  return src.length;
}
