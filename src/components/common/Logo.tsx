import { cn } from "@/lib/utils";

interface LogoProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { icon: "h-5 w-5", text: "text-lg" },
  md: { icon: "h-6 w-6", text: "text-xl" },
  lg: { icon: "h-8 w-8", text: "text-2xl" },
};

export function Logo({ showText = true, size = "md", className }: LogoProps) {
  const s = sizeMap[size];

  return (
    <span
      role="img"
      aria-label="Mirox Shop"
      className={cn("inline-flex items-center gap-2 text-current", className)}
    >
      <svg
        viewBox="0 0 24 24"
        className={s.icon}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* shopping bag */}
        <path d="M6 8h12l-1 12H7L6 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        {/* M monogram */}
        <path d="M9.5 16.5v-5l2.5 3 2.5-3v5" strokeWidth={1.5} />
      </svg>
      {showText && (
        <span className={cn("font-heading font-extrabold tracking-tight", s.text)}>Mirox Shop</span>
      )}
    </span>
  );
}
