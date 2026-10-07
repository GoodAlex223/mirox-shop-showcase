import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import { ReviewItem } from "@/components/reviews/ReviewItem";
import type { ReviewWithUser } from "@/types";

const review: ReviewWithUser = {
  id: "r1",
  rating: 5,
  comment: "Відмінна якість!",
  adminReply: "Дякуємо!",
  adminRepliedAt: "2026-06-15T10:00:00.000Z",
  createdAt: "2026-06-12T10:00:00.000Z",
  user: { id: "u1", name: "Олександр", image: null },
};

describe("ReviewItem (Mirox restyle)", () => {
  it("renders avatar initial, verified badge, uk date", () => {
    renderWithIntl(<ReviewItem review={review} />);
    expect(screen.getByText("О")).toBeInTheDocument(); // initial circle
    expect(screen.getByText("✓ Підтверджена покупка")).toBeInTheDocument();
    expect(screen.getByText("12.06.2026")).toBeInTheDocument();
    expect(screen.getByText("Відмінна якість!")).toBeInTheDocument();
  });

  it("renders the admin reply block with uk label", () => {
    renderWithIntl(<ReviewItem review={review} />);
    expect(screen.getByText(/Відповідь магазину/)).toBeInTheDocument();
    expect(screen.getByText("Дякуємо!")).toBeInTheDocument();
  });

  it("anonymous fallback is Ukrainian", () => {
    renderWithIntl(<ReviewItem review={{ ...review, user: { ...review.user, name: null } }} />);
    expect(screen.getByText("Покупець")).toBeInTheDocument();
  });
});
