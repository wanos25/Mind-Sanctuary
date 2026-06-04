import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import StreamDiagnosticsOverlay from "@/components/diagnostics/StreamDiagnosticsOverlay";
import PersistentAtmosphere from "@/components/ambient/PersistentAtmosphere";
import IdleBreath from "@/components/ambient/IdleBreath";
import SkipToMain from "@/components/a11y/SkipToMain";

// H5 — code-split heavy / rarely-used routes. Keeps initial bundle lean.
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const DoctorPortal = lazy(() => import("./pages/DoctorPortal"));
const DoctorLogin = lazy(() => import("./pages/DoctorLogin"));
const Activities = lazy(() => import("./pages/Activities"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => (
  <div
    className="min-h-[60vh] flex items-center justify-center"
    role="status"
    aria-live="polite"
    aria-label="Loading"
  >
    <div className="w-10 h-10 rounded-full border-2 border-muted border-t-foreground/60 animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
      <AuthProvider>
      {/* Route-persistent emotional atmosphere — one continuous environment. */}
      <PersistentAtmosphere />
      {/* Living silence — wakes only after a long idle. */}
      <IdleBreath />
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <SkipToMain />
        <ErrorBoundary label="app-root">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary label="route:index"><Index /></ErrorBoundary>} />
              <Route path="/diagnostics" element={<ErrorBoundary label="route:diagnostics"><Diagnostics /></ErrorBoundary>} />
              <Route path="/doctor-login" element={<ErrorBoundary label="route:doctor-login"><DoctorLogin /></ErrorBoundary>} />
              <Route path="/doctor" element={<ErrorBoundary label="route:doctor"><DoctorPortal /></ErrorBoundary>} />
              <Route path="/activities" element={<ErrorBoundary label="route:activities"><Activities /></ErrorBoundary>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <StreamDiagnosticsOverlay />
      </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
