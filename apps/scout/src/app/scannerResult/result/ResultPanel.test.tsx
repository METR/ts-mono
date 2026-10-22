// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { type PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, it } from "vitest";

import {
  ComponentIconProvider,
  ComponentNavigationProvider,
} from "@tsmono/react/components";
import { ComponentStateProvider } from "@tsmono/react/state";
import { makeStateHooks, testIcons } from "@tsmono/react/testing";
import { AsyncData, loading } from "@tsmono/util";

import type { ScanResultDetail } from "../../../api/api";
import {
  createAppConfig,
  createScanResultData,
} from "../../../test/objectFactories";
import { server } from "../../../test/setup-msw";
import { createTestWrapper } from "../../../test/test-utils";
import type { AppConfig } from "../../../types/api-types";
import { useAppConfigAsync } from "../../server/useAppConfig";

import { ResultPanel } from "./ResultPanel";

afterEach(cleanup);

// The sidebar reads the loaded app config synchronously.
const AppConfigGate = ({ children }: PropsWithChildren) => {
  const { data } = useAppConfigAsync();
  return data ? <>{children}</> : null;
};

const resultData = createScanResultData({
  explanation: "The agent gave up early.",
});

const renderPanel = (detail: AsyncData<ScanResultDetail>) => {
  server.use(
    http.get("/api/v2/app-config", () =>
      HttpResponse.json<AppConfig>(createAppConfig())
    )
  );
  const Providers = createTestWrapper();
  render(
    <Providers>
      <ComponentIconProvider icons={testIcons}>
        <ComponentStateProvider hooks={makeStateHooks()}>
          <AppConfigGate>
            <MemoryRouter>
              <ComponentNavigationProvider navigation={{ navigate: () => {} }}>
                <ResultPanel resultData={resultData} detail={detail} />
              </ComponentNavigationProvider>
            </MemoryRouter>
          </AppConfigGate>
        </ComponentStateProvider>
      </ComponentIconProvider>
    </Providers>
  );
};

describe("ResultPanel", () => {
  it("renders the result sidebar while the input is loading", async () => {
    renderPanel(loading);
    await screen.findByText("The agent gave up early.");
    screen.getByText("Loading input");
  });

  it("shows why the input failed to load next to the result", async () => {
    renderPanel({ loading: false, error: new Error("Internal Server Error") });
    await screen.findByText("The agent gave up early.");
    screen.getByText("Error Loading Input");
    screen.getByText("Internal Server Error");
  });
});
