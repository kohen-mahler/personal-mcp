export function toToolText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function toToolError(error: string) {
  return { isError: true as const, ...toToolText(error) };
}
