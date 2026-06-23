import { describe, it, expect } from "bun:test";
import { extractLinks, isFilteredPath } from "../../src/tools/vault/read";

// ─── isFilteredPath ───────────────────────────────────────────────────────────

describe("isFilteredPath", () => {
  it("filters local image extensions", () => {
    expect(isFilteredPath("photo.png")).toBe(true);
    expect(isFilteredPath("photo.jpg")).toBe(true);
    expect(isFilteredPath("photo.jpeg")).toBe(true);
    expect(isFilteredPath("photo.gif")).toBe(true);
    expect(isFilteredPath("photo.svg")).toBe(true);
    expect(isFilteredPath("photo.webp")).toBe(true);
  });

  it("filters local media and binary files", () => {
    expect(isFilteredPath("video.mp4")).toBe(true);
    expect(isFilteredPath("audio.mp3")).toBe(true);
    expect(isFilteredPath("doc.pdf")).toBe(true);
  });

  it("does not filter local markdown files", () => {
    expect(isFilteredPath("Notes/file.md")).toBe(false);
    expect(isFilteredPath("note")).toBe(false);
  });

  it("filters external image URLs", () => {
    expect(isFilteredPath("https://example.com/img.png")).toBe(true);
    expect(isFilteredPath("https://example.com/photo.jpg")).toBe(true);
    expect(isFilteredPath("http://example.com/icon.svg")).toBe(true);
  });

  it("does NOT filter external PDF URLs (academic papers are useful)", () => {
    expect(isFilteredPath("https://arxiv.org/pdf/paper.pdf")).toBe(false);
    expect(isFilteredPath("http://yann.lecun.com/publis/paper.pdf")).toBe(false);
  });

  it("does not filter plain external URLs with no extension", () => {
    expect(isFilteredPath("https://example.com")).toBe(false);
    expect(isFilteredPath("https://example.com/page")).toBe(false);
  });

  it("handles query strings on external URLs correctly", () => {
    expect(isFilteredPath("https://example.com/img.png?v=1")).toBe(true);
    expect(isFilteredPath("https://example.com/paper.pdf?dl=1")).toBe(false);
  });
});

// ─── extractLinks ─────────────────────────────────────────────────────────────

describe("extractLinks — wikilinks", () => {
  it("extracts a basic wikilink", () => {
    const result = extractLinks("see [[My Note]] for details");
    expect(result).toEqual([{ target: "My Note", type: "file" }]);
  });

  it("extracts wikilink with heading", () => {
    const result = extractLinks("see [[My Note#Section]]");
    expect(result).toEqual([{ target: "My Note", type: "file", heading: "Section" }]);
  });

  it("extracts wikilink with alias", () => {
    const result = extractLinks("see [[My Note|display text]]");
    expect(result).toEqual([{ target: "My Note", type: "file", alias: "display text" }]);
  });

  it("extracts wikilink with heading and alias", () => {
    const result = extractLinks("[[Note#Intro|read this]]");
    expect(result).toEqual([{ target: "Note", type: "file", heading: "Intro", alias: "read this" }]);
  });

  it("types folder wikilinks as folder", () => {
    const result = extractLinks("[[03 Learning/LeetCode/]]");
    expect(result).toEqual([{ target: "03 Learning/LeetCode/", type: "folder" }]);
  });

  it("filters local image wikilinks", () => {
    const result = extractLinks("[[image.png]] and [[photo.jpg]]");
    expect(result).toEqual([]);
  });

  it("deduplicates identical wikilinks", () => {
    const result = extractLinks("[[Note]] some text [[Note]]");
    expect(result).toHaveLength(1);
  });

  it("deduplicates wikilink and wikilink with alias to same target", () => {
    const result = extractLinks("[[Note]] and [[Note|alias]]");
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe("Note");
  });

  it("keeps same target with different headings as separate entries", () => {
    const result = extractLinks("[[Note#Intro]] and [[Note#Summary]]");
    expect(result).toHaveLength(2);
    expect(result[0].heading).toBe("Intro");
    expect(result[1].heading).toBe("Summary");
  });

  it("extracts multiple distinct wikilinks", () => {
    const result = extractLinks("[[Alpha]] and [[Beta]] and [[Gamma]]");
    expect(result).toHaveLength(3);
    expect(result.map((l) => l.target)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("handles wikilinks with spaces in target", () => {
    const result = extractLinks("[[My Long Note Name]]");
    expect(result).toEqual([{ target: "My Long Note Name", type: "file" }]);
  });
});

describe("extractLinks — markdown links", () => {
  it("extracts external URL as type link", () => {
    const result = extractLinks("[LessWrong](https://www.lesswrong.com/)");
    expect(result).toEqual([{ target: "https://www.lesswrong.com/", type: "link", alias: "LessWrong" }]);
  });

  it("extracts external PDF URL as type link (not filtered)", () => {
    const result = extractLinks("[LeCun paper](http://yann.lecun.com/paper.pdf)");
    expect(result).toEqual([{ target: "http://yann.lecun.com/paper.pdf", type: "link", alias: "LeCun paper" }]);
  });

  it("extracts internal markdown link as type file", () => {
    const result = extractLinks("[my note](Notes/daily.md)");
    expect(result).toEqual([{ target: "Notes/daily.md", type: "file", alias: "my note" }]);
  });

  it("filters image embeds — exclamation prefix", () => {
    const result = extractLinks("![alt text](image.png)");
    expect(result).toEqual([]);
  });

  it("filters external image URLs in embeds", () => {
    const result = extractLinks("![banner](https://example.com/banner.png)");
    expect(result).toEqual([]);
  });

  it("filters local image in markdown link", () => {
    const result = extractLinks("[logo](logo.png)");
    expect(result).toEqual([]);
  });

  it("filters local PDF in markdown link", () => {
    const result = extractLinks("[doc](local-file.pdf)");
    expect(result).toEqual([]);
  });

  it("strips optional title attribute from URL", () => {
    const result = extractLinks('[site](https://example.com "My Site")');
    expect(result[0].target).toBe("https://example.com");
  });

  it("does not extract footnote references as links", () => {
    const result = extractLinks("See[^1] for more.\n\n[^1]: footnote text");
    expect(result).toEqual([]);
  });
});

describe("extractLinks — mixed content", () => {
  it("deduplicates across wikilinks and markdown links to same target", () => {
    const result = extractLinks("[[Notes/file.md]] and [text](Notes/file.md)");
    // Both point to same target — deduplicated
    const targets = result.map((l) => l.target).filter((t) => t === "Notes/file.md");
    expect(targets).toHaveLength(1);
  });

  it("returns empty array for content with no links", () => {
    const result = extractLinks("just plain text with no links at all");
    expect(result).toEqual([]);
  });

  it("handles complex note with multiple link types", () => {
    const content = [
      "## Reading List",
      "- [[03 Learning/Books/]] — folder",
      "- [LeCun paper](https://arxiv.org/pdf/paper.pdf) — external PDF",
      "- [site](https://example.com) — external",
      "- ![image](photo.jpg) — should be filtered",
      "- [[My Note#Section|alias]] — wikilink with heading and alias",
    ].join("\n");

    const result = extractLinks(content);
    const types = result.map((l) => l.type);

    expect(types).toContain("folder");
    expect(types).toContain("link");
    expect(types).not.toContain(undefined);

    // image filtered
    expect(result.find((l) => l.target === "photo.jpg")).toBeUndefined();

    // wikilink with heading and alias
    const wl = result.find((l) => l.target === "My Note");
    expect(wl?.heading).toBe("Section");
    expect(wl?.alias).toBe("alias");
  });
});
