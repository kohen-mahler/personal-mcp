import { z } from "zod";

const OBSIDIAN_EXT = /\.(md|canvas|pdf|png|jpe?g|gif|bmp|svg|webp|avif|mp3|wav|m4a|flac|ogg|3gp|webm|mp4|ogv|mov)$/i;

export function obsidianPath(hint: string) {
  return z
    .string()
    .transform((p) => {
      const filename = p.split("/").pop() ?? "";
      return filename.includes(".") ? p : `${p}.md`;
    })
    .refine((p) => OBSIDIAN_EXT.test(p), {
      message: "Unsupported Obsidian file type. Omit extension to default to .md, or use a supported format (image, pdf, canvas).",
    })
    .describe(hint);
}

export function toToolText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function toToolError(error: string) {
  return { isError: true as const, ...toToolText(error) };
}
