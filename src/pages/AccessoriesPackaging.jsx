import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import UnifiedPackagingPlanning from "../components/packaging/UnifiedPackagingPlanning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Tag, Box, Package, Layers, CheckCircle, Download, FileText } from "lucide-react";
import UploadPackagingSheet from "../components/packaging/UploadPackagingSheet";
import ArticlePackagingForm from "../components/packaging/ArticlePackagingForm";
import ArticlePackagingCard from "../components/packaging/ArticlePackagingCard";

const TABS = ["Planning", "Packaging Templates"];

export default function AccessoriesPackaging() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("Planning");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [search, setSearch] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["articlePackaging"],
    queryFn: () => base44.entities.ArticlePackaging.list(),
  });

  const filtered = templates.filter(t =>
    !search ||
    t.article_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.article_code?.toLowerCase().includes(search.toLowerCase()) ||
    t.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownloadExcel = () => {
    const rows = [["Article Name", "Article Code", "Customer", "Labels", "Polybag", "Polybag Size", "Stiffener", "Carton Type", "Carton Quality", "Pcs/Carton", "CBM/Carton"]];
    templates.forEach(t => {
      rows.push([
        t.article_name || "",
        t.article_code || "",
        t.customer_name || "",
        (t.labels || []).map(l => l.label_type).join("; "),
        t.polybag?.type || "",
        t.polybag?.size_cm || "",
        t.stiffener?.used ? "Yes" : "No",
        t.carton?.type || "",
        t.carton?.quality || "",
        t.carton?.pieces_per_carton || "",
        t.carton?.cbm_per_carton || "",
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Packaging_Templates.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", format: "a4" });
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Packaging Templates", 14, 15);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Total: ${templates.length} templates`, 14, 22);
    let y = 30;
    templates.forEach((t, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
      doc.rect(14, y - 4, 182, 7, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(`${t.article_name || "Unnamed"} ${t.article_code ? `(${t.article_code})` : ""}  —  ${t.customer_name || ""}`, 16, y);
      y += 7; doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      if (t.labels?.length) { doc.text(`Labels: ${t.labels.map(l => l.label_type).join(", ")}`, 16, y); y += 5; }
      if (t.polybag?.type) { doc.text(`Polybag: ${t.polybag.type} ${t.polybag.size_cm ? `(${t.polybag.size_cm})` : ""}`, 16, y); y += 5; }
      if (t.stiffener?.used) { doc.text(`Stiffener: ${t.stiffener.material || "Yes"} ${t.stiffener.size_cm || ""}`, 16, y); y += 5; }
      if (t.carton?.type) { doc.text(`Carton: ${t.carton.type} ${t.carton.quality || ""} | Pcs: ${t.carton.pieces_per_carton || "—"} | CBM: ${t.carton.cbm_per_carton || "—"}`, 16, y); y += 5; }
      y += 4;
    });
    doc.save("Packaging_Templates.pdf");
  };

  const handleSave = async (data) => {
    if (editingItem) {
      await base44.entities.ArticlePackaging.update(editingItem.id, data);
    } else {
      await base44.entities.ArticlePackaging.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["articlePackaging"] });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this packaging template?")) {
      await base44.entities.ArticlePackaging.delete(id);
      queryClient.invalidateQueries({ queryKey: ["articlePackaging"] });
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  // Stats
  const totalLabels = templates.reduce((s, t) => s + (t.labels?.length || 0), 0);
  const withStiffener = templates.filter(t => t.stiffener?.used).length;
  const withPolybag = templates.filter(t => t.polybag?.type).length;

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Planning" && <UnifiedPackagingPlanning />}

      {activeTab === "Packaging Templates" && (<>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Packaging</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define packaging instructions once per article — auto-applied on repeat orders
          </p>
        </div>
        <div className="flex gap-2">
          <UploadPackagingSheet onSuccess={() => queryClient.invalidateQueries({ queryKey: ["articlePackaging"] })} />
          <Button variant="outline" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4 mr-1.5" /> PDF
          </Button>
          <Button onClick={() => { setEditingItem(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> New Article Template
        </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-4 w-4 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Article Templates</p><p className="text-xl font-bold">{templates.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center"><Tag className="h-4 w-4 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground">Total Labels</p><p className="text-xl font-bold">{totalLabels}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center"><Box className="h-4 w-4 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground">With Polybag</p><p className="text-xl font-bold">{withPolybag}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center"><CheckCircle className="h-4 w-4 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">With Stiffener</p><p className="text-xl font-bold">{withStiffener}</p></div>
        </CardContent></Card>
      </div>

      {/* How it works banner */}
      {templates.length === 0 && !isLoading && (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-6 text-center">
            <Layers className="h-10 w-10 text-primary mx-auto mb-3 opacity-60" />
            <h3 className="font-semibold text-sm mb-1">Create your first packaging template</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
              Define labels, polybag specs, stiffeners, carton details, and stickers once per article. 
              When a repeat order arrives, all instructions are instantly available — no re-entry needed.
            </p>
            <Button onClick={() => { setEditingItem(null); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Create First Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      {templates.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading templates...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pkg => (
            <ArticlePackagingCard key={pkg.id} pkg={pkg} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
          {filtered.length === 0 && templates.length > 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No templates match your search.</div>
          )}
        </div>
      )}

      <ArticlePackagingForm
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditingItem(null); }}
        onSave={handleSave}
        initialData={editingItem}
      />
      </>)}
    </div>
  );
}