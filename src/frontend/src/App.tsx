import { Toaster } from "@/components/ui/sonner";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import BattleZoneGame from "./Game";

// Root route
const rootRoute = createRootRoute({
  component: () => <RouterProvider router={router} />,
});

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: BattleZoneGame,
});

const routeTree = rootRoute.addChildren([indexRoute]);
const router = createRouter({ routeTree });

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  );
}
