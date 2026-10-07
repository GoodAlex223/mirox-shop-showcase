import dynamic from "next/dynamic";
import { Header, Footer, AnnouncementBar } from "@/components/common";

// Dynamic import CartDrawer to avoid SSR issues with zustand store
const CartDrawer = dynamic(
  () => import("@/components/shop/CartDrawer").then((mod) => mod.CartDrawer),
  {
    ssr: false,
  }
);

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-50">
        <Header />
        <AnnouncementBar />
      </div>
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
