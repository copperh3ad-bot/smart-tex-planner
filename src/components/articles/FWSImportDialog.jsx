import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

/**
 * FWSImportDialog – uploads a Fabric Working Sheet Excel and uses AI to extract
 * Article records in the same format as the demo FWS file.
 */
export default function FWSImportDialog({ open, onOpenChange, purchaseOrders, onImported }) {
  const [file, setFile] = useState(null);
  const [poId, setPoId] = useState("");
  const [status, setStatus] = useState("idle"); // idle | uploading | extracting | saving | done | error
  const [message, setMessage] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const handleImport = async () => {
    if (!file) { setMessage("Please select an Excel file."); return; }
    setStatus("uploading");
    setMessage("Uploading file...");

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setStatus("extracting");
    setMessage("AI is reading the Fabric Working Sheet...");

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          articles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                program_name: { type: "string" },
                program_code: { type: "string" },
                article_type: { type: "string" },
                article_name: { type: "string" },
                article_code: { type: "string" },
                size_name: { type: "string" },
                unit_price: { type: "number" },
                qty_per_carton: { type: "number" },
                cbm_per_carton: { type: "number" },
                order_quantity: { type: "number" },
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      component_type: { type: "string" },
                      fabric_description: { type: "string" },
                      width_cm: { type: "number" },
                      direction: { type: "string" },
                      consumption_per_unit: { type: "number" },
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (result.status !== "success" || !result.output?.articles?.length) {
      setStatus("error");
      setMessage("Could not extract data from the file. Make sure it matches the FWS format.");
      return;
    }

    setStatus("saving");
    const rows = result.output.articles;
    setMessage(`Saving ${rows.length} articles...`);

    const po = purchaseOrders.find(p => p.id === poId);
    let saved = 0;
    for (const row of rows) {
      await base44.entities.Article.create({
        ...row,
        po_id: poId || undefined,
        po_item_id: undefined,
        article_name: row.article_name || row.article_type || row.program_name || "Imported",
        total_fabric_required: (row.components || []).reduce((s, c) => s + ((row.order_quantity || 0) * (c.consumption_per_unit || 0)), 0),
      });
      saved++;
    }

    setImportedCount(saved);
    setStatus("done");
    setMessage(`Successfully imported ${saved} articles.`);
    onImported?.();
  };

  const reset = () => {
    setFile(null);
    setPoId("");
    setStatus("idle");
    setMessage("");
    setImportedCount(0);
  };

  const isRunning = ["uploading", "extracting", "saving"].includes(status);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isRunning) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Fabric Working Sheet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Upload your Fabric Working Sheet Excel file. The system will automatically extract all article records (program name, item code, size, fabric consumption, etc.) and import them into the Article Master.
          </p>

          {/* File upload */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Excel File (.xlsx)</label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="fws-file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={isRunning}
              />
              <label htmlFor="fws-file" className="cursor-pointer">
                {file ? (
                  <div className="text-sm font-medium text-primary">{file.name}</div>
                ) : (
                  <div>
                    <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to select Excel file</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* PO Link (optional) */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Link to Purchase Order (optional)</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
              disabled={isRunning}
            >
              <option value="">No PO linked</option>
              {purchaseOrders.map(po => (
                <option key={po.id} value={po.id}>{po.po_number} – {po.customer_name}</option>
              ))}
            </select>
          </div>

          {/* Status message */}
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
              status === "done" ? "bg-green-50 text-green-700 border border-green-200" :
              status === "error" ? "bg-red-50 text-red-700 border border-red-200" :
              "bg-blue-50 text-blue-700 border border-blue-200"
            }`}>
              {isRunning && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
              {status === "done" && <CheckCircle className="h-4 w-4 shrink-0" />}
              {status === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
              {message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }} disabled={isRunning}>
            {status === "done" ? "Close" : "Cancel"}
          </Button>
          {status !== "done" && (
            <Button onClick={handleImport} disabled={isRunning || !file}>
              {isRunning ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Processing...</> : "Import Articles"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}