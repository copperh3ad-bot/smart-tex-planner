import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, Loader2, X, AlertTriangle } from "lucide-react";
import TechPackReview from "../components/techpack/TechPackReview";
import * as XLSX from "xlsx";

const STEPS = ["Upload", "Extracting", "Review & Edit", "Saved"];

export default function TechPack() {
  const [step, setStep] = useState(0); // 0=upload, 1=extracting, 2=review, 3=saved
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [extractionWarning, setExtractionWarning] = useState(null);
  const [selectedPoId, setSelectedPoId] = useState("");
  const queryClient = useQueryClient();

  const isExcel = (f) => f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"));

  // Parse Excel file client-side into a plain text representation of all sheets
  const parseExcelToText = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true, raw: false });
        let text = "";
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          // Convert to array of arrays, skipping empty rows
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
          if (rows.length === 0) return;
          text += `\n\n=== SHEET: ${sheetName} ===\n`;
          rows.forEach((row) => {
            const cells = row.map(c => String(c ?? "").trim());
            if (cells.some(c => c !== "")) {
              text += cells.join(" | ") + "\n";
            }
          });
        });
        resolve(text.trim());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(f);
  });

  const { data: pos = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date"),
  });

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(null); }
  };

  const LLM_PROMPT = (extraContext = "") => `You are a textile/garment tech pack expert. Extract all relevant data from this tech pack.
${extraContext ? `\nThe document is an Excel file. Here is its full text content extracted from all sheets:\n\n${extraContext}\n\nUse this text as your primary source.` : ""}
Return a structured JSON with the following keys:

{
  "article": {
    "article_name": "string",
    "article_code": "string",
    "size_label": "string",
    "color": "string",
    "description": "string",
    "order_quantity": number or null
  },
  "fabric_components": [
    {
      "component_type": "e.g. Flat Sheet / Fitted Sheet / Pillow Case / Body / Skirt etc.",
      "product_size": "dimensions e.g. 70x96+4",
      "direction": "e.g. WXL / LXL / WXW",
      "fabric_type": "e.g. Jersey, Terry, Woven",
      "gsm": number or null,
      "width": number or null,
      "composition": "e.g. 100% Cotton",
      "consumption_per_unit": number or null,
      "wastage_percent": number or null
    }
  ],
  "stitching": [
    {
      "stitch_type": "string e.g. Overlock, Flatlock, Chain stitch",
      "thread_type": "string e.g. Polyester, Cotton",
      "thread_count": "string e.g. 40/2",
      "color": "string",
      "location": "string e.g. Side seam, Hem, Collar"
    }
  ],
  "accessories": [
    {
      "category": "one of: Zipper, Elastic, Button, Dori, Eyelet, Stitching Thread, Label, Accessory, Other",
      "item_description": "string",
      "color": "string",
      "size_spec": "string",
      "quantity_per_piece": number or null,
      "unit": "Pcs or Meters or Kgs"
    }
  ],
  "packaging": {
    "labels": [
      { "label_type": "string e.g. Brand Label, Care Label, Size Label", "description": "string", "size_spec": "string" }
    ],
    "polybag": { "type": "PVC/PP/PE/LDPE/OPP", "size_cm": "string", "thickness_microns": number or null, "printed": true/false },
    "stiffener": { "used": true/false, "material": "string", "size_cm": "string" },
    "carton": { "type": "Printed/Plain/Brown/White", "quality": "string e.g. 5-ply", "size_cm": "string", "pieces_per_carton": number or null },
    "stickers": [
      { "sticker_type": "string e.g. UPC Sticker, Barcode Sticker", "description": "string" }
    ]
  }
}

Extract as much as you can. Use null for fields you cannot find. Do not invent data. For Excel data: look across all sheets — Article/General info is usually on the first sheet, Fabric/BOM on a second, Accessories/Trims on another, and Packaging separately.`;

  const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
      article: { type: "object" },
      fabric_components: { type: "array" },
      stitching: { type: "array" },
      accessories: { type: "array" },
      packaging: { type: "object" },
    },
  };

  const handleExtract = async () => {
    if (!file) return;
    setStep(1);
    setError(null);
    setExtractionWarning(null);

    try {
      let result;

      if (isExcel(file)) {
        // Step 1: Parse Excel client-side to text
        let excelText = "";
        let excelParseWarning = null;
        try {
          excelText = await parseExcelToText(file);
        } catch (parseErr) {
          excelParseWarning = "Excel parsing had issues — proceeding with file upload fallback.";
        }

        if (excelText && excelText.length > 100) {
          // Use text content as context in the prompt (no file_url needed)
          // Truncate if very large to avoid token limits
          const truncated = excelText.length > 40000 ? excelText.slice(0, 40000) + "\n...[truncated]" : excelText;
          result = await base44.integrations.Core.InvokeLLM({
            prompt: LLM_PROMPT(truncated),
            response_json_schema: RESPONSE_SCHEMA,
            model: "claude_sonnet_4_6",
          });
          if (excelParseWarning) setExtractionWarning(excelParseWarning);
        } else {
          // Fallback: upload file and let LLM read it directly
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          result = await base44.integrations.Core.InvokeLLM({
            prompt: LLM_PROMPT(),
            file_urls: [file_url],
            response_json_schema: RESPONSE_SCHEMA,
            model: "claude_sonnet_4_6",
          });
          setExtractionWarning("Excel text extraction yielded minimal data — used file upload fallback. Some fields may need manual review.");
        }
      } else {
        // PDF or image: upload and let LLM read visually
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        result = await base44.integrations.Core.InvokeLLM({
          prompt: LLM_PROMPT(),
          file_urls: [file_url],
          response_json_schema: RESPONSE_SCHEMA,
          model: "claude_sonnet_4_6",
        });
      }

      setExtractedData(result);
      setStep(2);
    } catch (err) {
      setError("Extraction failed: " + err.message + ". You can proceed to manual entry.");
      setStep(0);
    }
  };

  const handleManualEntry = () => {
    setExtractedData({ article: {}, fabric_components: [], stitching: [], accessories: [], packaging: {} });
    setError(null);
    setStep(2);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["articles"] });
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setStep(3);
  };

  const handleReset = () => {
    setStep(0);
    setFile(null);
    setExtractedData(null);
    setError(null);
    setSelectedPoId("");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Tech Pack Processing</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a tech pack (PDF, Excel, or image) to automatically extract and fill data into the system.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                i < step ? "bg-green-500 border-green-500 text-white"
                : i === step ? "bg-primary border-primary text-white"
                : "bg-white border-gray-300 text-gray-400"
              }`}>
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === step ? "text-primary" : i < step ? "text-green-600" : "text-gray-400"}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-green-400" : "bg-gray-200"}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Tech Pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById("techpack-file").click()}
            >
              <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700">Click to upload or drag & drop</p>
              <p className="text-xs text-gray-400 mt-1">PDF, Excel (.xlsx), or Image (JPG, PNG) — max 100MB</p>
              <input
                id="techpack-file"
                type="file"
                accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800 truncate">{file.name}</p>
                  <p className="text-xs text-blue-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => setFile(null)} className="text-blue-400 hover:text-blue-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Link to PO */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Link to Purchase Order (optional)</label>
              <select
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedPoId}
                onChange={e => setSelectedPoId(e.target.value)}
              >
                <option value="">— Select PO —</option>
                {pos.map(p => (
                  <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-2">
                <p className="text-sm text-red-600">{error}</p>
                <button onClick={handleManualEntry} className="text-xs text-red-500 underline hover:text-red-700">
                  Skip extraction and enter data manually →
                </button>
              </div>
            )}

            <Button onClick={handleExtract} disabled={!file} className="w-full gap-2">
              <Upload className="h-4 w-4" /> Extract Data from Tech Pack
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Extracting */}
      {step === 1 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <p className="text-base font-semibold text-gray-800">Extracting Tech Pack Data...</p>
            <p className="text-sm text-gray-500 mt-1">Our AI is reading the document and mapping it to the correct fields.</p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === 2 && extractedData && (
        <TechPackReview
          extractedData={extractedData}
          selectedPoId={selectedPoId}
          pos={pos}
          onSaved={handleSaved}
          onBack={() => setStep(0)}
          warning={extractionWarning}
        />
      )}

      {/* Step 3: Saved */}
      {step === 3 && (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-14 w-14 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-bold text-gray-800">Tech Pack Data Saved Successfully!</p>
            <p className="text-sm text-gray-500 mt-1 mb-6">All extracted data has been saved to the respective modules.</p>
            <Button onClick={handleReset} variant="outline">Process Another Tech Pack</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}