import React, { useState, useMemo, useRef } from "react";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, FileText, Pencil, Save, X, Plus, Layers } from "lucide-react";
import UploadFabricSheet from "../components/fabric/UploadFabricSheet";
import ArticleFabricSetup from "../components/fabric/ArticleFabricSetup";

const COMPONENT_TYPES = ["Front", "Skirt", "Bottom", "Piping", "Binding", "Filling", "Lamination", "Top Fabric", "Window (Outside)", "Window (Inside)", "Flat Sheet", "Fitted Sheet", "Fitted Sheet (Split)", "Pillow Case (x2)"];

// ─── helpers ────────────────────────────────────────────────────
const COLOR_KEYWORDS = ["Cloud Gray", "Misty Blue", "White", "Dove Gray", "Light Blue", "Grey", "Blue", "Red", "Green", "Black", "Beige", "Navy"];
const SIZE_KEYWORDS  = ["Twin XL", "Twin", "Full", "Queen", "King", "Cal King", "Split Cal King", "Split Head Cal King", "Split Head King", "Split Head Queen", "Split King"];

function parseArticleColorSize(name) {
  const n = name || "";
  const color = COLOR_KEYWORDS.find(c => n.toLowerCase().includes(c.toLowerCase())) || "";
  const size  = SIZE_KEYWORDS.find(s => n.toLowerCase().includes(s.toLowerCase())) || "";
  const base  = color ? n.replace(new RegExp(color, "i"), "").trim() : n;
  return { color, size, base: base.replace(/\s+/g, " ").trim() };
}

export default function FabricWorking() {
  const queryClient = useQueryClient();
  const tableRef = useRef(null);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [viewMode, setViewMode] = useState("combined"); // "combined" | "bycolor"

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });

  const activePo = selectedPoId ? pos.find((p) => p.id === selectedPoId) : pos[0];
  const poArticles = useMemo(() => {
    if (!activePo) return [];
    return articles.filter((a) => a.po_id === activePo.id).sort((a, b) => a.article_name.localeCompare(b.article_name));
  }, [articles, activePo]);

  // Grouped by-color/size: each article row with its color/size parsed
  const byColorRows = useMemo(() => {
    return poArticles.map(art => {
      const { color, size } = parseArticleColorSize(art.article_name);
      return { ...art, parsed_color: color, parsed_size: size };
    });
  }, [poArticles]);

  // Combined view: merge articles with same "base" name (sum quantities, keep components from first)
  const combinedArticles = useMemo(() => {
    const map = {};
    poArticles.forEach(art => {
      const { base, color } = parseArticleColorSize(art.article_name);
      const key = base || art.article_name;
      if (!map[key]) {
        map[key] = { ...art, _baseKey: key, _colors: [] };
      }
      map[key].order_quantity = (map[key].order_quantity || 0) + (art.order_quantity || 0);
      if (color && !map[key]._colors.includes(color)) map[key]._colors.push(color);
      // Merge components: sum total_required for same component_type
      (art.components || []).forEach(comp => {
        const existing = map[key].components?.find(c => c.component_type === comp.component_type);
        if (existing) {
          existing.total_required = (existing.total_required || 0) + (comp.total_required || 0);
        }
      });
    });
    return Object.values(map);
  }, [poArticles]);

  // Fabric summary
  const buildFabricSummary = (artList) => {
    const map = {};
    artList.forEach((art) => {
      (art.components || []).forEach((comp) => {
        const key = `${comp.fabric_type}||${comp.width}`;
        if (!map[key]) map[key] = { fabric_type: comp.fabric_type, width: comp.width, net_total: 0, total_with_wastage: 0 };
        const qty = art.order_quantity || 0;
        const net = (comp.consumption_per_unit || 0) * qty;
        const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
        map[key].net_total += net;
        map[key].total_with_wastage += total;
      });
    });
    return Object.values(map);
  };

  const fabricSummary = useMemo(() => buildFabricSummary(viewMode === "combined" ? combinedArticles : byColorRows), [combinedArticles, byColorRows, viewMode]);

  const updateArticle = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Article.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["articles"] }); setEditingId(null); },
  });

  const startEdit = (article) => {
    setEditingId(article.id);
    setEditForm({ ...article, components: JSON.parse(JSON.stringify(article.components || [])) });
  };

  const updateComp = (idx, field, value) => {
    setEditForm((f) => {
      const comps = [...f.components];
      comps[idx] = { ...comps[idx], [field]: value };
      if (["consumption_per_unit", "wastage_percent"].includes(field)) {
        const c = comps[idx];
        const net = (c.consumption_per_unit || 0) * (f.order_quantity || 0);
        comps[idx].total_required = +(net * (1 + (c.wastage_percent || 0) / 100)).toFixed(4);
      }
      return { ...f, components: comps };
    });
  };

  const addComponent = () => {
    setEditForm((f) => ({
      ...f,
      components: [...(f.components || []), { component_type: "Front", fabric_type: "", gsm: 0, width: 0, consumption_per_unit: 0, wastage_percent: 6, total_required: 0 }],
    }));
  };

  const removeComponent = (idx) => setEditForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  const saveEdit = () => updateArticle.mutate({ id: editingId, data: editForm });
  const handlePrint = () => window.print();

  // ─── EXCEL DOWNLOAD ──────────────────────────────────────────
  const handleDownloadExcel = () => {
    const displayArticles = viewMode === "combined" ? combinedArticles : byColorRows;
    const rows = [["Article Name", viewMode === "bycolor" ? "Color" : "Colors", viewMode === "bycolor" ? "Size" : "", "Order Qty", "Part", "Fabrication", "Width (cm)", "Cut/Unit (m)", "Net Mtrs", "Wastage %", "Total Mtrs"]];
    displayArticles.forEach((art) => {
      (art.components || []).forEach((comp, i) => {
        const qty = art.order_quantity || 0;
        const net = (comp.consumption_per_unit || 0) * qty;
        const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
        rows.push([
          i === 0 ? art.article_name : "",
          i === 0 ? (art._colors?.join(", ") || art.parsed_color || "") : "",
          i === 0 ? (art.parsed_size || "") : "",
          i === 0 ? qty : "",
          comp.component_type, comp.fabric_type, comp.width || "",
          comp.consumption_per_unit?.toFixed(4) || "",
          net.toFixed(2), (comp.wastage_percent ?? 6) + "%", total.toFixed(2),
        ]);
      });
      rows.push(Array(11).fill(""));
    });
    rows.push(["FABRIC SUMMARY", ...Array(10).fill("")]);
    rows.push(["Fabric Type", "", "", "", "", "", "Width (cm)", "", "Net Mtrs", "", "Total Mtrs"]);
    fabricSummary.forEach((f) => rows.push([f.fabric_type, "", "", "", "", "", f.width ? f.width + "cm" : "", "", f.net_total.toFixed(2), "", f.total_with_wastage.toFixed(2)]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `FabricWorking_${activePo?.po_number || "PO"}_${viewMode}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ─── PDF DOWNLOAD ────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const displayArticles = viewMode === "combined" ? combinedArticles : byColorRows;
    const doc = new jsPDF({ orientation: "landscape", format: "a3" });
    const isByColor = viewMode === "bycolor";
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text(`Fabric Working Sheet — ${activePo?.po_number || ""} [${isByColor ? "By Color/Size" : "Combined"}]`, 14, 15);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${activePo?.customer_name || ""} | PI: ${activePo?.pi_number || "—"} | ETD: ${activePo?.etd || "—"}`, 14, 22);
    let y = 30;
    const cols = isByColor
      ? ["Article", "Color", "Size", "Qty", "Part", "Fabrication", "Width", "Cut/Unit", "Net Mtrs", "Wastage", "Total Mtrs"]
      : ["Article", "Colors", "Qty", "Part", "Fabrication", "Width", "Cut/Unit", "Net Mtrs", "Wastage", "Total Mtrs"];
    const widths = isByColor ? [30, 20, 22, 12, 20, 40, 14, 16, 16, 14, 18] : [35, 30, 12, 20, 45, 14, 16, 16, 14, 18];
    doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
    let x = 14;
    cols.forEach((col, i) => { doc.rect(x, y - 4, widths[i], 7, "F"); doc.setFontSize(7); doc.text(col, x + 1, y); x += widths[i]; });
    y += 5; doc.setTextColor(0, 0, 0);
    displayArticles.forEach((art, artIdx) => {
      (art.components || []).forEach((comp, ci) => {
        const qty = art.order_quantity || 0;
        const net = (comp.consumption_per_unit || 0) * qty;
        const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
        const rowData = isByColor
          ? [ci === 0 ? (art.article_name || "").substring(0, 20) : "", ci === 0 ? (art.parsed_color || "") : "", ci === 0 ? (art.parsed_size || "") : "", ci === 0 ? String(qty) : "", comp.component_type || "", (comp.fabric_type || "").substring(0, 28), comp.width ? `${comp.width}cm` : "", comp.consumption_per_unit?.toFixed(4) || "", net.toFixed(2), `${comp.wastage_percent ?? 6}%`, total.toFixed(2)]
          : [ci === 0 ? (art.article_name || "").substring(0, 24) : "", ci === 0 ? (art._colors?.join(", ") || "").substring(0, 22) : "", ci === 0 ? String(qty) : "", comp.component_type || "", (comp.fabric_type || "").substring(0, 28), comp.width ? `${comp.width}cm` : "", comp.consumption_per_unit?.toFixed(4) || "", net.toFixed(2), `${comp.wastage_percent ?? 6}%`, total.toFixed(2)];
        if (artIdx % 2 === 0) { doc.setFillColor(235, 240, 250); x = 14; widths.forEach(w => { doc.rect(x, y - 3.5, w, 6, "F"); x += w; }); }
        doc.setFontSize(7); x = 14;
        rowData.forEach((val, i) => { doc.text(String(val), x + 1, y); x += widths[i]; });
        y += 6;
        if (y > 185) { doc.addPage(); y = 20; }
      });
    });
    y += 4;
    doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 4, 160, 7, "F");
    doc.setFontSize(8); doc.text("FABRIC REQUIREMENT SUMMARY", 15, y);
    y += 8; doc.setTextColor(0, 0, 0);
    fabricSummary.forEach((f, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(235, 240, 250); doc.rect(14, y - 3.5, 160, 6, "F"); }
      doc.setFontSize(7);
      doc.text(f.fabric_type || "", 15, y);
      doc.text(f.width ? `${f.width}cm` : "", 95, y);
      doc.text(f.net_total.toFixed(2), 115, y);
      doc.text(f.total_with_wastage.toFixed(2), 145, y);
      y += 6;
    });
    doc.save(`FabricWorking_${activePo?.po_number || "PO"}_${viewMode}.pdf`);
  };

  // ─── ARTICLE TABLE RENDERER ──────────────────────────────────
  const renderArticleTable = (artList, showColorCol, showSizeCol) => (
    <div className="overflow-x-auto rounded border border-gray-300 shadow-sm">
      <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
        <thead>
          <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
            <th className="border border-gray-400 px-2 py-2 text-left min-w-[160px]">Article Name</th>
            {showColorCol && <th className="border border-gray-400 px-2 py-2 text-left w-28">Color</th>}
            {showSizeCol && <th className="border border-gray-400 px-2 py-2 text-left w-28">Size</th>}
            <th className="border border-gray-400 px-2 py-2 text-center w-16">Ord Qty</th>
            <th className="border border-gray-400 px-2 py-2 text-left min-w-[80px]">Part</th>
            <th className="border border-gray-400 px-2 py-2 text-left min-w-[200px]">Fabrication</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-20">Width (cm)</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-24">Cut/Unit (m)</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-24">Net Mtrs</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-20">Wastage %</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-24 font-bold">Total Mtrs</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-20 print-hidden">Actions</th>
          </tr>
        </thead>
        <tbody>
          {artList.map((article, artIdx) => {
            const isEditing = editingId === article.id;
            const comps = isEditing ? editForm.components : (article.components || []);
            const rowCount = Math.max(comps.length, 1);
            const artBg = artIdx % 2 === 0 ? "#EBF0FA" : "#FFFFFF";
            const colorLabel = article._colors?.join(", ") || article.parsed_color || "";

            return (
              <React.Fragment key={article.id || artIdx}>
                {!isEditing && comps.length === 0 ? (
                  <tr style={{ backgroundColor: artBg }}>
                    <td className="border border-gray-300 px-2 py-1.5 font-semibold text-blue-900">{article.article_name}</td>
                    {showColorCol && <td className="border border-gray-300 px-2 py-1.5 text-xs">{colorLabel}</td>}
                    {showSizeCol && <td className="border border-gray-300 px-2 py-1.5 text-xs">{article.parsed_size}</td>}
                    <td className="border border-gray-300 px-2 py-1.5 text-center">{article.order_quantity?.toLocaleString()}</td>
                    <ArticleFabricSetup
                      article={article}
                      onEdit={() => startEdit(article)}
                      onSetup={async (components) => {
                        const total_fabric_required = +components.reduce((s, c) => s + (c.total_required || 0), 0).toFixed(4);
                        await base44.entities.Article.update(article.id, { components, total_fabric_required });
                        queryClient.invalidateQueries({ queryKey: ["articles"] });
                      }}
                    />
                    <td className="border border-gray-300 px-2 py-1.5 text-center print-hidden" />
                  </tr>
                ) : (
                  comps.map((comp, idx) => {
                    const qty = (isEditing ? editForm.order_quantity : article.order_quantity) || 0;
                    const net = (comp.consumption_per_unit || 0) * qty;
                    const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
                    return (
                      <tr key={idx} style={{ backgroundColor: artBg }}>
                        {idx === 0 && (
                          <>
                            <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 font-semibold text-blue-900 align-top">{article.article_name}</td>
                            {showColorCol && <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 text-xs align-top">{colorLabel}</td>}
                            {showSizeCol && <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 text-xs align-top">{article.parsed_size}</td>}
                            <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 text-center font-semibold align-top">
                              {isEditing ? (
                                <input type="number" className="w-14 border rounded px-1 py-0.5 text-center" value={editForm.order_quantity || ""} onChange={(e) => setEditForm((f) => ({ ...f, order_quantity: Number(e.target.value) }))} />
                              ) : article.order_quantity?.toLocaleString()}
                            </td>
                          </>
                        )}
                        <td className="border border-gray-300 px-2 py-1">
                          {isEditing ? (
                            <select className="w-full text-xs border rounded px-1 py-0.5" value={comp.component_type} onChange={(e) => updateComp(idx, "component_type", e.target.value)}>
                              {COMPONENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          ) : <span className="font-medium">{comp.component_type}</span>}
                        </td>
                        <td className="border border-gray-300 px-2 py-1">
                          {isEditing ? <input className="w-full text-xs border rounded px-1 py-0.5" value={comp.fabric_type || ""} onChange={(e) => updateComp(idx, "fabric_type", e.target.value)} /> : comp.fabric_type}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          {isEditing ? <input type="number" className="w-16 text-xs border rounded px-1 py-0.5 text-center" value={comp.width || ""} onChange={(e) => updateComp(idx, "width", Number(e.target.value))} /> : comp.width ? `${comp.width}cm` : "—"}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          {isEditing ? <input type="number" step="0.0001" className="w-20 text-xs border rounded px-1 py-0.5 text-center" value={comp.consumption_per_unit || ""} onChange={(e) => updateComp(idx, "consumption_per_unit", Number(e.target.value))} /> : comp.consumption_per_unit?.toFixed(4)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">{net.toFixed(2)}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          {isEditing ? <input type="number" className="w-14 text-xs border rounded px-1 py-0.5 text-center" value={comp.wastage_percent ?? 6} onChange={(e) => updateComp(idx, "wastage_percent", Number(e.target.value))} /> : `${comp.wastage_percent ?? 6}%`}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{total.toFixed(2)}</td>
                        {idx === 0 && (
                          <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1 text-center align-top print-hidden">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 items-center">
                                <button onClick={saveEdit} className="text-green-600 hover:text-green-800"><Save className="h-3.5 w-3.5" /></button>
                                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ) : (
                              <button onClick={() => startEdit(article)} className="text-blue-600 hover:text-blue-800"><Pencil className="h-3.5 w-3.5" /></button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
                {isEditing && (
                  <tr style={{ backgroundColor: artBg }}>
                    <td colSpan={3 + (showColorCol ? 1 : 0) + (showSizeCol ? 1 : 0)} />
                    <td colSpan={7} className="border border-gray-300 px-2 py-1">
                      <button onClick={addComponent} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                        <Plus className="h-3 w-3" /> Add Component
                      </button>
                    </td>
                    <td className="border border-gray-300" />
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const currentSummary = fabricSummary;

  return (
    <div className="space-y-3">
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          @page { margin: 0.8cm; size: A3 landscape; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 9px; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between print-hidden flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Fabric Working Sheet</h1>
          <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
            <SelectTrigger className="w-64 h-8 text-xs">
              <SelectValue placeholder="Select PO" />
            </SelectTrigger>
            <SelectContent>
              {pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <UploadFabricSheet onSuccess={() => queryClient.invalidateQueries({ queryKey: ["articles"] })} />
          <Button size="sm" variant="outline" onClick={handleDownloadExcel} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* PO Info */}
      {activePo && (
        <div className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-1.5 text-blue-800 font-medium print:bg-transparent print:border-gray-300 print:text-black">
          Fabric Working For: <strong>{activePo.po_number}</strong>{activePo.pi_number ? <> | PI: <strong>{activePo.pi_number}</strong></> : ""} | Customer: {activePo.customer_name} | ETD: {activePo.etd || "—"} | Ex-Factory: {activePo.ex_factory_date || "—"}
        </div>
      )}

      {/* View Toggle */}
      {poArticles.length > 0 && (
        <div className="flex gap-2 print-hidden">
          <button
            onClick={() => setViewMode("combined")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${viewMode === "combined" ? "bg-primary text-white border-primary" : "bg-white border-gray-300 text-gray-600 hover:border-primary"}`}>
            Combined (All Colors)
          </button>
          <button
            onClick={() => setViewMode("bycolor")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${viewMode === "bycolor" ? "bg-primary text-white border-primary" : "bg-white border-gray-300 text-gray-600 hover:border-primary"}`}>
            By Color &amp; Size
          </button>
        </div>
      )}

      {poArticles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No articles found for this PO.</p>
        </div>
      ) : (
        <div ref={tableRef}>
          {viewMode === "combined"
            ? renderArticleTable(combinedArticles, true, false)
            : renderArticleTable(byColorRows, true, true)
          }

          {/* Fabric Summary Table */}
          {currentSummary.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded border border-gray-300 shadow-sm">
              <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
                <thead>
                  <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                    <th className="border border-gray-400 px-3 py-2 text-left" colSpan={2}>FABRIC REQUIREMENT SUMMARY — {activePo?.po_number} [{viewMode === "combined" ? "Combined" : "By Color/Size"}]</th>
                    <th className="border border-gray-400 px-3 py-2 text-center">Width</th>
                    <th className="border border-gray-400 px-3 py-2 text-right">Net Mtrs (100%)</th>
                    <th className="border border-gray-400 px-3 py-2 text-right">Total Mtrs (with wastage)</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSummary.map((f, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#EBF0FA" : "white" }}>
                      <td className="border border-gray-300 px-3 py-1.5" colSpan={2}>{f.fabric_type}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center">{f.width ? `${f.width}cm` : "—"}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right">{f.net_total.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right font-bold" style={{ backgroundColor: "#FFF2CC" }}>{f.total_with_wastage.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#1F3864", color: "white", fontWeight: "bold" }}>
                    <td className="border border-gray-400 px-3 py-1.5" colSpan={3}>GRAND TOTAL</td>
                    <td className="border border-gray-400 px-3 py-1.5 text-right">{currentSummary.reduce((s, f) => s + f.net_total, 0).toFixed(2)}</td>
                    <td className="border border-gray-400 px-3 py-1.5 text-right">{currentSummary.reduce((s, f) => s + f.total_with_wastage, 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}