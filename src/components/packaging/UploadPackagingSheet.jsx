import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";

export default function UploadPackagingSheet({ onSuccess }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState(null);
  const inputRef = useRef();

  const reset = () => { setFile(null); setStatus("idle"); setMessage(""); setResults(null); };

  const handleFile = (e) => { const f = e.target.files[0]; if (f) setFile(f); };

  const handleProcess = async () => {
    if (!file) return;
    setStatus("uploading");
    setMessage("Reading file...");

    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });

    setStatus("extracting");
    setMessage("Extracting packaging data with AI...");

    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract accessories and packaging specification data from this CSV/spreadsheet content. For each article/product row extract:
- article_name
- article_code (SKU if present)
- customer_name (brand/buyer if present)
- labels: array of { label_type, description, supplier, unit_cost, notes }
- polybag: { type (PVC/PP/PE/LDPE/OPP), thickness_microns, printed (bool), size_cm, supplier, unit_cost, notes }
- stiffener: { used (bool), material, size_cm, supplier, unit_cost, notes }
- carton: { type, quality, size_cm, pieces_per_carton, gross_weight_kg, net_weight_kg, supplier, unit_cost }
- stickers: array of { sticker_type, description, supplier, unit_cost, notes }
- notes

Content:
${text.substring(0, 15000)}`,
      response_json_schema: {
        type: "object",
        properties: {
          articles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                article_name: { type: "string" },
                article_code: { type: "string" },
                customer_name: { type: "string" },
                notes: { type: "string" }
              }
            }
          }
        }
      }
    });

    const articles = extracted?.articles || [];
    if (articles.length === 0) {
      setStatus("error");
      setMessage("Could not extract any data. Please save as CSV and try again.");
      return;
    }

    setStatus("updating");
    setMessage(`Creating/updating ${articles.length} packaging templates...`);

    let created = 0, updated = 0;
    for (const art of articles) {
      if (!art.article_name) continue;
      try {
        const existing = await base44.entities.ArticlePackaging.filter({ article_code: art.article_code || "" });
        if (existing && existing.length > 0) {
          await base44.entities.ArticlePackaging.update(existing[0].id, art);
          updated++;
        } else {
          await base44.entities.ArticlePackaging.create(art);
          created++;
        }
      } catch { continue; }
    }

    setStatus("done");
    setResults({ created, updated });
    setMessage(`Done!`);
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
              Upload Accessories & Packaging Sheet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel or CSV file with packaging specs. The AI will extract label, polybag, carton, and sticker data for each article.
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
                <p className="text-xs text-green-700">Created: {results?.created} | Updated: {results?.updated} templates</p>
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
                <Button size="sm" onClick={handleProcess} disabled={!file}>Process File</Button>
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