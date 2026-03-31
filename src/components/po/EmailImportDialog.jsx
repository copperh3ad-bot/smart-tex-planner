import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, Sparkles, FileText, FileSpreadsheet, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "email", label: "Email Body", icon: Mail },
  { id: "pdf", label: "PDF File", icon: FileText },
  { id: "excel", label: "Excel / CSV", icon: FileSpreadsheet },
];

const PO_SCHEMA = {
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
  },
};

const EXTRACT_PROMPT = `Extract purchase order details from the provided content. Return only what you can confidently find. For dates, use YYYY-MM-DD format. Focus on: PO number, customer/buyer name, order date, delivery date, ex-factory date, ETD, ETA, currency, total value, total quantity.`;

export default function EmailImportDialog({ open, onOpenChange, onExtracted }) {
  const [tab, setTab] = useState("email");
  const [emailText, setEmailText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  const reset = () => { setEmailText(""); setFile(null); setLoading(false); setDragOver(false); };

  const handleFileSelect = (f) => {
    if (!f) return;
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleExtract = async () => {
    setLoading(true);

    if (tab === "email") {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `${EXTRACT_PROMPT}\n\nEmail content:\n${emailText}`,
        response_json_schema: PO_SCHEMA,
      });
      setLoading(false);
      onExtracted({ ...result, source: "Email" });
      onOpenChange(false);
      reset();
      return;
    }

    // Upload file first
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    if (tab === "excel") {
      // Use ExtractDataFromUploadedFile for Excel/CSV
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: PO_SCHEMA,
      });
      setLoading(false);
      const data = Array.isArray(extracted.output) ? extracted.output[0] : extracted.output;
      onExtracted({ ...(data || {}), source: "Manual" });
      onOpenChange(false);
      reset();
      return;
    }

    if (tab === "pdf") {
      // Use InvokeLLM with file_urls for PDF
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: EXTRACT_PROMPT,
        file_urls: [file_url],
        response_json_schema: PO_SCHEMA,
      });
      setLoading(false);
      onExtracted({ ...result, source: "PDF" });
      onOpenChange(false);
      reset();
      return;
    }
  };

  const canSubmit = (tab === "email" && emailText.trim()) || (tab !== "email" && file);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Import PO with AI
          </DialogTitle>
        </DialogHeader>

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
            {tab === "email" && "Paste the email content below. AI will extract PO details automatically."}
            {tab === "pdf" && "Upload a PDF purchase order. AI will read and extract all details."}
            {tab === "excel" && "Upload an Excel or CSV file containing PO data."}
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
                    {tab === "pdf" ? "Drop a PDF file here, or click to browse" : "Drop an Excel / CSV file here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tab === "pdf" ? "Supports .pdf" : "Supports .xlsx, .xls, .csv"}
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
      </DialogContent>
    </Dialog>
  );
}