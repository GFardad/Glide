import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";

export const glideWebSearchTool: GlideTool = {
  name: "glide_web_search",
  description: "Search the web and return ranked results with title, url, and snippet.",
  allowedRoles: ["CEO", "Architect", "Engineer", "Product", "Security", "QA", "agent"],
  requiredScopes: ["web_search"],
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number", minimum: 1, maximum: 20 },
      subject_role: { type: "string" },
    },
    required: ["query"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const query = args.query as string;
    const limit = typeof args.limit === "number" ? args.limit : 5;
    if (!query || query.trim().length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: "query is required" }) }],
        isError: true,
      };
    }

    try {
      const results = await webSearch(query, Math.min(Math.max(limit, 1), 20));
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, query, results }) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }) }],
        isError: true,
      };
    }
  },
};

async function webSearch(query: string, limit: number): Promise<Array<Record<string, string>>> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Glide/0.1.0; +https://github.com/GFardad/Glide)",
    },
  });
  if (!response.ok) {
    throw new Error(`web_search failed: ${response.status}`);
  }
  const html = await response.text();
  const results: Array<Record<string, string>> = [];
  const regex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/gs;
  const hrefMatches = Array.from(html.matchAll(regex));
  const snippetMatches = Array.from(html.matchAll(snippetRegex));
  for (let i = 0; i < Math.min(limit, hrefMatches.length); i++) {
    const hrefMatch = hrefMatches[i]!;
    const snippetMatch = snippetMatches[i];
    const rawHref = hrefMatch[1] || "";
    const href = resolveDuckDuckGoRedirect(rawHref);
    const title = stripHtml(hrefMatch[2] || "");
    const snippet = snippetMatch ? stripHtml(snippetMatch[1] || "") : "";
    if (href && title) {
      results.push({ title, url: href, snippet });
    }
  }
  return results;
}

function resolveDuckDuckGoRedirect(href: string): string {
  if (!href) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (/^https?:\/\//.test(href)) return href;
  return `https://duckduckgo.com${href}`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)))
    .trim();
}
