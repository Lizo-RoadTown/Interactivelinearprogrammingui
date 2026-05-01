import { createBrowserRouter } from "react-router";
import MainWorkspace from "./pages/MainWorkspace";
import PracticeMode from "./pages/PracticeMode";
import SensitivityMode from "./pages/SensitivityMode";
import WorkspacePage from "./pages/workspace/WorkspacePage";
import GuidedLearnPage from "./pages/workspace/GuidedLearnPage";
import EducatorPortal from "./pages/EducatorPortal";
import MatrixMethodWorkspace from "./pages/workspace/matrixMethod/MatrixMethodWorkspace";
import AdminPortal from "./pages/AdminPortal";
import NotFound from "./pages/NotFound";

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
  {
    // Professor's workspace: per-bank CRUD on the problem bank.
    // Each professor picks a bank id, that's their personal partition
    // in SQLite. List, add, edit, delete, with live validation on save.
    path: "/admin",
    Component: AdminPortal,
  },
  {
    // Catch-all — keeps the React Router default error screen from
    // ever appearing. Shows a friendly 'page not found' instead.
    path: "*",
    Component: NotFound,
  },
]);
