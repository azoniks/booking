import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h2",
  "h3",
  "h4",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

// HTML без значимого контента (только пустые теги/пробелы) трактуем как пустоту,
// чтобы не сохранять `<p></p>` от пустого редактора.
export function isEmptyRichText(html: string): boolean {
  const stripped = html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "");
  return stripped.length === 0;
}

// Извлекает чистый текст для превью (карточки в списке). Заменяет блочные
// разделители пробелами, чтобы соседние блоки не слипались.
export function richTextToPlain(html: string): string {
  return html
    .replace(/<\/(p|li|h[1-6]|br)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
