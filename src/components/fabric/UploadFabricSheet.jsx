import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";

export default function UploadFabricSheet({ onSuccess }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | extracting | updating | done | error
  const [message, setMessage] = useState("");
  const [results, setResults] = useState(null);
  const inputRef = useRef();

  const reset = () => { setFile(null); setStatus("idle"); setMessage(""); setResults(null); };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setStatus("uploading");
    setMessage("Reading file...");

    // Read file as text
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });

    setStatus("extracting");
    setMessage("Extracting fabric data with AI...");

    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract fabric working sheet data from this CSV/spreadsheet content. For each row that represents an article/item with a SKU/item code, extract:
- item_code (SKU code like PCSJMO-T-CG, GPMP33, etc.)
- article_name (full description)
- color (e.g. Cloud Gray, Misty Blue, White — extract from item description or code suffix -CG=Cloud Gray, -MB=Misty Blue, -WH=White)
- order_quantity (total qty across all colors if available, as number)
- components: array where each component has:
  - component_type: e.g. Flat Sheet, Fitted Sheet, Pillow Case, Front, Skirt, Bottom, Piping, Filling
  - product_size: the size/dimension string e.g. '70x96+4', '39x75+16', '20x30+4'
  - direction: knitting/fabric direction e.g. WXL, LXL, WXW (from Direction column)
  - fabric_type: fabric description from header column
  - width: fabric width in cm (number, from F/width or Width column)
  - consumption_per_unit: consumption in meters per unit (number, from Con MTR column)
  - wastage_percent: wastage as whole number e.g. 20 for 20% (from Wastage % column, default 6 if not present)
Only include rows with valid item codes. Only include components with consumption_per_unit > 0.

Spreadsheet content:
${text.substring(0, 15000)}`,
      response_json_schema: {
        type: "object",
        properties: {
          articles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_code: { type: "string" },
                article_name: { type: "string" },
                color: { type: "string" },
                order_quantity: { type: "number" },
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      component_type: { type: "string" },
                      product_size: { type: "string" },
                      direction: { type: "string" },
                      fabric_type: { type: "string" },
                      width: { type: "number" },
                      consumption_per_unit: { type: "number" },
                      wastage_percent: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const articles = extracted?.articles || [];
    if (articles.length === 0) {
      setStatus("error");
      setMessage("Could not extract any article data. Please save the file as CSV and try again.");
      return;
    }

    setStatus("updating");
    setMessage(`Updating ${articles.length} articles in the database...`);

    let updated = 0;
    let skipped = 0;
    for (const art of articles) {
      if (!art.item_code) { skipped++; continue; }
      const components = (art.components || []).map(c => ({
        ...c,
        total_required: +(((c.consumption_per_unit || 0) * (art.order_quantity || 0)) * (1 + (c.wastage_percent || 6) / 100)).toFixed(4)
      }));
      const updateData = { components };
      if (art.order_quantity) updateData.order_quantity = art.order_quantity;
      if (art.color) updateData.color = art.color;
      try {
        const matches = await base44.entities.Article.filter({ article_code: art.item_code });
        if (matches && matches.length > 0) {
          for (const m of matches) {
            await base44.entities.Article.update(m.id, updateData);
            updated++;
          }
        } else skipped++;
      } catch { skipped++; }
    }

    setStatus("done");
    setResults({ updated, skipped, total: articles.length });
    setMessage(`Done! Updated ${updated} articles.`);
    if (onSuccess) onSuccess();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5 text-xs">
        <Upload className="h-3.5 w-3.5" /> Upload Sheet
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Upload Fabric Working Sheet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel (.xlsx) working sheet. The AI will extract fabric components and update all matching article records automatically.
            </p>

            {status === "idle" && (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{file ? file.name : "Click to select file"}</p>
                <p className="text-xs text-muted-foreground mt-1">Please save your Excel file as <strong>CSV</strong> before uploading (.csv)</p>
                <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
              </div>
            )}

            {status !== "idle" && status !== "done" && status !== "error" && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                <p className="text-sm text-blue-800">{message}</p>
              </div>
            )}

            {status === "done" && (
              <div className="p-4 bg-green-50 rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-800">Import Complete</p>
                </div>
                <p className="text-xs text-green-700">Updated: {results?.updated} articles | Skipped: {results?.skipped}</p>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{message}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(false); }}>
                {status === "done" ? "Close" : "Cancel"}
              </Button>
              {status === "idle" && (
                <Button size="sm" onClick={handleProcess} disabled={!file}>
                  Process File
                </Button>
              )}
              {(status === "done" || status === "error") && (
                <Button size="sm" onClick={reset}>Upload Another</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}