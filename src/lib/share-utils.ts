// Share URL builders and Web Share API utilities

export type SharePlatform =
  | "facebook"
  | "twitter"
  | "pinterest"
  | "whatsapp"
  | "telegram"
  | "copy"
  | "native";

interface ShareUrlParams {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

/**
 * Build platform-specific share URL.
 * All parameters are properly URI-encoded.
 */
export function buildShareUrl(platform: SharePlatform, params: ShareUrlParams): string {
  const { url, title, imageUrl } = params;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  switch (platform) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

    case "twitter":
      return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;

    case "pinterest": {
      const base = `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`;
      return imageUrl ? `${base}&media=${encodeURIComponent(imageUrl)}` : base;
    }

    case "whatsapp":
      return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;

    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;

    default:
      return url;
  }
}

/**
 * Check if Web Share API is available (mobile browsers).
 */
export function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

/**
 * Trigger the native share sheet via Web Share API.
 * Silently handles user cancellation (AbortError).
 */
export async function triggerNativeShare(params: ShareUrlParams): Promise<void> {
  await navigator.share({
    title: params.title,
    text: params.description || params.title,
    url: params.url,
  });
}
