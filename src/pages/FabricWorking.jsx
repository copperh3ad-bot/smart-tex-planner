import React, { useState, useMemo, useRef } from "react";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, FileText, Pencil, Save, X, Plus, Layers, Grid, List } from "lucide-react";
import UploadFabricSheet from "../components/fabric/UploadFabricSheet";
import ArticleFabricSetup from "../components/fabric/ArticleFabricSetup";

const COMPONENT_TYPES = ["Flat Sheet","Fitted Sheet","Pillow Case","Front","Skirt","Bottom","Piping","Binding","Filling","Lamination","Top Fabric","Window (Outside)","Window (Inside)"];

// Extract color label from article
const getColorLabel = (art) => {
  if (art.color) return art.color;
  const match = art.article_code?.match(/-([A-Z]{2,3})$/);
  const MAP = { CG: "Cloud Gray", MB: "Misty Blue", WH: "White", NG: "Navy Gray", BL: "Blue", GR: "Gray", RD: "Red", BK: "Black" };
  return match ? (MAP[match[1]] || match[1]) : "Default";
};

// Strip color suffix from code for combined grouping
const getBaseCode = (art) => {
  const code = art.article_code?.replace(/-[A-Z]{2,3}$/, "") || "";
  if (code) return code;
  // fallback: strip known color words from name
  return (art.article_name || "").replace(/\b(Cloud Gray|Misty Blue|White|Cloud Grey|Navy|Black|Red|Green|Blue|Gray|Grey)\b/gi, "").trim().replace(/\s+/g, " ");
};

export default function FabricWorking() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  const [viewMode, setViewMode] = useState("combined"); // "combined" | "separate"
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });

  const activePo = selectedPoId ? pos.find((p) => p.id === selectedPoId) : pos[0];
  const poArticles = useMemo(() => {
    if (!activePo) return [];
    return articles.filter((a) => a.po_id === activePo.id).sort((a, b) => (a.article_name || "").localeCompare(b.article_name || ""));
  }, [articles, activePo]);

  // Combined groups: articles grouped by base code (ignoring color)
  const combinedGroups = useMemo(() => {
    const groups = {};
    poArticles.forEach((art) => {
      const key = getBaseCode(art);
      if (!groups[key]) groups[key] = { key, articles: [], totalQty: 0, template: art };
      groups[key].articles.push(art);
      groups[key].totalQty += (art.order_quantity || 0);
    });
    return Object.values(groups).map((g) => ({
      ...g,
      displayName: g.key || g.template.article_name,
      colors: g.articles.map(a => getColorLabel(a)).join(", "),
      components: (g.template.components || []).map((c) => ({
        ...c,
        net_total: +((c.consumption_per_unit || 0) * g.totalQty).toFixed(4),
        total_required: +((c.consumption_per_unit || 0) * g.totalQty * (1 + (c.wastage_percent || 6) / 100)).toFixed(4),
      })),
    }));
  }, [poArticles]);

  // Separate groups: articles grouped by color
  const colorGroups = useMemo(() => {
    const groups = {};
    poArticles.forEach((art) => {
      const color = getColorLabel(art);
      if (!groups[color]) groups[color] = [];
      groups[color].push(art);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [poArticles]);

  // Fabric summary
  const fabricSummary = useMemo(() => {
    const map = {};
    poArticles.forEach((art) => {
      (art.components || []).forEach((comp) => {
        const key = `${comp.fabric_type}||${comp.width}`;
        if (!map[key]) map[key] = { fabric_type: comp.fabric_type, width: comp.width, net_total: 0, total_with_wastage: 0 };
        const net = (comp.consumption_per_unit || 0) * (art.order_quantity || 0);
        const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
        map[key].net_total += net;
        map[key].total_with_wastage += total;
      });
    });
    return Object.values(map);
  }, [poArticles]);

  const updateArticle = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.Article.update(id, data);
      // Save as master template keyed by article_code
      if (data.article_code) {
        const masterComponents = (data.components || []).map(({ total_required, ...rest }) => rest);
        const existing = await base44.entities.FabricTemplate.filter({ article_code: data.article_code });
        if (existing.length > 0) {
          await base44.entities.FabricTemplate.update(existing[0].id, { components: masterComponents, article_name: data.article_name });
        } else {
          await base44.entities.FabricTemplate.create({ article_code: data.article_code, article_name: data.article_name, components: masterComponents });
        }
      }
    },
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
      components: [...(f.components || []), { component_type: "Flat Sheet", product_size: "", direction: "", fabric_type: "", gsm: 0, width: 0, consumption_per_unit: 0, wastage_percent: 6, total_required: 0 }],
    }));
  };

  const removeComponent = (idx) => setEditForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  const saveEdit = () => updateArticle.mutate({ id: editingId, data: editForm });
  const handlePrint = () => window.print();

  const handleDownloadExcel = () => {
    const rows = [["Mode", viewMode === "combined" ? "Combined (All Colors)" : "Separate (By Color)"]];
    rows.push([]);
    if (viewMode === "combined") {
      rows.push(["Article (Base)", "Colors", "Total Qty", "Part", "Product Size", "Direction", "Fabrication", "Width (cm)", "Cut/Unit (m)", "Net Mtrs", "Wastage %", "Total Mtrs"]);
      combinedGroups.forEach((g) => {
        g.components.forEach((comp, i) => {
          rows.push([
            i === 0 ? g.displayName : "", i === 0 ? g.colors : "", i === 0 ? g.totalQty : "",
            comp.component_type, comp.product_size || "", comp.direction || "",
            comp.fabric_type, comp.width || "", comp.consumption_per_unit?.toFixed(4) || "",
            comp.net_total?.toFixed(2) || "", (comp.wastage_percent ?? 6) + "%", comp.total_required?.toFixed(2) || "",
          ]);
        });
        rows.push(Array(12).fill(""));
      });
    } else {
      rows.push(["Color", "Article", "Code", "Qty", "Part", "Product Size", "Direction", "Fabrication", "Width (cm)", "Cut/Unit (m)", "Net Mtrs", "Wastage %", "Total Mtrs"]);
      colorGroups.forEach(([color, arts]) => {
        arts.forEach((art) => {
          (art.components || []).forEach((comp, i) => {
            const net = (comp.consumption_per_unit || 0) * (art.order_quantity || 0);
            const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
            rows.push([
              i === 0 ? color : "", i === 0 ? art.article_name : "", i === 0 ? art.article_code || "" : "", i === 0 ? art.order_quantity || "" : "",
              comp.component_type, comp.product_size || "", comp.direction || "",
              comp.fabric_type, comp.width || "", comp.consumption_per_unit?.toFixed(4) || "",
              net.toFixed(2), (comp.wastage_percent ?? 6) + "%", total.toFixed(2),
            ]);
          });
          rows.push(Array(13).fill(""));
        });
      });
    }
    rows.push([]);
    rows.push(["FABRIC SUMMARY"]);
    rows.push(["Fabric Type", "Width", "Net Mtrs", "Total Mtrs (incl. wastage)"]);
    fabricSummary.forEach((f) => rows.push([f.fabric_type, f.width ? f.width + "cm" : "", f.net_total.toFixed(2), f.total_with_wastage.toFixed(2)]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FabricWorking_${viewMode}_${activePo?.po_number || "PO"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a3" });
    const title = viewMode === "combined" ? "Fabric Working — Combined (All Colors/Sizes)" : "Fabric Working — Separate (By Color)";
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`${title} — ${activePo?.po_number || ""}`, 14, 15);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${activePo?.customer_name || ""} | PI: ${activePo?.pi_number || "—"} | ETD: ${activePo?.etd || "—"}`, 14, 22);

    let y = 30;
    const drawHeaderRow = (cols, widths, yPos) => {
      doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
      let x = 14;
      cols.forEach((col, i) => { doc.rect(x, yPos - 4, widths[i], 7, "F"); doc.setFontSize(6.5); doc.text(col, x + 1, yPos); x += widths[i]; });
      doc.setTextColor(0, 0, 0);
      return yPos + 5;
    };

    if (viewMode === "combined") {
      const cols = ["Article", "Colors", "Total Qty", "Part", "Prod Size", "Dir", "Fabrication", "Width", "Cut/Unit", "Net Mtrs", "Wastage", "Total Mtrs"];
      const widths = [35, 30, 14, 22, 18, 12, 40, 14, 16, 16, 14, 18];
      y = drawHeaderRow(cols, widths, y);
      combinedGroups.forEach((g, gi) => {
        g.components.forEach((comp, ci) => {
          if (y > 185) { doc.addPage(); y = 20; y = drawHeaderRow(cols, widths, y); }
          const rowData = [
            ci === 0 ? (g.displayName || "").substring(0, 22) : "", ci === 0 ? (g.colors || "").substring(0, 20) : "", ci === 0 ? String(g.totalQty) : "",
            comp.component_type || "", comp.product_size || "", comp.direction || "", (comp.fabric_type || "").substring(0, 26),
            comp.width ? `${comp.width}` : "", comp.consumption_per_unit?.toFixed(4) || "",
            comp.net_total?.toFixed(2) || "", `${comp.wastage_percent ?? 6}%`, comp.total_required?.toFixed(2) || "",
          ];
          if (gi % 2 === 0) { doc.setFillColor(235, 240, 250); let x = 14; widths.forEach(w => { doc.rect(x, y - 3.5, w, 6, "F"); x += w; }); }
          doc.setFontSize(6.5); let x = 14;
          rowData.forEach((val, i) => { doc.text(String(val), x + 1, y); x += widths[i]; });
          y += 6;
        });
        y += 2;
      });
    } else {
      const cols = ["Article", "Code", "Qty", "Part", "Prod Size", "Dir", "Fabrication", "Width", "Cut/Unit", "Net Mtrs", "Wastage", "Total Mtrs"];
      const widths = [35, 22, 12, 22, 18, 12, 38, 12, 16, 16, 14, 18];
      colorGroups.forEach(([color, arts]) => {
        if (y > 175) { doc.addPage(); y = 20; }
        doc.setFillColor(38, 92, 50); doc.setTextColor(255, 255, 255);
        doc.rect(14, y - 4, widths.reduce((s, w) => s + w, 0), 8, "F");
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text(`● ${color.toUpperCase()}`, 16, y); y += 8;
        doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
        y = drawHeaderRow(cols, widths, y);
        arts.forEach((art, artIdx) => {
          (art.components || []).forEach((comp, ci) => {
            if (y > 185) { doc.addPage(); y = 20; y = drawHeaderRow(cols, widths, y); }
            const net = (comp.consumption_per_unit || 0) * (art.order_quantity || 0);
            const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
            const rowData = [
              ci === 0 ? (art.article_name || "").substring(0, 22) : "", ci === 0 ? (art.article_code || "") : "", ci === 0 ? String(art.order_quantity || "") : "",
              comp.component_type || "", comp.product_size || "", comp.direction || "", (comp.fabric_type || "").substring(0, 26),
              comp.width ? `${comp.width}` : "", comp.consumption_per_unit?.toFixed(4) || "",
              net.toFixed(2), `${comp.wastage_percent ?? 6}%`, total.toFixed(2),
            ];
            if (artIdx % 2 === 0) { doc.setFillColor(235, 240, 250); let x = 14; widths.forEach(w => { doc.rect(x, y - 3.5, w, 6, "F"); x += w; }); }
            doc.setFontSize(6.5); let x = 14;
            rowData.forEach((val, i) => { doc.text(String(val), x + 1, y); x += widths[i]; });
            y += 6;
          });
          y += 2;
        });
        y += 4;
      });
    }

    // Fabric summary
    y += 4;
    if (y > 175) { doc.addPage(); y = 20; }
    doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 4, 150, 7, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("FABRIC REQUIREMENT SUMMARY", 16, y); y += 8;
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
    fabricSummary.forEach((f, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(235, 240, 250); doc.rect(14, y - 3.5, 150, 6, "F"); }
      doc.setFontSize(7);
      doc.text(f.fabric_type || "", 15, y);
      doc.text(f.width ? `${f.width}cm` : "", 90, y);
      doc.text(f.net_total.toFixed(2), 110, y);
      doc.text(f.total_with_wastage.toFixed(2), 140, y);
      y += 6;
    });
    doc.save(`FabricWorking_${viewMode}_${activePo?.po_number || "PO"}.pdf`);
  };

  // ─── TABLE HEADER COLUMNS ────────────────────────────────────────────────────
  const combinedCols = ["Article (Base)", "Colors", "Total Qty", "Part", "Prod. Size", "Direction", "Fabrication", "Width (cm)", "Cut/Unit (m)", "Net Mtrs", "Wastage %", "Total Mtrs", ""];
  const separateCols = ["Article Name", "Article Code", "Qty", "Part", "Prod. Size", "Direction", "Fabrication", "Width (cm)", "Cut/Unit (m)", "Net Mtrs", "Wastage %", "Total Mtrs", ""];

  return (
    <div className="space-y-3">
      <style>{`@media print { .print-hidden { display: none !important; } @page { margin: 0.8cm; size: A3 landscape; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 9px; } }`}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between print-hidden flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Fabric Working Sheet</h1>
          <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
            <SelectTrigger className="w-64 h-8 text-xs"><SelectValue placeholder="Select PO" /></SelectTrigger>
            <SelectContent>{pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* View mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              onClick={() => setViewMode("combined")}
              className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${viewMode === "combined" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <Grid className="h-3 w-3" /> Combined
            </button>
            <button
              onClick={() => setViewMode("separate")}
              className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${viewMode === "separate" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <List className="h-3 w-3" /> Separate
            </button>
          </div>
          <UploadFabricSheet onSuccess={() => queryClient.invalidateQueries({ queryKey: ["articles"] })} />
          <Button size="sm" variant="outline" onClick={handleDownloadExcel} className="gap-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 text-xs"><Printer className="h-3.5 w-3.5" /> Print</Button>
        </div>
      </div>

      {/* PO Info */}
      {activePo && (
        <div className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-1.5 text-blue-800 font-medium print:bg-transparent print:border-gray-300 print:text-black">
          PO: <strong>{activePo.po_number}</strong>{activePo.pi_number ? <> | PI: <strong>{activePo.pi_number}</strong></> : ""} | Customer: {activePo.customer_name} | ETD: {activePo.etd || "—"} | Ex-Factory: {activePo.ex_factory_date || "—"}
          {viewMode === "combined" && <span className="ml-3 px-2 py-0.5 bg-blue-200 rounded text-blue-900 font-semibold">COMBINED — All Colors & Sizes</span>}
          {viewMode === "separate" && <span className="ml-3 px-2 py-0.5 bg-green-200 rounded text-green-900 font-semibold">SEPARATE — By Color</span>}
        </div>
      )}

      {poArticles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No articles found for this PO.</p>
        </div>
      ) : (
        <div>
          {/* ─── COMBINED VIEW ──────────────────────────────────────────────── */}
          {viewMode === "combined" && (
            <div className="overflow-x-auto rounded border border-gray-300 shadow-sm">
              <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
                <thead>
                  <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                    {combinedCols.map((col) => (
                      <th key={col} className="border border-gray-400 px-2 py-2 text-left whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {combinedGroups.map((g, gi) => (
                    <React.Fragment key={g.key}>
                      {g.components.length === 0 ? (
                        <tr style={{ backgroundColor: gi % 2 === 0 ? "#EBF0FA" : "#FFFFFF" }}>
                          <td className="border border-gray-300 px-2 py-1.5 font-semibold text-blue-900">{g.displayName}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-xs text-gray-500">{g.colors}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold">{g.totalQty}</td>
                            <td colSpan={9} className="border border-gray-300 px-2 py-1.5 text-muted-foreground italic">No components defined</td>
                          <td className="border border-gray-300 px-2 py-1 text-center print-hidden">
                            <button onClick={() => startEdit(g.template)} className="text-blue-600 hover:text-blue-800" title="Edit fabric specs"><Pencil className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>
                      ) : (
                        g.components.map((comp, ci) => (
                          <tr key={ci} style={{ backgroundColor: gi % 2 === 0 ? "#EBF0FA" : "#FFFFFF" }}>
                            {ci === 0 && (
                              <>
                                <td rowSpan={g.components.length} className="border border-gray-300 px-2 py-1.5 font-semibold text-blue-900 align-top">{g.displayName}</td>
                                <td rowSpan={g.components.length} className="border border-gray-300 px-2 py-1.5 text-xs text-gray-500 align-top">{g.colors}</td>
                                <td rowSpan={g.components.length} className="border border-gray-300 px-2 py-1.5 text-center font-bold align-top">{g.totalQty}</td>
                              </>
                            )}
                            <td className="border border-gray-300 px-2 py-1 font-medium">{comp.component_type}</td>
                            <td className="border border-gray-300 px-2 py-1 text-center">{comp.product_size || "—"}</td>
                            <td className="border border-gray-300 px-2 py-1 text-center">{comp.direction || "—"}</td>
                            <td className="border border-gray-300 px-2 py-1">{comp.fabric_type}</td>
                            <td className="border border-gray-300 px-2 py-1 text-center">{comp.width ? `${comp.width}cm` : "—"}</td>
                            <td className="border border-gray-300 px-2 py-1 text-center">{comp.consumption_per_unit?.toFixed(4)}</td>
                            <td className="border border-gray-300 px-2 py-1 text-center">{comp.net_total?.toFixed(2)}</td>
                            <td className="border border-gray-300 px-2 py-1 text-center">{comp.wastage_percent ?? 6}%</td>
                            <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{comp.total_required?.toFixed(2)}</td>
                            {ci === 0 && (
                              <td rowSpan={g.components.length} className="border border-gray-300 px-2 py-1 text-center align-top print-hidden">
                                <button onClick={() => startEdit(g.template)} className="text-blue-600 hover:text-blue-800" title="Edit fabric specs"><Pencil className="h-3.5 w-3.5" /></button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── SEPARATE VIEW (BY COLOR) ───────────────────────────────────── */}
          {viewMode === "separate" && (
            <div className="space-y-4">
              {colorGroups.map(([color, colorArticles]) => (
                <div key={color} className="rounded border border-gray-300 shadow-sm overflow-hidden">
                  <div className="px-3 py-2 text-sm font-bold text-white" style={{ backgroundColor: "#1F6B3F" }}>
                    ● {color.toUpperCase()} — {colorArticles.reduce((s, a) => s + (a.order_quantity || 0), 0).toLocaleString()} sets
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                          {separateCols.map((col, i) => (
                            <th key={i} className="border border-gray-400 px-2 py-2 text-left whitespace-nowrap print-hidden:last">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {colorArticles.map((article, artIdx) => {
                          const isEditing = editingId === article.id;
                          const comps = isEditing ? editForm.components : (article.components || []);
                          const rowCount = Math.max(comps.length, 1);
                          const artBg = artIdx % 2 === 0 ? "#EBF0FA" : "#FFFFFF";

                          return (
                            <React.Fragment key={article.id}>
                              {!isEditing && comps.length === 0 ? (
                                <tr style={{ backgroundColor: artBg }}>
                                  <td className="border border-gray-300 px-2 py-1.5 font-semibold text-blue-900">{article.article_name}</td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-gray-500">{article.article_code}</td>
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
                                  <td className="border border-gray-300 px-2 py-1.5 print-hidden" />
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
                                          <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 text-gray-600 align-top">{article.article_code}</td>
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
                                      <td className="border border-gray-300 px-2 py-1 text-center">
                                        {isEditing ? (
                                          <input className="w-20 text-xs border rounded px-1 py-0.5 text-center" placeholder="e.g. 70x96+4" value={comp.product_size || ""} onChange={(e) => updateComp(idx, "product_size", e.target.value)} />
                                        ) : comp.product_size || "—"}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1 text-center">
                                        {isEditing ? (
                                          <input className="w-16 text-xs border rounded px-1 py-0.5 text-center" placeholder="WXL" value={comp.direction || ""} onChange={(e) => updateComp(idx, "direction", e.target.value)} />
                                        ) : comp.direction || "—"}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1">
                                        {isEditing ? (
                                          <input className="w-full text-xs border rounded px-1 py-0.5" value={comp.fabric_type || ""} onChange={(e) => updateComp(idx, "fabric_type", e.target.value)} />
                                        ) : comp.fabric_type}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1 text-center">
                                        {isEditing ? (
                                          <input type="number" className="w-16 text-xs border rounded px-1 py-0.5 text-center" value={comp.width || ""} onChange={(e) => updateComp(idx, "width", Number(e.target.value))} />
                                        ) : comp.width ? `${comp.width}cm` : "—"}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1 text-center">
                                        {isEditing ? (
                                          <input type="number" step="0.0001" className="w-20 text-xs border rounded px-1 py-0.5 text-center" value={comp.consumption_per_unit || ""} onChange={(e) => updateComp(idx, "consumption_per_unit", Number(e.target.value))} />
                                        ) : comp.consumption_per_unit?.toFixed(4)}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1 text-center">{net.toFixed(2)}</td>
                                      <td className="border border-gray-300 px-2 py-1 text-center">
                                        {isEditing ? (
                                          <input type="number" className="w-14 text-xs border rounded px-1 py-0.5 text-center" value={comp.wastage_percent ?? 6} onChange={(e) => updateComp(idx, "wastage_percent", Number(e.target.value))} />
                                        ) : `${comp.wastage_percent ?? 6}%`}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{total.toFixed(2)}</td>
                                      {idx === 0 && (
                                        <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1 text-center align-top print-hidden">
                                          {isEditing ? (
                                            <div className="flex flex-col gap-1 items-center">
                                              <button onClick={saveEdit} className="text-green-600 hover:text-green-800" title="Save"><Save className="h-3.5 w-3.5" /></button>
                                              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600" title="Cancel"><X className="h-3.5 w-3.5" /></button>
                                            </div>
                                          ) : (
                                            <button onClick={() => startEdit(article)} className="text-blue-600 hover:text-blue-800" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })
                              )}
                              {isEditing && (
                                <tr style={{ backgroundColor: artBg }}>
                                  <td colSpan={3} />
                                  <td colSpan={9} className="border border-gray-300 px-2 py-1">
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
                </div>
              ))}
            </div>
          )}

          {/* Fabric Summary Table */}
          {fabricSummary.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded border border-gray-300 shadow-sm">
              <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
                <thead>
                  <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                    <th className="border border-gray-400 px-3 py-2 text-left" colSpan={2}>FABRIC REQUIREMENT SUMMARY — {activePo?.po_number}</th>
                    <th className="border border-gray-400 px-3 py-2 text-center">Width</th>
                    <th className="border border-gray-400 px-3 py-2 text-right">Net Mtrs (100%)</th>
                    <th className="border border-gray-400 px-3 py-2 text-right">Total Mtrs (with wastage)</th>
                  </tr>
                </thead>
                <tbody>
                  {fabricSummary.map((f, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#EBF0FA" : "white" }}>
                      <td className="border border-gray-300 px-3 py-1.5" colSpan={2}>{f.fabric_type}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center">{f.width ? `${f.width}cm` : "—"}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right">{f.net_total.toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right font-bold" style={{ backgroundColor: "#FFF2CC" }}>{f.total_with_wastage.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#1F3864", color: "white", fontWeight: "bold" }}>
                    <td className="border border-gray-400 px-3 py-1.5" colSpan={3}>GRAND TOTAL</td>
                    <td className="border border-gray-400 px-3 py-1.5 text-right">{fabricSummary.reduce((s, f) => s + f.net_total, 0).toFixed(2)}</td>
                    <td className="border border-gray-400 px-3 py-1.5 text-right">{fabricSummary.reduce((s, f) => s + f.total_with_wastage, 0).toFixed(2)}</td>
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