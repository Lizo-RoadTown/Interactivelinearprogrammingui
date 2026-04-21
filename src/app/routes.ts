import { createBrowserRouter } from "react-router";
import MainWorkspace from "./pages/MainWorkspace";
import PracticeMode from "./pages/PracticeMode";
import SensitivityMode from "./pages/SensitivityMode";
import WorkspacePage from "./pages/workspace/WorkspacePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainWorkspace,
  },
  {
    // New unified workspace — the future home of all guided learning.
    // Phase C will redirect /practice → /workspace?tutorial=simplex.
    // Phase D will redirect /sensitivity → /workspace?tutorial=sensitivity.
    path: "/workspace",
    Component: WorkspacePage,
  },
  {
    path: "/practice",
    Component: PracticeMode,
  },
  {
    path: "/sensitivity",
    Component: SensitivityMode,
  },
]);
