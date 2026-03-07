import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import ProCam from "./pages/ProCam";

// Root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ProCam,
});

const routeTree = rootRoute.addChildren([indexRoute]);
const router = createRouter({ routeTree });

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </>
  );
}
