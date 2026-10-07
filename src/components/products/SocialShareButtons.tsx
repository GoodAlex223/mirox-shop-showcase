"use client";

import { useTranslations } from "next-intl";
import { Facebook, Twitter, MessageCircle, Send, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildShareUrl, canUseNativeShare, triggerNativeShare } from "@/lib/share-utils";
import { trackShare } from "@/lib/analytics";
import type { SharePlatform } from "@/lib/share-utils";

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6c-2.8 0-5 2-5 4.5 0 1.7 1 3.2 2.5 3.9-.1-.7 0-1.6.2-2.4l.7-2.8s-.2-.4-.2-1c0-1 .6-1.7 1.3-1.7.6 0 .9.5.9 1 0 .6-.4 1.6-.6 2.4-.2.7.3 1.3 1.1 1.3 1.3 0 2.2-1.7 2.2-3.7 0-1.5-1-2.7-2.9-2.7-2.1 0-3.4 1.6-3.4 3.3 0 .6.2 1 .4 1.4.1.1.1.2.1.3l-.2.7c0 .1-.1.2-.3.1-1-.4-1.4-1.5-1.4-2.7 0-2.1 1.8-4.5 5.3-4.5 2.8 0 4.7 2 4.7 4.3 0 2.9-1.6 5-4 5-.8 0-1.5-.4-1.8-.9l-.5 2c-.2.7-.6 1.4-.9 1.9" />
    </svg>
  );
}

interface SocialShareButtonsProps {
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
}

const SHARE_PLATFORMS: {
  platform: SharePlatform;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { platform: "facebook", icon: Facebook, label: "Facebook" },
  { platform: "twitter", icon: Twitter, label: "X" },
  { platform: "pinterest", icon: PinterestIcon, label: "Pinterest" },
  { platform: "whatsapp", icon: MessageCircle, label: "WhatsApp" },
  { platform: "telegram", icon: Send, label: "Telegram" },
];

export function SocialShareButtons({
  productId,
  productName,
  productSlug,
  productImage,
}: SocialShareButtonsProps) {
  const t = useTranslations("products");
  const getUrl = () => `${window.location.origin}/products/${productSlug}`;

  const handlePlatformShare = (platform: SharePlatform) => {
    const url = getUrl();
    trackShare(platform, "product", productId);

    const shareUrl = buildShareUrl(platform, {
      url,
      title: productName,
      imageUrl: productImage,
    });

    window.open(shareUrl, "_blank", "width=600,height=500,resizable,scrollbars");
  };

  const handleCopyLink = async () => {
    const url = getUrl();
    trackShare("copy", "product", productId);

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.linkCopied"));
    } catch {
      toast.error(t("share.copyFailed"));
    }
  };

  const handleNativeShare = async () => {
    if (!canUseNativeShare()) {
      await handleCopyLink();
      return;
    }

    const url = getUrl();
    trackShare("native", "product", productId);

    try {
      await triggerNativeShare({ url, title: productName });
    } catch {
      // Native share failed — fall back to copy link
      await handleCopyLink();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-sm font-medium">{t("share.label")}</span>

      {SHARE_PLATFORMS.map(({ platform, icon: Icon, label }) => (
        <Button
          key={platform}
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handlePlatformShare(platform)}
          aria-label={t("share.platformAria", { platform: label })}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleCopyLink}
        aria-label={t("share.copyAria")}
      >
        <Link2 className="h-3.5 w-3.5" />
      </Button>

      {/* Native share button — visible on mobile only. Falls back to copy if Web Share API unavailable. */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 sm:hidden"
        onClick={handleNativeShare}
        aria-label={t("share.nativeAria")}
      >
        <Share2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
