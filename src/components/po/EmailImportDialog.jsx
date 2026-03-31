import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, Sparkles, FileText, FileSpreadsheet, Upload, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "email", label: "Email Body", icon: Mail },
  { id: "pdf", label: "PDF File", icon: FileText },
  { id: "excel", label: "Excel / CSV", icon: FileSpreadsheet },
];

const FULL_SCHEMA = {
  type: "object",
  properties: {
    po_number: { type: "string" },
    customer_name: { type: "string" },
    order_date: { type: "string" },
    delivery_date: { type: "string" },
    ex_factory_date: { type: "string" },
    etd: { type: "string" },
    eta: { type: "string" },
    currency: { type: "string", enum: ["USD", "EUR", "GBP", "INR", "CNY", "PKR", "BDT"] },
    total_po_value: { type: "number" },
    total_quantity: { type: "number" },
    notes: { type: "string" },
    items: {
      type: "array",
      description: "All line items / article details in the PO",
      items: {
        type: "object",
        properties: {
          item_code: { type: "string", description: "SKU or item code" },
          item_description: { type: "string", description: "Article / product description" },
          fabric_type: { type: "string", description: "Fabric or material type" },
          gsm: { type: "number" },
          width: { type: "number", description: "Width in inches" },
          quantity: { type: "number" },
          unit: { type: "string", description: "e.g. Pieces, Meters, Kgs" },
          unit_price: { type: "number" },
          delivery_date: { type: "string" },
          fabric_construction: { type: "string" },
          finish: { type: "string" },
          shrinkage: { type: "string" },
          cbm: { type: "number" },
          pieces_per_carton: { type: "number" },
        }
      }
    }
  },
};

const EXTRACT_PROMPT = `Extract the full purchase order details from the provided content. 
Extract BOTH the PO header info AND every line item/article with all available details.
For dates use YYYY-MM-DD format. 
For each item extract: item code/SKU, description, fabric type, GSM, width, quantity, unit, unit price, delivery date, fabric construction, finish, shrinkage, CBM, pieces per carton.
Be thorough — extract every article/product row you can find.`;

export default function EmailImportDialog({ open, onOpenChange, onExtracted }) {
  const [tab, setTab] = useState("email");
  const [emailText, setEmailText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef();

  const reset = () => { setEmailText(""); setFile(null); setLoading(false); setDragOver(false); setResult(null); };

  const handleFileSelect = (f) => { if (f) setFile(f); };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleExtract = async () => {
    setLoading(true);
    let extracted = null;

    if (tab === "email") {
      extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `${EXTRACT_PROMPT}\n\nEmail content:\n${emailText}`,
        response_json_schema: FULL_SCHEMA,
      });
      extracted.source = "Email";
    } else {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (tab === "pdf") {
        extracted = await base44.integrations.Core.InvokeLLM({
          prompt: EXTRACT_PROMPT,
          file_urls: [file_url],
          response_json_schema: FULL_SCHEMA,
        });
        extracted.source = "PDF";
      } else {
        const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: FULL_SCHEMA,
        });
        extracted = Array.isArray(res.output) ? res.output[0] : res.output;
        if (extracted) extracted.source = "Manual";
      }
    }

    setLoading(false);
    if (extracted) setResult(extracted);
  };

  const handleConfirm = () => {
    onExtracted(result);
    onOpenChange(false);
    reset();
  };

  const canSubmit = (tab === "email" && emailText.trim()) || (tab !== "email" && file);
  const itemCount = result?.items?.length || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Import PO with AI
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setFile(null); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    tab === id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="py-2 space-y-3">
              <p className="text-xs text-muted-foreground">
                {tab === "email" && "Paste the email content. AI will extract the PO header AND all line item details."}
                {tab === "pdf" && "Upload a PDF purchase order. AI will extract all PO and article details."}
                {tab === "excel" && "Upload an Excel or CSV file containing the PO and item data."}
              </p>

              {tab === "email" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Content</Label>
                  <Textarea
                    placeholder="Paste the full email text here..."
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    rows={10}
                    className="text-sm font-mono resize-none"
                  />
                </div>
              )}

              {(tab === "pdf" || tab === "excel") && (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                    dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      {tab === "pdf" ? <FileText className="h-5 w-5 text-primary" /> : <FileSpreadsheet className="h-5 w-5 text-primary" />}
                      <span className="text-sm font-medium text-foreground">{file.name}</span>
                      <button className="ml-1 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {tab === "pdf" ? "Drop a PDF here, or click to browse" : "Drop an Excel / CSV here, or click to browse"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tab === "pdf" ? ".pdf" : ".xlsx, .xls, .csv"}
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={tab === "pdf" ? ".pdf" : ".xlsx,.xls,.csv"}
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
              <Button onClick={handleExtract} disabled={loading || !canSubmit}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extracting...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Extract PO Details</>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Extraction Result Preview */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold text-sm">Extraction Complete</span>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              {result.po_number && <div className="flex justify-between"><span className="text-muted-foreground">PO Number</span><span className="font-medium">{result.po_number}</span></div>}
              {result.customer_name && <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{result.customer_name}</span></div>}
              {result.delivery_date && <div className="flex justify-between"><span className="text-muted-foreground">Delivery Date</span><span className="font-medium">{result.delivery_date}</span></div>}
              {result.total_po_value && <div className="flex justify-between"><span className="text-muted-foreground">Total Value</span><span className="font-medium">{result.currency || "USD"} {result.total_po_value?.toLocaleString()}</span></div>}
              {result.total_quantity && <div className="flex justify-between"><span className="text-muted-foreground">Total Qty</span><span className="font-medium">{result.total_quantity?.toLocaleString()}</span></div>}
            </div>

            {itemCount > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {itemCount} line item{itemCount > 1 ? "s" : ""} extracted — will be auto-created
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.items.map((item, i) => (
                    <div key={i} className="bg-card border rounded px-3 py-2 text-xs flex justify-between">
                      <span className="font-medium">{item.item_code || item.item_description || `Item ${i + 1}`}</span>
                      <span className="text-muted-foreground">Qty: {item.quantity} {item.unit || ""} {item.unit_price ? `· $${item.unit_price}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemCount === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                No line items found in the source. You can add items manually after creating the PO.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setResult(null)}>Re-extract</Button>
              <Button onClick={handleConfirm}>
                Create PO {itemCount > 0 ? `+ ${itemCount} Items` : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}