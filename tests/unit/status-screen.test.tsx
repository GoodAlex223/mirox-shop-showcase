import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { XCircle, CheckCircle2 } from "lucide-react";
import { StatusScreen } from "@/components/common/StatusScreen";

describe("StatusScreen", () => {
  it("renders title, description and meta", () => {
    render(
      <StatusScreen title="Щось пішло не так" description="Опис помилки" meta="Код помилки: abc" />
    );
    expect(screen.getByRole("heading", { name: "Щось пішло не так" })).toBeInTheDocument();
    expect(screen.getByText("Опис помилки")).toBeInTheDocument();
    expect(screen.getByText("Код помилки: abc")).toBeInTheDocument();
  });

  it("renders href actions as links and onClick actions as buttons", () => {
    const onClick = vi.fn();
    render(
      <StatusScreen
        title="Т"
        actions={[
          { label: "На головну", href: "/" },
          { label: "Спробувати ще раз", onClick },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "На головну" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("maps tone to token classes on the icon", () => {
    const { container: err } = render(<StatusScreen icon={XCircle} tone="error" title="Помилка" />);
    expect(err.querySelector("svg")).toHaveClass("text-destructive");
    const { container: ok } = render(
      <StatusScreen icon={CheckCircle2} tone="success" title="Готово" />
    );
    expect(ok.querySelector("svg")).toHaveClass("text-foreground");
  });

  it("omits icon and actions blocks when not provided", () => {
    const { container } = render(<StatusScreen title="404" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
