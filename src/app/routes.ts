import { createBrowserRouter } from "react-router";
import MainWorkspace from "./pages/MainWorkspace";
import GuidedMode from "./pages/GuidedMode";
import InteractiveMode from "./pages/InteractiveMode";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainWorkspace,
  },
  {
    path: "/guided",
    Component: GuidedMode,
  },
  {
    path: "/interactive",
    Component: InteractiveMode,
  },
]);
