import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ChevronDown, ChevronUp } from "lucide-react";

// Standard SKU pattern: alphanumeric, dashes, underscores, 3-30 chars
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_\/]{1,28}[A-Za-z0-9]$/;

export function validateSKU(code) {
  if (!code) return { valid: false, reason: "SKU is empty" };
  if (code.length < 3) return { valid: false, reason: "SKU too short (min 3 chars)" };
  if (code.length > 30) return { valid: false, reason: "SKU too long (max 30 chars)" };
  if (!SKU_PATTERN.test(code)) return { valid: false, reason: "Invalid characters or format (use letters, numbers, -, _)" };
  return { valid: true, reason: "" };
}

function Section({ title, color, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-white text-[11px] font-bold uppercase tracking-wide"
        style={{ backgroundColor: color }}
      >
        {title}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="overflow-x-auto">{children}</div>}
    </div>
  );
}

function TableCell({ value, warn }) {
  if (value === null || value === undefined || value === "") {
    return <td className="px-2 py-1.5 text-[10px] text-red-400 italic border-r border-gray-100">missing</td>;
  }
  return (
    <td className={`px-2 py-1.5 text-[10px] border-r border-gray-100 ${warn ? "text-amber-700 bg-amber-50 font-medium" : "text-gray-700"}`}>
      {String(value)}
    </td>
  );
}

export default function ExtractionSummaryTable({ extractedData, onExportErrors }) {
  if (!extractedData) return null;

  const { article = {}, fabric_components = [], stitching = [], accessories = [], packaging = {} } = extractedData;

  // Collect all errors/warnings
  const errors = [];
  const skuCheck = validateSKU(article.article_code);
  if (!article.article_name) errors.push("Article: article_name is missing");
  if (!skuCheck.valid) errors.push(`Article: SKU "${article.article_code || ""}" — ${skuCheck.reason}`);
  fabric_components.forEach((f, i) => {
    if (!f.component_type) errors.push(`Fabric[${i + 1}]: component_type missing`);
    if (!f.fabric_type) errors.push(`Fabric[${i + 1}]: fabric_type missing`);
    if (!f.gsm) errors.push(`Fabric[${i + 1}]: GSM missing`);
  });
  accessories.forEach((a, i) => {
    if (!a.item_description) errors.push(`Accessory[${i + 1}]: item_description missing`);
    if (!a.category) errors.push(`Accessory[${i + 1}]: category missing`);
  });

  const handleExportErrors = () => {
    if (onExportErrors) { onExportErrors(errors); return; }
    const lines = [
      "Tech Pack Extraction Error Log",
      `Generated: ${new Date().toLocaleString()}`,
      "=".repeat(40),
      ...errors.map((e, i) => `${i + 1}. ${e}`),
      "",
      "--- RAW EXTRACTED DATA ---",
      JSON.stringify(extractedData, null, 2),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "extraction_errors.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Error summary banner */}
      <div className="flex items-start gap-3 flex-wrap">
        {errors.length === 0 ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-medium flex-1">
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            Extraction complete — no mapping errors detected.
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex-1">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <strong>{errors.length} mapping error(s) detected:</strong>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          </div>
        )}
        <button
          onClick={handleExportErrors}
          className="flex items-center gap-1 text-xs bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" /> Export Error Log
        </button>
      </div>

      {/* Article Section */}
      <Section title="Article / SKU" color="#1F3864">
        <table className="w-full text-[10px]">
          <thead className="bg-gray-50">
            <tr>
              {["article_name","article_code","size_label","color","order_quantity","description"].map(k => (
                <th key={k} className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">{k}</th>
              ))}
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500">SKU Valid?</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              {["article_name","article_code","size_label","color","order_quantity","description"].map(k => (
                <TableCell key={k} value={article[k]} />
              ))}
              <td className="px-2 py-1.5 text-[10px]">
                {skuCheck.valid
                  ? <span className="text-green-600 font-semibold">✓ Valid</span>
                  : <span className="text-red-600 font-semibold" title={skuCheck.reason}>✗ {skuCheck.reason}</span>
                }
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Fabric Section */}
      <Section title={`Fabric Components (${fabric_components.length})`} color="#2E4A7A">
        {fabric_components.length === 0 ? (
          <p className="text-xs text-red-500 p-3 italic">⚠ No fabric components extracted</p>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="bg-gray-50">
              <tr>
                {["component_type","fabric_type","gsm","width","composition","consumption_per_unit","wastage_percent","product_size","direction"].map(k => (
                  <th key={k} className="px-2 py-1.5 text-left font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fabric_components.map((f, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {["component_type","fabric_type","gsm","width","composition","consumption_per_unit","wastage_percent","product_size","direction"].map(k => (
                    <TableCell key={k} value={f[k]} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Accessories Section */}
      <Section title={`Accessories (${accessories.length})`} color="#4A6741" defaultOpen={false}>
        {accessories.length === 0 ? (
          <p className="text-xs text-amber-600 p-3 italic">No accessories extracted</p>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="bg-gray-50">
              <tr>
                {["category","item_description","color","size_spec","quantity_per_piece","unit"].map(k => (
                  <th key={k} className="px-2 py-1.5 text-left font-semibold text-gray-500 border-r border-gray-200">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accessories.map((a, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {["category","item_description","color","size_spec","quantity_per_piece","unit"].map(k => (
                    <TableCell key={k} value={a[k]} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Packaging Section */}
      <Section title="Packaging" color="#6B4F2E" defaultOpen={false}>
        <div className="p-3 space-y-2 text-[10px] text-gray-700">
          <div><strong>Labels:</strong> {(packaging.labels||[]).length} entries {(packaging.labels||[]).map(l => l.label_type).filter(Boolean).join(", ") || <span className="text-gray-400">none</span>}</div>
          <div><strong>Polybag:</strong> {packaging.polybag?.type || <span className="text-amber-600 italic">not extracted</span>} {packaging.polybag?.size_cm ? `— ${packaging.polybag.size_cm}` : ""}</div>
          <div><strong>Stiffener:</strong> {packaging.stiffener?.used ? `${packaging.stiffener.material || "Yes"} (${packaging.stiffener.size_cm || "—"})` : <span className="text-gray-400">No / not extracted</span>}</div>
          <div><strong>Carton:</strong> {packaging.carton?.type || <span className="text-amber-600 italic">not extracted</span>} {packaging.carton?.size_cm ? `— ${packaging.carton.size_cm}` : ""} {packaging.carton?.pieces_per_carton ? `(${packaging.carton.pieces_per_carton} pcs/ctn)` : ""}</div>
          <div><strong>Stickers:</strong> {(packaging.stickers||[]).map(s => s.sticker_type).filter(Boolean).join(", ") || <span className="text-gray-400">none</span>}</div>
        </div>
      </Section>
    </div>
  );
}