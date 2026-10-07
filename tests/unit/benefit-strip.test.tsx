import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Truck, Award } from "lucide-react";
import { BenefitStrip } from "@/components/common/BenefitStrip";

const items = [
  { icon: Truck, title: "Fast delivery", description: "1–3 days across Ukraine" },
  { icon: Award, title: "Premium quality", description: "Only the best fabrics" },
];

describe("BenefitStrip", () => {
  it("renders every supplied item", () => {
    render(<BenefitStrip items={items} />);
    expect(screen.getByText("Fast delivery")).toBeInTheDocument();
    expect(screen.getByText("Premium quality")).toBeInTheDocument();
  });

  it("renders each item's description", () => {
    render(<BenefitStrip items={items} />);
    expect(screen.getByText("1–3 days across Ukraine")).toBeInTheDocument();
  });

  it("renders nothing when given no items", () => {
    const { container } = render(<BenefitStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
