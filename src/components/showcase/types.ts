// Shared types for showcase pages

export interface ShowcaseProduct {
  id: string;
  name: string;
  slug: string;
  shortDesc?: string | null;
  price: string;
  comparePrice?: string | null;
  stock: number;
  isFeatured?: boolean;
  category?: { name: string; slug: string } | null;
  images: { url: string; alt?: string | null }[];
}

export interface ShowcaseCategory {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
}

export interface ShowcaseFeature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

// Section component props
export interface HeroProps {
  title?: string;
  subtitle?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export interface ProductGridProps {
  products: ShowcaseProduct[];
  title?: string;
  showViewAll?: boolean;
}

export interface CategoriesProps {
  categories: ShowcaseCategory[];
  title?: string;
  showViewAll?: boolean;
}

export interface FeaturesProps {
  features: ShowcaseFeature[];
  title?: string;
}

export interface CTAProps {
  title?: string;
  description?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}
