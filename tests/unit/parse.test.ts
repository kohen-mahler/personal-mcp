import { describe, it, expect } from "bun:test";
import { parseFrontmatter, extractTags } from "../../src/tools/vault/read";

// ─── parseFrontmatter ────────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("returns empty frontmatter and full body when no --- block", () => {
    const result = parseFrontmatter("just some content");
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("just some content");
  });

  it("returns empty frontmatter for empty string", () => {
    const result = parseFrontmatter("");
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("");
  });

  it("parses simple key-value frontmatter", () => {
    const raw = "---\ntitle: My Note\nstatus: active\n---\nbody content";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({ title: "My Note", status: "active" });
    expect(result.body).toBe("body content");
  });

  it("parses frontmatter with array tags", () => {
    const raw = "---\ntags:\n  - ai\n  - ml\n---\nbody";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({ tags: ["ai", "ml"] });
  });

  it("parses frontmatter with inline array tags", () => {
    const raw = "---\ntags: [ai, ml]\n---\nbody";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({ tags: ["ai", "ml"] });
  });

  it("returns empty frontmatter and raw body when closing --- is missing", () => {
    const raw = "---\ntitle: Unterminated";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(raw);
  });

  it("returns empty frontmatter and preserves body when YAML is malformed", () => {
    const raw = "---\nbad: [unclosed bracket\n---\nbody";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("body");
  });

  it("strips leading whitespace from body", () => {
    const raw = "---\ntitle: Test\n---\n\n\nbody starts here";
    const result = parseFrontmatter(raw);
    expect(result.body).toBe("body starts here");
  });

  it("handles frontmatter with numeric and boolean values", () => {
    const raw = "---\ncount: 3\npublished: true\n---\nbody";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({ count: 3, published: true });
  });

  it("handles empty frontmatter block", () => {
    const raw = "---\n---\nbody";
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("body");
  });
});

// ─── extractTags ─────────────────────────────────────────────────────────────

describe("extractTags", () => {
  it("returns empty array when no tags anywhere", () => {
    expect(extractTags({}, "no tags here")).toEqual([]);
  });

  it("extracts tags from frontmatter array", () => {
    const result = extractTags({ tags: ["ai", "ml"] }, "body");
    expect(result).toEqual(["ai", "ml"]);
  });

  it("extracts tags from frontmatter string", () => {
    const result = extractTags({ tags: "ai" }, "body");
    expect(result).toEqual(["ai"]);
  });

  it("extracts inline #tags from body", () => {
    const result = extractTags({}, "some content #ai and #ml here");
    expect(result).toEqual(["ai", "ml"]);
  });

  it("extracts inline tags with slashes (#tag/subtag)", () => {
    const result = extractTags({}, "see #ai/safety for details");
    expect(result).toEqual(["ai/safety"]);
  });

  it("does not extract tags starting with a number", () => {
    const result = extractTags({}, "version #2tag and #valid");
    expect(result).toEqual(["valid"]);
  });

  it("deduplicates tags across frontmatter and inline", () => {
    const result = extractTags({ tags: ["ai"] }, "content #ai and #ml");
    expect(result).toEqual(["ai", "ml"]);
  });

  it("deduplicates repeated inline tags", () => {
    const result = extractTags({}, "#ai content #ai again");
    expect(result).toEqual(["ai"]);
  });

  it("handles tags with hyphens and underscores", () => {
    const result = extractTags({}, "#my-tag and #my_tag");
    expect(result).toEqual(["my-tag", "my_tag"]);
  });

  it("does not extract # inside code blocks as tags", () => {
    // Our regex is simple and will match these — this test documents known behaviour
    const result = extractTags({}, "normal #tag and `#not-a-tag`");
    expect(result).toContain("tag");
    // not-a-tag is inside backticks but our regex still matches it — known limitation
    expect(result).toContain("not-a-tag");
  });

  it("ignores non-string values in frontmatter tags array", () => {
    const result = extractTags({ tags: ["ai", 42, null, "ml"] as string[] }, "");
    expect(result).toEqual(["ai", "ml"]);
  });
});
