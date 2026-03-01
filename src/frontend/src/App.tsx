import { Toaster } from "@/components/ui/sonner";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { HomePage } from "./pages/HomePage";

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <>
      <RouterProvider router={router} />
    </>
  ),
});

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const documentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/document/$documentId",
  component: function DocumentRouteComponent() {
    const { documentId } = documentRoute.useParams();
    return <DocumentDetailPage documentId={documentId} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, documentRoute]);

const router = createRouter({ routeTree });

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  );
}
