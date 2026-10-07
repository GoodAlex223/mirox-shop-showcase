import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import uk from "../../messages/uk.json";

/**
 * RTL render wrapped in the intl provider with the real UA catalog, so
 * component tests exercise exactly the strings production renders.
 */
export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(
    <NextIntlClientProvider locale="uk" messages={uk} timeZone="Europe/Kyiv">
      {ui}
    </NextIntlClientProvider>,
    options
  );
}
