// Generate custom URLs for different pages and websites
// Format: https://solopilot-{page}-{randomId}.dev

type PageType = "agent" | "console" | "publish" | "preview" | "grid";

let urlCache: { [key: string]: string } = {};

function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export function getCustomUrl(
  pageType: PageType,
  baseUrl?: string
): string {
  // If we're on localhost, use a local URL
  if (baseUrl?.includes("localhost") || baseUrl?.includes("127.0.0.1")) {
    const port = baseUrl?.split(":")[1] || "5000";
    return `http://localhost:${port}/${pageType}`;
  }

  // Generate or retrieve cached custom URL for this page
  const cacheKey = pageType;
  
  if (!urlCache[cacheKey]) {
    urlCache[cacheKey] = `https://solopilot-${pageType}-${generateRandomId()}.dev`;
  }
  
  return urlCache[cacheKey];
}

// Get QR code data URL format
export function getQRCodeValue(url: string): string {
  return url;
}

// Reset cache (useful for testing)
export function resetUrlCache(): void {
  urlCache = {};
}

// Get all page URLs
export function getAllPageUrls(baseUrl?: string): Record<PageType, string> {
  const pages: PageType[] = ["agent", "console", "publish", "preview", "grid"];
  const urls: Record<PageType, string> = {} as Record<PageType, string>;
  
  pages.forEach((page) => {
    urls[page] = getCustomUrl(page, baseUrl);
  });
  
  return urls;
}
