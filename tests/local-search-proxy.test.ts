import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { classifySource, normalizeSearchResultUrl } =
  require("../src/main/local-search-proxy.cjs") as {
    classifySource: (url: string) => Record<string, string>;
    normalizeSearchResultUrl: (url: string) => string;
  };

describe("local search source classification", () => {
  it("only grants reliability labels to exact domains and subdomains", () => {
    expect(classifySource("https://www.reuters.com/world")).toEqual({
      source_type: "news",
      reliability: "high",
    });
    expect(classifySource("https://investors.bbc.co.uk/story")).toEqual({
      source_type: "news",
      reliability: "high",
    });
    expect(classifySource("https://stackoverflow.com/questions/1")).toEqual({
      source_type: "forum",
      reliability: "medium",
    });

    expect(classifySource("https://notreuters.com/story")).toEqual({});
    expect(classifySource("https://stackoverflow.com.attacker.test/q")).toEqual(
      {},
    );
    expect(classifySource("https://agency.gov.attacker.test/report")).toEqual(
      {},
    );
  });
});

describe("local search result URLs", () => {
  it("unwraps provider tracking redirects before returning results", () => {
    expect(
      normalizeSearchResultUrl(
        "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Freport",
      ),
    ).toBe("https://example.com/report");

    const target = "https://www.nvidia.com/en-us/data-center/dgx-spark/";
    const encoded = Buffer.from(target).toString("base64url");
    expect(
      normalizeSearchResultUrl(`https://www.bing.com/ck/a?u=a1${encoded}`),
    ).toBe(target);
  });
});
