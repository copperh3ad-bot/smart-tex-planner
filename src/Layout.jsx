import React, { useState, useMemo, useRef } from "react";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, FileText, Pencil, Save, X, Plus, Layers } from "lucide-react";
import UploadFabricSheet from "../components/fabric/UploadFabricSheet";

const COMPONENT_TYPES = ["Flat Sheet", "Fitted Sheet", "Fitted Sheet (2pc Split)", "Fitted Sheet (Split Head)", "Pillow Case (1pc)", "Pillow Case (2pc)", "Fabric Bag", "Front", "Back", "Skirt", "Bottom", "Piping", "Binding", "Filling", "Lamination", "Top Fabric", "Other"];

// Parse "Twin Sheet Set – Cloud Gray" → { base: "Twin Sheet Set", color: "Cloud Gray" }
function parseArticle(name) {
  const parts = (name || "").split(" – ");
  if (parts.length >= 2) return { base: parts[0].trim(), color: parts[1].trim() };
  return { base: name || "", color: "" };
}

// FIX #4: safe total — treats 0 consumption as explicitly zero, never recalculates to a non-zero
function calcTotal(comp, qty) {
  if ((comp.consumption_per_unit || 0) === 0) return 0;
  return typeof comp.total_required === "number" && !isNaN(comp.total_required)
    ? comp.total_required
    : (comp.consumption_per_unit || 0) * qty * (1 + (comp.wastage_percent ?? 13) / 100);
}

export default function FabricWorking() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [activeTab, setActiveTab] = useState("Combined");

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });

  const activePo = selectedPoId ? pos.find((p) => p.id === selectedPoId) : pos[0];

  const poArticles = useMemo(() => {
    if (!activePo) return [];
    return articles
      .filter((a) => a.po_id === activePo.id)
      .map((a) => ({ ...a, ...parseArticle(a.article_name) }))
      .sort((a, b) => a.article_name.localeCompare(b.article_name));
  }, [articles, activePo]);

  // FIX #1: derive color tabs dynamically from actual article colors in this PO
  const colorTabs = useMemo(() => {
    const colors = [...new Set(poArticles.map((a) => a.color).filter(Boolean))].sort();
    return ["Combined", ...colors];
  }, [poArticles]);

  // Keep safeActiveTab valid when PO changes
  const safeActiveTab = colorTabs.includes(activeTab) ? activeTab : "Combined";

  // FIX #2 & #3: combinedArticles now preserves product_size and direction from all sibling components
  const combinedArticles = useMemo(() => {
    const map = {};
    poArticles.forEach((art) => {
      const key = art.base || art.article_name;
      if (!map[key]) {
        map[key] = {
          ...art,
          order_quantity: 0,
          components: JSON.parse(JSON.stringify(art.components || [])),
          _colorQtys: {},
        };
      }
      map[key].order_quantity += art.order_quantity || 0;
      if (art.color) map[key]._colorQtys[art.color] = (art.order_quantity || 0);

      (art.components || []).forEach((comp) => {
        const existing = map[key].components.find((c) => c.component_type === comp.component_type);
        if (existing) {
          const artQty = art.order_quantity || 0;
          existing.total_required = (existing.total_required || 0) + calcTotal(comp, artQty);
          // Fill in product_size / direction if the seed component was missing them
          if (!existing.product_size && comp.product_size) existing.product_size = comp.product_size;
          if (!existing.direction && comp.direction) existing.direction = comp.direction;
        } else {
          // Component present in sibling but not in seed — add it
          map[key].components.push(JSON.parse(JSON.stringify(comp)));
        }
      });
    });
    return Object.values(map);
  }, [poArticles]);

  const displayArticles = useMemo(() => {
    if (safeActiveTab === "Combined") return combinedArticles;
    return poArticles.filter((a) => a.color === safeActiveTab);
  }, [safeActiveTab, combinedArticles, poArticles]);

  // FIX #4: skip zero-consumption components in summary
  const fabricSummary = useMemo(() => {
    const map = {};
    displayArticles.forEach((art) => {
      (art.components || []).forEach((comp) => {
        if ((comp.consumption_per_unit || 0) === 0) return;
        const key = `${comp.fabric_type || ""}__${comp.width || ""}`;
        if (!map[key]) map[key] = { fabric_type: comp.fabric_type || "—", width: comp.width, net_total: 0, total_with_wastage: 0 };
        const qty = art.order_quantity || 0;
        const net = (comp.consumption_per_unit || 0) * qty;
        map[key].net_total += net;
        map[key].total_with_wastage += calcTotal(comp, qty);
      });
    });
    return Object.values(map).sort((a, b) => (a.width || 0) - (b.width || 0));
  }, [displayArticles]);

  const updateArticle = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Article.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["articles"] }); setEditingId(null); },
  });

  const startEdit = (article) => {
    const sourceArticle = articles.find((a) => a.id === article.id) || article;
    setEditingId(article.id);
    setEditForm({ ...sourceArticle, components: JSON.parse(JSON.stringify(sourceArticle.components || [])) });
  };

  const updateComp = (idx, field, value) => {
    setEditForm((f) => {
      const comps = [...f.components];
      comps[idx] = { ...comps[idx], [field]: value };
      if (["consumption_per_unit", "wastage_percent"].includes(field)) {
        const c = comps[idx];
        const net = (c.consumption_per_unit || 0) * (f.order_quantity || 0);
        comps[idx].total_required = +(net * (1 + (c.wastage_percent || 13) / 100)).toFixed(4);
      }
      return { ...f, components: comps };
    });
  };

  const addComponent = () => setEditForm((f) => ({
    ...f,
    components: [...(f.components || []), {
      component_type: "Flat Sheet",
      fabric_type: "100% Modal Jersey Knit",
      gsm: 160,
      width: 112,
      consumption_per_unit: 0,
      wastage_percent: 13,
      product_size: "",
      direction: "WXL",
      total_required: 0,
      remarks: "",
    }],
  }));

  const removeComponent = (idx) => setEditForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));

  const saveEdit = async () => {
    const editedBase = parseArticle(editForm.article_name).base || editForm.article_name;
    const editedComps = editForm.components;
    const compSettingsByType = {};
    editedComps.forEach((c) => {
      compSettingsByType[c.component_type] = {
        fabric_type: c.fabric_type, gsm: c.gsm, width: c.width,
        product_size: c.product_size, direction: c.direction,
        consumption_per_unit: c.consumption_per_unit, wastage_percent: c.wastage_percent,
      };
    });
    await base44.entities.Article.update(editingId, editForm);
    const siblings = articles.filter((a) => {
      const base = parseArticle(a.article_name).base || a.article_name;
      return base === editedBase && a.id !== editingId;
    });
    await Promise.all(siblings.map((sib) => {
      const updatedComps = (sib.components || []).map((c) => {
        const settings = compSettingsByType[c.component_type];
        if (!settings) return c;
        const net = (settings.consumption_per_unit || 0) * (sib.order_quantity || 0);
        const total_required = +(net * (1 + (settings.wastage_percent || 13) / 100)).toFixed(4);
        return { ...c, ...settings, total_required };
      });
      return base44.entities.Article.update(sib.id, { ...sib, components: updatedComps });
    }));
    queryClient.invalidateQueries({ queryKey: ["articles"] });
    setEditingId(null);
  };

  // ─── EXCEL EXPORT ────────────────────────────────────────────
  const handleDownloadExcel = () => {
    const rows = [["Article", safeActiveTab === "Combined" ? "Colors (qty)" : "Color", "Order Qty", "Component", "Fabrication", "GSM", "Width", "Product Size", "Dir", "Cons/Unit (m)", "Net Mtrs", "Wastage %", "Total Mtrs", "Remarks"]];
    displayArticles.forEach((art) => {
      (art.components || []).forEach((comp, i) => {
        const qty = art.order_quantity || 0;
        const net = (comp.consumption_per_unit || 0) * qty;
        const total = calcTotal(comp, qty);
        const colorInfo = safeActiveTab === "Combined"
          ? Object.entries(art._colorQtys || {}).map(([c, q]) => `${c}:${q}`).join(" | ")
          : (art.color || "");
        rows.push([
          i === 0 ? art.base || art.article_name : "",
          i === 0 ? colorInfo : "",
          i === 0 ? qty : "",
          comp.component_type, comp.fabric_type, comp.gsm || 160,
          comp.width ? `${comp.width}cm` : "",
          comp.product_size || "", comp.direction || "",
          (comp.consumption_per_unit ?? 0).toFixed(4),
          net.toFixed(2), `${comp.wastage_percent ?? 13}%`, total.toFixed(2), comp.remarks || "",
        ]);
      });
      rows.push(Array(14).fill(""));
    });
    rows.push(["FABRIC SUMMARY", ...Array(13).fill("")]);
    rows.push(["Fabric Type", "", "", "", "", "", "Width (cm)", "", "", "", "Net Mtrs", "", "Total Mtrs", ""]);
    fabricSummary.forEach((f) => rows.push([f.fabric_type, "", "", "", "", "", f.width ? `${f.width}cm` : "", "", "", "", f.net_total.toFixed(2), "", f.total_with_wastage.toFixed(2), ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `FabricWorking_${activePo?.po_number || "PO"}_${safeActiveTab}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ─── PDF EXPORT ───────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a3" });
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text(`Fabric Working Sheet — ${activePo?.po_number || ""} [${safeActiveTab}]`, 14, 14);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${activePo?.customer_name || ""} | ETD: ${activePo?.etd || "—"}`, 14, 21);
    let y = 30;
    const isCombined = safeActiveTab === "Combined";
    const cols = ["Article", isCombined ? "Colors" : "Color", "Qty", "Component", "Fabrication", "GSM", "W", "Size", "Dir", "Cons/Unit", "Net Mtrs", "Wst%", "Total Mtrs"];
    const widths = [28, 28, 10, 24, 40, 10, 12, 20, 10, 16, 16, 10, 18];
    doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
    let x = 10;
    cols.forEach((col, i) => { doc.rect(x, y - 4, widths[i], 7, "F"); doc.setFontSize(6.5); doc.text(col, x + 1, y); x += widths[i]; });
    y += 5; doc.setTextColor(0, 0, 0);
    displayArticles.forEach((art, artIdx) => {
      const comps = art.components || [];
      const colorInfo = isCombined
        ? Object.entries(art._colorQtys || {}).map(([c, q]) => `${c.split(" ")[0]}:${q}`).join(" ")
        : (art.color || "");
      comps.forEach((comp, ci) => {
        const qty = art.order_quantity || 0;
        const net = (comp.consumption_per_unit || 0) * qty;
        const total = calcTotal(comp, qty);
        const rowData = [
          ci === 0 ? (art.base || art.article_name || "").substring(0, 20) : "",
          ci === 0 ? colorInfo.substring(0, 22) : "",
          ci === 0 ? String(qty) : "",
          (comp.component_type || "").substring(0, 18),
          (comp.fabric_type || "").substring(0, 28),
          String(comp.gsm || 160),
          comp.width ? `${comp.width}` : "",
          (comp.product_size || "").substring(0, 14),
          (comp.direction || "").substring(0, 8),
          (comp.consumption_per_unit ?? 0).toFixed(4),
          net.toFixed(2),
          `${comp.wastage_percent ?? 13}%`,
          total.toFixed(2),
        ];
        if (artIdx % 2 === 0) { doc.setFillColor(235, 240, 250); x = 10; widths.forEach((w) => { doc.rect(x, y - 3.5, w, 6, "F"); x += w; }); }
        doc.setFontSize(6.5); x = 10;
        rowData.forEach((val, i) => { doc.text(String(val), x + 1, y); x += widths[i]; });
        y += 6;
        if (y > 185) { doc.addPage(); y = 20; }
      });
    });
    y += 4;
    doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 4, 100, 7, "F");
    doc.setFontSize(8); doc.text("FABRIC REQUIREMENT SUMMARY", 11, y);
    y += 8; doc.setTextColor(0, 0, 0);
    fabricSummary.forEach((f, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(235, 240, 250); doc.rect(10, y - 3.5, 160, 6, "F"); }
      doc.setFontSize(7);
      doc.text(f.fabric_type || "", 11, y);
      doc.text(f.width ? `${f.width}cm` : "", 95, y);
      doc.text(f.net_total.toFixed(2), 115, y);
      doc.text(f.total_with_wastage.toFixed(2), 145, y);
      y += 6;
    });
    doc.save(`FabricWorking_${activePo?.po_number || "PO"}_${safeActiveTab}.pdf`);
  };

  // ─── TABLE ────────────────────────────────────────────────────
  const renderTable = (artList) => (
    <div className="overflow-x-auto rounded border border-gray-300 shadow-sm">
      <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
        <thead>
          <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
            <th className="border border-gray-400 px-2 py-2 text-left min-w-[140px]">Article</th>
            <th className="border border-gray-400 px-2 py-2 text-left w-28">{safeActiveTab === "Combined" ? "Colors (Qty)" : "Color"}</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-14">Ord Qty</th>
            <th className="border border-gray-400 px-2 py-2 text-left w-32">Component</th>
            <th className="border border-gray-400 px-2 py-2 text-left min-w-[160px]">Fabrication</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-14">GSM</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-16">Width</th>
            <th className="border border-gray-400 px-2 py-2 text-left w-24">Product Size</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-12">Dir</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-24">Cons/Unit (m)</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-20">Net Mtrs</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-16">Wst%</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-24 font-bold">Total Mtrs</th>
            <th className="border border-gray-400 px-2 py-2 text-left w-32">Remarks</th>
            <th className="border border-gray-400 px-2 py-2 text-center w-16 print-hidden">Edit</th>
          </tr>
        </thead>
        <tbody>
          {artList.map((article, artIdx) => {
            const isEditing = editingId === article.id;
            const comps = isEditing ? editForm.components : (article.components || []);
            const rowCount = Math.max(comps.length, 1);
            const artBg = artIdx % 2 === 0 ? "#EBF0FA" : "#FFFFFF";
            const colorInfo = safeActiveTab === "Combined"
              ? Object.entries(article._colorQtys || {}).map(([c, q]) => `${c}: ${q}`).join(" | ")
              : (article.color || "");

            return (
              <React.Fragment key={article.id || artIdx}>
                {comps.map((comp, idx) => {
                  const qty = isEditing ? editForm.order_quantity : (article.order_quantity || 0);
                  const net = (comp.consumption_per_unit || 0) * qty;
                  const total = isEditing
                    ? net * (1 + (comp.wastage_percent ?? 13) / 100)
                    : calcTotal(comp, qty);
                  return (
                    <tr key={idx} style={{ backgroundColor: artBg }}>
                      {idx === 0 && (
                        <>
                          <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 font-semibold text-blue-900 align-top text-xs">{article.base || article.article_name}</td>
                          <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 text-xs align-top">{colorInfo}</td>
                          <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1.5 text-center font-semibold align-top">
                            {isEditing
                              ? <input type="number" className="w-14 border rounded px-1 py-0.5 text-center text-xs" value={editForm.order_quantity || ""} onChange={(e) => setEditForm((f) => ({ ...f, order_quantity: Number(e.target.value) }))} />
                              : qty.toLocaleString()}
                          </td>
                        </>
                      )}
                      <td className="border border-gray-300 px-2 py-1">
                        {isEditing
                          ? <select className="w-full text-xs border rounded px-1 py-0.5" value={comp.component_type} onChange={(e) => updateComp(idx, "component_type", e.target.value)}>{COMPONENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                          : <span className="font-medium">{comp.component_type}</span>}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        {isEditing
                          ? <input className="w-full text-xs border rounded px-1 py-0.5" value={comp.fabric_type || ""} onChange={(e) => updateComp(idx, "fabric_type", e.target.value)} />
                          : comp.fabric_type}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {isEditing
                          ? <input type="number" className="w-14 text-xs border rounded px-1 py-0.5 text-center" value={comp.gsm || ""} onChange={(e) => updateComp(idx, "gsm", Number(e.target.value))} />
                          : (comp.gsm || 160)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {isEditing
                          ? <input type="number" className="w-14 text-xs border rounded px-1 py-0.5 text-center" value={comp.width || ""} onChange={(e) => updateComp(idx, "width", Number(e.target.value))} />
                          : (comp.width ? `${comp.width}cm` : "—")}
                      </td>
                      {/* FIX #2: product_size now correctly shown — preserved in combinedArticles merge */}
                      <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                        {isEditing
                          ? <input className="w-20 text-xs border rounded px-1 py-0.5" value={comp.product_size || ""} onChange={(e) => updateComp(idx, "product_size", e.target.value)} />
                          : (comp.product_size || "—")}
                      </td>
                      {/* FIX #3: direction now correctly shown — preserved in combinedArticles merge */}
                      <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                        {isEditing
                          ? <input className="w-12 text-xs border rounded px-1 py-0.5" value={comp.direction || ""} onChange={(e) => updateComp(idx, "direction", e.target.value)} />
                          : (comp.direction || "—")}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {isEditing
                          ? <input type="number" step="0.0001" className="w-20 text-xs border rounded px-1 py-0.5 text-center" value={comp.consumption_per_unit ?? ""} onChange={(e) => updateComp(idx, "consumption_per_unit", Number(e.target.value))} />
                          : (comp.consumption_per_unit ?? 0).toFixed(4)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{net.toFixed(2)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {isEditing
                          ? <input type="number" className="w-14 text-xs border rounded px-1 py-0.5 text-center" value={comp.wastage_percent ?? 13} onChange={(e) => updateComp(idx, "wastage_percent", Number(e.target.value))} />
                          : `${comp.wastage_percent ?? 13}%`}
                      </td>
                      {/* FIX #4: zero consumption correctly shows 0.00 */}
                      <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{total.toFixed(2)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {isEditing
                          ? <input className="w-full text-xs border rounded px-1 py-0.5" value={comp.remarks || ""} onChange={(e) => updateComp(idx, "remarks", e.target.value)} placeholder="Remarks..." />
                          : (comp.remarks || "")}
                      </td>
                      {idx === 0 && (
                        <td rowSpan={rowCount} className="border border-gray-300 px-2 py-1 text-center align-top print-hidden">
                          {isEditing ? (
                            <div className="flex flex-col gap-1 items-center pt-1">
                              <button onClick={saveEdit} title="Save" className="text-green-600 hover:text-green-800"><Save className="h-3.5 w-3.5" /></button>
                              <button onClick={addComponent} title="Add component" className="text-blue-500 hover:text-blue-700"><Plus className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setEditingId(null)} title="Cancel" className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(article)} className="text-blue-600 hover:text-blue-800"><Pencil className="h-3.5 w-3.5" /></button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3">
      <style>{`@media print { .print-hidden { display: none !important; } @page { margin: 0.8cm; size: A3 landscape; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between print-hidden flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Fabric Working Sheet</h1>
          <Select
            value={selectedPoId || activePo?.id || ""}
            onValueChange={(v) => { setSelectedPoId(v); setActiveTab("Combined"); }}
          >
            <SelectTrigger className="w-64 h-8 text-xs"><SelectValue placeholder="Select PO" /></SelectTrigger>
            <SelectContent>{pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <UploadFabricSheet onSuccess={() => queryClient.invalidateQueries({ queryKey: ["articles"] })} />
          <Button size="sm" variant="outline" onClick={handleDownloadExcel} className="gap-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 text-xs"><Printer className="h-3.5 w-3.5" /> Print</Button>
        </div>
      </div>

      {/* PO Info Banner */}
      {activePo && (
        <div className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-1.5 text-blue-800 font-medium">
          PO: <strong>{activePo.po_number}</strong> | Customer: {activePo.customer_name} | ETD: {activePo.etd || "—"} | Ex-Factory: {activePo.ex_factory_date || "—"}
        </div>
      )}

      {/* FIX #1: Dynamic color tabs — built from actual colors in this PO's articles */}
      {poArticles.length > 0 && colorTabs.length > 1 && (
        <div className="flex gap-2 print-hidden flex-wrap">
          {colorTabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${safeActiveTab === tab ? "bg-primary text-white border-primary" : "bg-white border-gray-300 text-gray-600 hover:border-primary"}`}>
              {tab === "Combined" ? "📋 Combined (All Colors)" : `🎨 ${tab}`}
            </button>
          ))}
        </div>
      )}

      {/* Color Qty Summary Bar */}
      {safeActiveTab === "Combined" && poArticles.length > 0 && (
        <div className="flex gap-4 text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2 print-hidden flex-wrap">
          {colorTabs.filter((t) => t !== "Combined").map((color) => {
            const total = poArticles.filter((a) => a.color === color).reduce((s, a) => s + (a.order_quantity || 0), 0);
            return <span key={color} className="font-medium text-gray-700">{color}: <span className="text-primary font-bold">{total.toLocaleString()} sets</span></span>;
          })}
          <span className="ml-auto font-medium text-gray-700">Total: <span className="text-primary font-bold">{poArticles.reduce((s, a) => s + (a.order_quantity || 0), 0).toLocaleString()} sets</span></span>
        </div>
      )}

      {poArticles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No articles found for this PO.</p>
        </div>
      ) : (
        <div>
          {renderTable(displayArticles)}

          {/* Fabric Summary */}
          {fabricSummary.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded border border-gray-300 shadow-sm">
              <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
                <thead>
                  <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                    <th className="border border-gray-400 px-3 py-2 text-left" colSpan={2}>
                      FABRIC SUMMARY — {activePo?.po_number} [{safeActiveTab}]
                    </th>
                    <th className="border border-gray-400 px-3 py-2 text-center">Width</th>
                    <th className="border border-gray-400 px-3 py-2 text-right">Net Meters</th>
                    <th className="border border-gray-400 px-3 py-2 text-right">Total Meters (incl. wastage)</th>
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
