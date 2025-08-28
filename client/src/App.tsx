import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";
import { useAuth } from "./hooks/useAuth";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProjectManagement from "@/pages/admin/ProjectManagement";
import AdminSupportAdministration from "@/pages/admin/SupportAdministration";
import AdminUserManagement from "@/pages/admin/UserManagement"; // Import added
import AdminPartnerManagement from "@/pages/admin/PartnerManagement"; // Import added
import AnalyticsDashboard from "@/pages/admin/AnalyticsDashboard"; // Import added

import ClientDashboard from "@/pages/ClientDashboard";
import PartnerDashboard from "@/pages/PartnerDashboard";
import PortfolioAdmin from "@/pages/PortfolioAdmin";
import ProjectsManagement from "@/pages/client/ProjectsManagement";
import SupportCenter from "@/pages/client/SupportCenter";
import BillingDashboard from "@/pages/client/BillingDashboard";
import EarningsManagement from "@/pages/partner/EarningsManagement";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading, error, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Clear invalid tokens
  if (error && localStorage.getItem("auth_token")) {
    localStorage.removeItem("auth_token");
    window.location.reload();
    return null;
  }

  return (
    <Switch>
      {!user ? (
        <Route path="/" component={Landing} />
      ) : (
        <Route path="/" component={Dashboard} />
      )}

      {/* Admin routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/portfolio" component={PortfolioAdmin} />
      <Route path="/admin/projects" component={AdminProjectManagement} />
      <Route path="/admin/support" component={AdminSupportAdministration} />
      <Route path="/admin/users" component={AdminUserManagement} /> {/* Route added */}
      <Route path="/admin/partners" component={AdminPartnerManagement} /> {/* Route added */}
      <Route path="/admin/analytics" component={AnalyticsDashboard} /> {/* Route added */}


      <Route path="/client/projects" component={ProjectsManagement} />
      <Route path="/client/support" component={SupportCenter} />
      <Route path="/client/billing" component={BillingDashboard} />
      <Route path="/partner/earnings" component={EarningsManagement} />

      <Route path="/terminos" component={TermsOfService} />
      <Route path="/privacidad" component={PrivacyPolicy} />
      <Route path="/cookies" component={CookiePolicy} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;