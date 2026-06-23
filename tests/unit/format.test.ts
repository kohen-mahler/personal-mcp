import { describe, it, expect } from "bun:test";
import { toToolText, toToolError } from "../../src/tools/vault/format";

describe("toToolText", () => {
  it("returns a single text content item", () => {
    const result = toToolText("hello");
    expect(result).toEqual({ content: [{ type: "text", text: "hello" }] });
  });

  it("content array has exactly one entry", () => {
    expect(toToolText("x").content).toHaveLength(1);
  });

  it("type field is the literal string 'text'", () => {
    expect(toToolText("x").content[0].type).toBe("text");
  });

  it("passes through empty string", () => {
    expect(toToolText("").content[0].text).toBe("");
  });

  it("passes through JSON string unchanged", () => {
    const json = JSON.stringify({ path: "test.md", content: "body", frontmatter: {}, tags: [], links: [] }, null, 2);
    expect(toToolText(json).content[0].text).toBe(json);
  });
});

describe("toToolError", () => {
  it("sets isError: true", () => {
    expect(toToolError("oops").isError).toBe(true);
  });

  it("includes the error message in content text", () => {
    expect(toToolError("File not found: foo.md").content[0].text).toBe("File not found: foo.md");
  });

  it("content type is text", () => {
    expect(toToolError("err").content[0].type).toBe("text");
  });

  it("spread is compatible with a toToolText result", () => {
    const err = toToolError("bad path");
    expect(err).toMatchObject({ isError: true, content: [{ type: "text", text: "bad path" }] });
  });
});

describe("tool response shapes", () => {
  it("success shape has no isError field", () => {
    const result = toToolText("data");
    expect("isError" in result).toBe(false);
  });

  it("error shape has isError: true and content", () => {
    const result = toToolError("something failed");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("something failed");
  });

  it("JSON.stringify of VaultFileData produces valid JSON in success response", () => {
    const data = { path: "notes.md", content: "# Hello", frontmatter: { title: "Hello" }, tags: ["test"], links: [] };
    const text = JSON.stringify(data, null, 2);
    const result = toToolText(text);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.path).toBe("notes.md");
    expect(parsed.frontmatter.title).toBe("Hello");
    expect(parsed.tags).toEqual(["test"]);
  });
});
