/**
 * Safely parses `front_image_url` / `back_image_url` into a string array of image URLs.
 * Handles legacy single URL strings, JSON array strings, or delimiter-separated strings.
 */
export function parseImageUrls(val?: string | null): string[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (!trimmed) return [];

  // Check if JSON array string
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => Boolean(s && typeof s === 'string' && s.trim()));
      }
    } catch (e) {}
  }

  // Check delimiter fallback
  if (trimmed.includes('|||')) {
    return trimmed.split('|||').map(s => s.trim()).filter(Boolean);
  }

  return [trimmed];
}

/**
 * Serializes an array of image URLs into a string for `front_image_url` / `back_image_url`.
 * 1 image  -> raw URL string (100% backward compatible with DB schema)
 * >1 image -> JSON string array
 * 0 images -> null
 */
export function serializeImageUrls(urls: string[]): string | null {
  const filtered = urls.map(s => (s || '').trim()).filter(Boolean);
  if (filtered.length === 0) return null;
  if (filtered.length === 1) return filtered[0];
  return JSON.stringify(filtered);
}
