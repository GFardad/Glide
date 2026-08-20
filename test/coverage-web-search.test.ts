import { describe, it, expect, vi } from "vitest";
import { glideWebSearchTool } from "../packages/mcp-server/src/tools/glide-web-search.js";

function textOf(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const item = result.content[0];
  return item && typeof item.text === "string" ? item.text : "";
}

describe("glide_web_search", () => {
  it("rejects missing query", async () => {
    const result = await glideWebSearchTool.handler({});
    const parsed = JSON.parse(textOf(result));
    expect(parsed).toMatchObject({ ok: false, error: "query is required" });
  });

  it("defaults limit to 5 and caps at 20", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
    } as unknown as Response);

    const result = await glideWebSearchTool.handler({
      query: "glide",
      limit: 100,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.results).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(calledUrl).toContain("q=glide");
  });

  it("returns parsed results from DuckDuckGo HTML", async () => {
    const html = `
      <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage1">Example Page 1</a>
      <a class="result__snippet">First snippet text here.</a>
      <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage2">Example Page 2</a>
      <a class="result__snippet">Second snippet text here.</a>
    `;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => html,
    } as unknown as Response);

    const result = await glideWebSearchTool.handler({ query: "test", limit: 2 });
    const parsed = JSON.parse(textOf(result));
    expect(parsed).toMatchObject({
      ok: true,
      query: "test",
      results: [
        { title: "Example Page 1", snippet: "First snippet text here." },
        { title: "Example Page 2", snippet: "Second snippet text here." },
      ],
    });
    expect(parsed.results[0].url).toBe("https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage1");
    expect(parsed.results[1].url).toBe("https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage2");
  });

  it("returns empty results when DuckDuckGo returns no matches", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "<html><body>No results found.</body></html>",
    } as unknown as Response);

    const result = await glideWebSearchTool.handler({ query: "obscure-query-xyz" });
    const parsed = JSON.parse(textOf(result));
    expect(parsed).toMatchObject({ ok: true, results: [] });
  });

  it("returns structured error on non-ok HTTP response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as unknown as Response);

    const result = await glideWebSearchTool.handler({ query: "fail" });
    const parsed = JSON.parse(textOf(result));
    expect(parsed).toMatchObject({ ok: false, error: expect.stringContaining("500") });
  });

  it("returns structured error on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));

    const result = await glideWebSearchTool.handler({ query: "fail" });
    const parsed = JSON.parse(textOf(result));
    expect(parsed).toMatchObject({ ok: false, error: "network down" });
  });
});
