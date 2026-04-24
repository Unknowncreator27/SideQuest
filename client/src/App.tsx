import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import QuestFeed from "./pages/QuestFeed";
import QuestDetail from "./pages/QuestDetail";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import CreateQuest from "./pages/CreateQuest";
import Unlockables from "./pages/Unlockables";
import Settings from "./pages/Settings";
import Shop from "./pages/Shop";
import Notifications from "./pages/Notifications";
import AdminProposals from "./pages/AdminProposals";
import AdminReviews from "./pages/AdminReviews";
import AdminUsers from "./pages/AdminUsers";
import AdminMetrics from "./pages/AdminMetrics";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import NavBar from "./components/NavBar";

function Router() {
  const [location, setLocation] = useLocation();
  const hideNavBar = ["/login", "/verify-email", "/reset-password"].includes(location);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== "f") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !(target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      setLocation("/admin/metrics");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideNavBar && <NavBar />}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/quests" component={QuestFeed} />
        <Route path="/quests/:id" component={QuestDetail} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/shop" component={Shop} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/unlockables" component={Unlockables} />
        <Route path="/settings" component={Settings} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/create-quest" component={CreateQuest} />
        <Route path="/admin/proposals" component={AdminProposals} />
        <Route path="/admin/reviews" component={AdminReviews} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/metrics" component={AdminMetrics} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.11 0.015 260)",
                border: "1px solid oklch(0.2 0.02 260)",
                color: "oklch(0.95 0.01 260)",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
