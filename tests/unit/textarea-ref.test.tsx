// tests/unit/textarea-ref.test.tsx
import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, it, expect } from "vitest";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  // G16: react-hook-form's register() passes a ref; a plain function component
  // drops it on React 18, so an invalid description could never be focused.
  it("forwards its ref to the DOM textarea", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="t" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("keeps the data-slot and merges className", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} className="extra" aria-label="t" />);
    expect(ref.current).toHaveAttribute("data-slot", "textarea");
    expect(ref.current).toHaveClass("extra");
  });
});
