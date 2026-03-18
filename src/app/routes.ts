import { createBrowserRouter } from "react-router";
import MainWorkspace from "./pages/MainWorkspace";
import PracticeMode from "./pages/PracticeMode";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainWorkspace,
  },
  {
    path: "/practice",
    Component: PracticeMode,
  },
]);
