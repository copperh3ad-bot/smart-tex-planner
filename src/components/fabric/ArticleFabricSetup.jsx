import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, Pencil, Loader2, CheckCircle2 } from "lucide-react";

const COMPONENT_TYPES = ["Front", "Skirt", "Bottom", "Piping", "Binding", "Filling", "Lamination", "Top Fabric", "Window (Outside)", "Window (Inside)", "Fabric Bag"];

/**
 * Shown when an article has no fabric components yet.
 * Offers two paths: Upload a file (AI extracts components) or Manual Entry.
 * Props:
 *   article     — the Article record
 *   onSetup(components) — called with the extracted/entered components array
 *   onEdit      — triggers the existing inline edit mode (manual path shortcut)
 */
export default function ArticleFabricSetup({ article, onSetup, onEdit }) {
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatusMsg("Uploading file...");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setStatusMsg("Extracting fabric specs with AI...");

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a textile ERP assistant. Extract all fabric component details from this file for the article "${article.article_name}" (code: ${article.article_code || "N/A"}).
Return a JSON array of components. Each component must have these fields:
- component_type: one of [${COMPONENT_TYPES.join(", ")}]
- fabric_type: string (e.g. "Terry Cotton 100%")
- gsm: number
- width: number (in cm)
- consumption_per_unit: number (meters per piece)
- wastage_percent: number (default 6 if not specified)
- total_required: consumption_per_unit * ${article.order_quantity || 0} * (1 + wastage_percent/100)

If the file contains a table with these details, extract each row as a component. If missing fields, use sensible defaults.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            components: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  component_type: { type: "string" },
                  fabric_type: { type: "string" },
                  gsm: { type: "number" },
                  width: { type: "number" },
                  consumption_per_unit: { type: "number" },
                  wastage_percent: { type: "number" },
                  total_required: { type: "number" },
                }
              }
            }
          }
        }
      });

      const components = result?.components || [];
      if (components.length === 0) {
        setStatusMsg("No components found. Please enter manually.");
        setUploading(false);
        return;
      }

      // Recalculate totals with actual quantity
      const qty = article.order_quantity || 0;
      const enriched = components.map((c) => {
        const net = (c.consumption_per_unit || 0) * qty;
        return {
          ...c,
          wastage_percent: c.wastage_percent ?? 6,
          total_required: +(net * (1 + (c.wastage_percent ?? 6) / 100)).toFixed(4),
        };
      });

      setStatusMsg("Done!");
      onSetup(enriched);
    } catch (err) {
      setStatusMsg("Error: " + (err.message || "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <td colSpan={10} className="border border-gray-300 px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 font-medium">
          ⚠ New Article — No fabric working defined
        </span>

        {uploading ? (
          <span className="flex items-center gap-1.5 text-xs text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {statusMsg}
          </span>
        ) : statusMsg === "Done!" ? (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {statusMsg}
          </span>
        ) : (
          <>
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleFileUpload} />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-300 bg-blue-50 hover:bg-blue-100 rounded px-2 py-1 transition-colors">
                <Upload className="h-3.5 w-3.5" /> Upload Fabric Spec File
              </span>
            </label>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Enter Manually
            </button>
            {statusMsg && <span className="text-xs text-red-600">{statusMsg}</span>}
          </>
        )}
      </div>
    </td>
  );
}