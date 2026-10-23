import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProformaInvoice from './pages/ProformaInvoice';
import Accessories from './pages/Accessories';
import ShippingDocuments from './pages/ShippingDocuments';
import FabricWorking from './pages/FabricWorking';
import AccessoriesPackaging from './pages/AccessoriesPackaging';
import AccessoryPurchaseOrders from './pages/AccessoryPurchaseOrders';
import Trims from './pages/Trims';
import TechPack from './pages/TechPack';
import Production from './pages/Production';
import AppFlowchart from './pages/AppFlowchart';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/ProformaInvoice" element={<LayoutWrapper currentPageName="ProformaInvoice"><ProformaInvoice /></LayoutWrapper>} />
      <Route path="/FabricWorking" element={<LayoutWrapper currentPageName="FabricWorking"><FabricWorking /></LayoutWrapper>} />
      <Route path="/AccessoriesPackaging" element={<LayoutWrapper currentPageName="AccessoriesPackaging"><AccessoriesPackaging /></LayoutWrapper>} />
      <Route path="/Accessories" element={<LayoutWrapper currentPageName="Accessories"><Accessories /></LayoutWrapper>} />
      <Route path="/ShippingDocuments" element={<LayoutWrapper currentPageName="ShippingDocuments"><ShippingDocuments /></LayoutWrapper>} />
      <Route path="/AccessoryPurchaseOrders" element={<LayoutWrapper currentPageName="AccessoryPurchaseOrders"><AccessoryPurchaseOrders /></LayoutWrapper>} />
      <Route path="/Trims" element={<LayoutWrapper currentPageName="Trims"><Trims /></LayoutWrapper>} />
      <Route path="/TechPack" element={<LayoutWrapper currentPageName="TechPack"><TechPack /></LayoutWrapper>} />
      <Route path="/Production" element={<LayoutWrapper currentPageName="Production"><Production /></LayoutWrapper>} />
      <Route path="/AppFlowchart" element={<LayoutWrapper currentPageName="AppFlowchart"><AppFlowchart /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App