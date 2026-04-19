import { createBrowserRouter } from "react-router";
import MainWorkspace from "./pages/MainWorkspace";
import PracticeMode from "./pages/PracticeMode";
import SensitivityMode from "./pages/SensitivityMode";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainWorkspace,
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
