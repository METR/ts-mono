// Main React App Component
export { App } from "./app/App";

// Client APIs
export { clientApi } from "./client/api/client-api";
export { default as simpleHttpApi } from "./client/api/static-http/api-static-http.ts";
export { viewServerApi as createViewServerApi } from "./client/api/view-server/api-view-server.ts";

// Client API - Types
export type {
  Capabilities,
  ClientAPI,
  LogViewAPI,
  LogRoot,
  LogContents,
  LogPreview,
  PendingSampleResponse,
  SampleDataResponse,
} from "./client/api/types";

// Log types
export type {
  EvalSet,
  LogHandle,
  LogFilesResponse,
} from "@tsmono/inspect-common/types";

// State Store
export { initializeStore } from "./state/store";

// Transcript layout — re-exported from inspect-components so consumers of
// @metrevals/inspect-log-viewer can render transcripts with their own data
// (e.g. paginated, warehouse-backed event slices).
export {
  TranscriptLayout,
  kTranscriptCollapseScope,
} from "@tsmono/inspect-components/transcript";
export type {
  TranscriptLayoutProps,
  TranscriptCollapseState,
} from "@tsmono/inspect-components/transcript";

// Context providers required by TranscriptLayout. Hosts must wrap any
// transcript-rendering subtree with all three: ComponentIconProvider (icon
// class names for shared UI), ComponentStateProvider (host-side state
// hooks), and ComponentNavigationProvider (host-side navigate function).
// ComponentNavigationProvider must live *inside* the router tree because
// it typically wraps the host's `useNavigate()`.
export { ComponentIconProvider } from "@tsmono/react/components";
export { ComponentNavigationProvider } from "@tsmono/react/components";
export { ExtendedFindProvider } from "@tsmono/react/components";
export { ComponentStateProvider } from "@tsmono/react/state";
export type {
  ComponentIcons,
  ComponentNavigation,
} from "@tsmono/react/components";
export type { ComponentStateHooks } from "@tsmono/react/state";

export type { Event, ChatMessage } from "@tsmono/inspect-common/types";
