import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import QuestFeed from "./pages/QuestFeed";
import QuestDetail from "./pages/QuestDetail";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import CreateQuest from "./pages/CreateQuest";
import AdminProposals from "./pages/AdminProposals";
import AdminUsers from "./pages/AdminUsers";
import Login from "./pages/Login";
import NavBar from "./components/NavBar";

function Router() {
  const [location] = useLocation();
  const hideNavBar = ["/login"].includes(location);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideNavBar && <NavBar />}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/quests" component={QuestFeed} />
        <Route path="/quests/:id" component={QuestDetail} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/create-quest" component={CreateQuest} />
        <Route path="/admin/proposals" component={AdminProposals} />
        <Route path="/admin/users" component={AdminUsers} />
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
