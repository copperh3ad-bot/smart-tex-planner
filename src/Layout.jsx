import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  FileText,
  Layers,
  Scissors,
  Factory,
  ClipboardList,
  Menu,
  X,
  Package,
  Receipt,
  Shirt,
  Tag,
  Cog
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Purchase Orders", icon: FileText, page: "PurchaseOrders" },
  { name: "Proforma Invoice", icon: Receipt, page: "ProformaInvoice" },
  { name: "Fabric Working", icon: Shirt, page: "FabricWorking" },
  { name: "Articles", icon: Layers, page: "Articles" },
  { name: "Yarn Planning", icon: Scissors, page: "YarnPlanning" },
  { name: "Trims", icon: Layers, page: "Trims" },
  { name: "Packaging", icon: Tag, page: "AccessoriesPackaging" },
  { name: "Accessory Orders", icon: Package, page: "AccessoryPurchaseOrders" },
  { name: "Tech Pack", icon: FileText, page: "TechPack" },
  { name: "Production", icon: Cog, page: "Production" },
  { name: "Shipping Docs", icon: FileText, page: "ShippingDocuments" },
  { name: "Production", icon: Factory, page: "Production" },
  { name: "Job Cards", icon: ClipboardList, page: "JobCards" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-lg leading-tight">TextilePro</h1>
              <p className="text-xs text-muted-foreground">Order Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="px-3 py-2 rounded-lg bg-muted">
            <p className="text-xs font-medium text-muted-foreground">Textile ERP</p>
            <p className="text-xs text-muted-foreground/70">v1.0</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-card border-b border-border flex items-center px-4 lg:px-6 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted mr-3"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <h2 className="text-sm font-semibold text-foreground">
            {navItems.find((n) => n.page === currentPageName)?.name || currentPageName}
          </h2>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}