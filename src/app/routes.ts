import { createBrowserRouter } from "react-router";
import MainWorkspace from "./pages/MainWorkspace";
import PracticeMode from "./pages/PracticeMode";
import SensitivityMode from "./pages/SensitivityMode";
import WorkspacePage from "./pages/workspace/WorkspacePage";
import GuidedLearnPage from "./pages/workspace/GuidedLearnPage";
import EducatorPortal from "./pages/EducatorPortal";
import MatrixMethodWorkspace from "./pages/workspace/matrixMethod/MatrixMethodWorkspace";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainWorkspace,
  },
  {
    // Guided homework-style walkthrough — the main learning experience.
    // Blank canvas + word problem + one question at a time; the LP builds
    // up as the student answers.
    path: "/learn/:problemId",
    Component: GuidedLearnPage,
  },
  {
    // Free-exploration workspace (advanced / post-learning review).
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
  {
    // Team-project portal: three Python functions the beginners wrote,
    // demoed end-to-end. Three cards, one per teammate.
    path: "/educator",
    Component: EducatorPortal,
  },
  {
    // Chapter 8 Matrix Method gameboard. Three zones: the LP problem,
    // the identification workspace, and the Table 8.1 tableau being
    // assembled. Step 12 ends with the two-language z* payoff.
    path: "/matrix-method/:exampleId",
    Component: MatrixMethodWorkspace,
  },
  {
    path: "/matrix-method",
    Component: MatrixMethodWorkspace,
  },
]);
