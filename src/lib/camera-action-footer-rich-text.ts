import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

export type RichTextSizeToken = "sm" | "base" | "lg" | "xl";

export const RICH_TEXT_SIZE_OPTIONS: ReadonlyArray<{
  token: RichTextSizeToken;
  label: string;
  rem: string;
}> = [
  { token: "sm", label: "작게", rem: "0.85rem" },
  { token: "base", label: "기본", rem: "1rem" },
  { token: "lg", label: "크게", rem: "1.1rem" },
  { token: "xl", label: "더 크게", rem: "1.25rem" },
];

const SIZE_TOKEN_SET = new Set(RICH_TEXT_SIZE_OPTIONS.map((o) => o.token));
const SIZE_REM_BY_TOKEN = Object.fromEntries(
  RICH_TEXT_SIZE_OPTIONS.map((o) => [o.token, o.rem]),
) as Record<RichTextSizeToken, string>;

type RichNode =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: RichNode[] }
  | { kind: "color"; color: string; children: RichNode[] }
  | { kind: "size"; size: string; children: RichNode[] };

function isValidHexColor(raw: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.trim());
}

function normalizeColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!isValidHexColor(trimmed)) return null;
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

function normalizeSize(raw: string): string | null {
  const trimmed = raw.trim();
  if (SIZE_TOKEN_SET.has(trimmed as RichTextSizeToken)) {
    return SIZE_REM_BY_TOKEN[trimmed as RichTextSizeToken];
  }
  if (/^\d+(\.\d+)?rem$/.test(trimmed)) {
    const value = Number.parseFloat(trimmed);
    if (value >= 0.75 && value <= 2) return trimmed;
  }
  return null;
}

function findNextMarkupIndex(input: string, from: number): number {
  const indices = [
    input.indexOf("**", from),
    input.indexOf("[color=", from),
    input.indexOf("[size=", from),
  ].filter((index) => index >= 0);
  if (indices.length === 0) return -1;
  return Math.min(...indices);
}

export function parseCameraActionFooterRichText(input: string): RichNode[] {
  const nodes: RichNode[] = [];
  let pos = 0;

  while (pos < input.length) {
    const next = findNextMarkupIndex(input, pos);
    if (next === -1) {
      const rest = input.slice(pos);
      if (rest) nodes.push({ kind: "text", value: rest });
      break;
    }

    if (next > pos) {
      nodes.push({ kind: "text", value: input.slice(pos, next) });
      pos = next;
    }

    const colorOpen = input.slice(pos).match(/^\[color=([^\]]+)\]/);
    if (colorOpen) {
      const param = colorOpen[1] ?? "";
      const openLen = colorOpen[0].length;
      const closeTag = "[/color]";
      const closeIdx = input.indexOf(closeTag, pos + openLen);
      if (closeIdx === -1) {
        nodes.push({ kind: "text", value: input.slice(pos, pos + 1) });
        pos += 1;
        continue;
      }
      const inner = input.slice(pos + openLen, closeIdx);
      const color = normalizeColor(param);
      const children = parseCameraActionFooterRichText(inner);
      if (color) {
        nodes.push({ kind: "color", color, children });
      } else {
        nodes.push({
          kind: "text",
          value: input.slice(pos, closeIdx + closeTag.length),
        });
      }
      pos = closeIdx + closeTag.length;
      continue;
    }

    const sizeOpen = input.slice(pos).match(/^\[size=([^\]]+)\]/);
    if (sizeOpen) {
      const param = sizeOpen[1] ?? "";
      const openLen = sizeOpen[0].length;
      const closeTag = "[/size]";
      const closeIdx = input.indexOf(closeTag, pos + openLen);
      if (closeIdx === -1) {
        nodes.push({ kind: "text", value: input.slice(pos, pos + 1) });
        pos += 1;
        continue;
      }
      const inner = input.slice(pos + openLen, closeIdx);
      const size = normalizeSize(param);
      const children = parseCameraActionFooterRichText(inner);
      if (size) {
        nodes.push({ kind: "size", size, children });
      } else {
        nodes.push({
          kind: "text",
          value: input.slice(pos, closeIdx + closeTag.length),
        });
      }
      pos = closeIdx + closeTag.length;
      continue;
    }

    if (input.startsWith("**", pos)) {
      const closeIdx = input.indexOf("**", pos + 2);
      if (closeIdx === -1) {
        nodes.push({ kind: "text", value: "**" });
        pos += 2;
        continue;
      }
      const inner = input.slice(pos + 2, closeIdx);
      nodes.push({
        kind: "bold",
        children: parseCameraActionFooterRichText(inner),
      });
      pos = closeIdx + 2;
      continue;
    }

    nodes.push({ kind: "text", value: input.slice(pos, pos + 1) });
    pos += 1;
  }

  return nodes;
}

function renderRichNodes(nodes: RichNode[], keyPrefix: string): ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.kind === "text") {
      return createElement(Fragment, { key }, node.value);
    }
    if (node.kind === "bold") {
      return createElement(
        "strong",
        { key, className: "font-semibold" },
        renderRichNodes(node.children, key),
      );
    }
    if (node.kind === "color") {
      return createElement(
        "span",
        { key, style: { color: node.color } },
        renderRichNodes(node.children, key),
      );
    }
    return createElement(
      "span",
      { key, style: { fontSize: node.size } },
      renderRichNodes(node.children, key),
    );
  });
}

export function renderCameraActionFooterRichText(
  input: string,
  keyPrefix = "rich",
): ReactNode {
  if (!input) return null;
  return renderRichNodes(parseCameraActionFooterRichText(input), keyPrefix);
}

export function wrapRichTextSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
): { nextValue: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  const nextValue =
    value.slice(0, selectionStart) +
    before +
    selected +
    after +
    value.slice(selectionEnd);
  const cursorStart = selectionStart + before.length;
  const cursorEnd = cursorStart + selected.length;
  return {
    nextValue,
    selectionStart: cursorStart,
    selectionEnd: cursorEnd,
  };
}
