import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, Loader2, X, AlertTriangle, List, Plus, Table2, Eye } from "lucide-react";
import TechPackReview from "../components/techpack/TechPackReview";
import TechPackList from "../components/techpack/TechPackList";
import ExtractionDebugView from "../components/techpack/ExtractionDebugView";
import ExtractionSummaryTable from "../components/techpack/ExtractionSummaryTable";
import BulkEditTable from "../components/techpack/BulkEditTable";
import * as XLSX from "xlsx";

const STEPS = ["Upload", "Extracting", "Review & Edit", "Saved"];

export default function TechPack() {
  const [mainTab, setMainTab] = useState("list"); // "list" | "process"
  const [step, setStep] = useState(0); // 0=upload, 1=extracting, 2=review, 3=saved
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [extractionWarning, setExtractionWarning] = useState(null);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [editingRecord, setEditingRecord] = useState(null); // TechPackRecord being edited
  const [isNewVersion, setIsNewVersion] = useState(false);
  const [rawExcelText, setRawExcelText] = useState(null);
  const [reviewTab, setReviewTab] = useState("bulk"); // "bulk" | "summary" | "review"
  const queryClient = useQueryClient();

  const isExcel = (f) => f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"));

  const parseExcelToText = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true, raw: false });
        let text = "";
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
          if (rows.length === 0) return;
          text += `\n\n=== SHEET: ${sheetName} ===\n`;
          rows.forEach((row) => {
            const cells = row.map(c => String(c ?? "").trim());
            if (cells.some(c => c !== "")) text += cells.join(" | ") + "\n";
          });
        });
        resolve(text.trim());
      } catch (err) { reject(err); }
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

  const LLM_PROMPT = (extraContext = "") => `You are a textile/garment tech pack data extraction expert. Your job is to extract ALL data accurately from this tech pack document.

${extraContext ? `=== EXCEL FILE TEXT CONTENT (ALL SHEETS) ===\n${extraContext}\n=== END OF EXCEL CONTENT ===\n\nThis text is your primary data source — parse EVERY table row and column carefully.` : ""}

## MULTI-SHEET EXTRACTION STRATEGY

For Excel files with multiple sheets, extract data as follows:

**Sheet 1 (Articles / SKUs / General Info):**
- Look for columns: item_code, sku, article_code, product_code → map to article.article_code
- Look for: brand, product_type, product_category, product_name, description → concatenate or use best match for article.article_name
- Look for: size, size_label, size_range → article.size_label
- Look for: color, colour, colorway → article.color
- Look for: units_per_carton, pcs_per_carton, qty_per_set → article.order_quantity

**Sheet 2 (Fabric / BOM / Fabric Consumption):**
- Each row = one fabric component. Extract ALL rows.
- Columns to find: component, component_type, panel, part → fabric_components[].component_type
- fabric_type, fabric_construction, knit_type, weave → fabric_components[].fabric_type
- gsm, grams → fabric_components[].gsm (number only)
- width, fabric_width, width_cm → fabric_components[].width (cm as number)
- composition, fiber_content, content → fabric_components[].composition
- consumption, consumption_per_unit, mtrs_per_pc → fabric_components[].consumption_per_unit (number)
- wastage, wastage_percent, waste_% → fabric_components[].wastage_percent (number)
- dimensions, product_size, cut_size → fabric_components[].product_size
- direction, knitting_direction → fabric_components[].direction

**Sheet 3 (Accessories / Trims / Accessory Consumption):**
- Each row = one accessory/trim item. Extract ALL rows including packaging rows.
- For rows where category/type is NOT "Packaging" or "Label" or "Carton" or "Polybag":
  → Add to accessories[] array
  → Map category/type column to accessories[].category using these rules:
    * zipper/zip → "Zipper"
    * slider → "Slider"
    * elastic/elastic tape → "Elastic"
    * button/snap → "Button"
    * dori/cord/drawstring → "Dori"
    * eyelet/grommet → "Eyelet"
    * thread/sewing thread → "Stitching Thread"
    * insert card/hang tag/swing tag that is not a fabric label → "Insert Card"
    * label (woven, printed, care, brand) → "Label"
    * polybag/poly bag → "Polybag"
    * stiffener/board → "Stiffener"
    * carton/box → "Carton"
    * sticker/barcode sticker → "Sticker"
    * otherwise → "Accessory" or "Other"
  → item_name/description → accessories[].item_description
  → size_spec/size/dimension → accessories[].size_spec
  → color/colour → accessories[].color
  → qty_per_piece/consumption/multiplier → accessories[].quantity_per_piece
  → unit (pcs/meters/kgs) → accessories[].unit

- For packaging-related rows, map to packaging object:
  * If item_name contains "Satin Label" or "Woven Label" or "Care Label" or "Brand Label" or "Size Label" or "Law Tag" or "Wash Label" or "Content Label" or "Country of Origin" or "Barcode Label" or "Price Ticket" or "Hang Tag":
    → Add to packaging.labels[] with label_type = item_name, description = material, size_spec = size
  * If item_name contains "Polybag" or "Poly Bag":
    → packaging.polybag: type = material (PVC/PP/PE/LDPE/OPP), size_cm = size, thickness_microns = thickness
  * If item_name contains "Stiffener" or "Board":
    → packaging.stiffener: used=true, material = material column, size_cm = size
  * If item_name contains "Box" or "Carton" or "Printed Box" or "Master Carton":
    → packaging.carton: type = "Printed" or "Plain" or "Brown" based on description, quality = material (e.g. 5-ply), size_cm = size, pieces_per_carton = qty_per_piece or units_per_carton
  * If item_name contains "Sticker" or "Barcode Sticker" or "UPC":
    → Add to packaging.stickers[] with sticker_type = item_name, description = material

**Sheet 4+ (Carton Master / Packing):**
- Extract carton dimensions: length × width × height → packaging.carton.size_cm (format "LxWxH")
- gross_weight, net_weight → packaging.carton notes
- pieces_per_carton / units_per_carton → packaging.carton.pieces_per_carton

## STITCHING
- Look for a stitching/sewing sheet or rows with stitch_type, SPI, stitches_per_inch, thread_type
- Map to stitching[]: stitch_type, thread_type, thread_count, color, location

## CRITICAL RULES
1. NEVER return empty arrays unless you've exhausted all possible column name variants
2. Use null for numeric fields that cannot be found — do NOT use 0 or ""
3. Do NOT skip rows — if a table has 8 fabric rows, extract all 8
4. Cross-reference item_code/sku across sheets to link related data
5. For merged cell headers in Excel text: the header will appear on first row, sub-rows inherit it
6. article_code MUST be the SKU/item code (e.g. FT2-TW, MP-QU-GY), NOT the product name

Return ONLY this exact JSON structure (no markdown, no explanation):
{
  "article": {
    "article_name": "full product name string",
    "article_code": "SKU/item code — alphanumeric with dashes e.g. FT2-TW-WH",
    "size_label": "e.g. Twin, Queen, King, S, M, L",
    "color": "string",
    "description": "string",
    "order_quantity": number or null
  },
  "fabric_components": [
    {
      "component_type": "e.g. Flat Sheet, Fitted Sheet, Pillow Case, Body, Front Panel",
      "product_size": "e.g. 70x96+4",
      "direction": "e.g. WXL, LXL, WXW",
      "fabric_type": "e.g. Jersey, Terry, Woven, Flannel",
      "gsm": number or null,
      "width": number or null,
      "composition": "e.g. 100% Cotton",
      "consumption_per_unit": number or null,
      "wastage_percent": number or null
    }
  ],
  "stitching": [
    {
      "stitch_type": "e.g. Overlock 3-thread, Flatlock",
      "thread_type": "e.g. Polyester, Cotton",
      "thread_count": "e.g. 40/2",
      "color": "string",
      "location": "e.g. Side seam, All seams"
    }
  ],
  "accessories": [
    {
      "category": "Zipper|Slider|Elastic|Button|Dori|Eyelet|Stitching Thread|Insert Card|Label|Accessory|Polybag|Stiffener|Carton|Sticker|Other",
      "item_description": "full description",
      "color": "string",
      "size_spec": "e.g. 20mm, 4 inch",
      "quantity_per_piece": number or null,
      "unit": "Pcs or Meters or Kgs"
    }
  ],
  "packaging": {
    "labels": [
      { "label_type": "e.g. Brand Label, Care Label, Hang Tag", "description": "string", "size_spec": "string" }
    ],
    "polybag": { "type": "PVC|PP|PE|LDPE|OPP", "size_cm": "LxW", "thickness_microns": number or null, "printed": true or false },
    "stiffener": { "used": true or false, "material": "string", "size_cm": "string" },
    "carton": { "type": "Printed|Plain|Brown|White", "quality": "e.g. 5-ply B-flute", "size_cm": "LxWxH", "pieces_per_carton": number or null },
    "stickers": [
      { "sticker_type": "e.g. UPC Sticker, Barcode Sticker", "description": "string" }
    ]
  }
}`;

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
      let uploadedUrl = null;

      if (isExcel(file)) {
        let excelText = "";
        let excelParseWarning = null;
        try {
          excelText = await parseExcelToText(file);
          setRawExcelText(excelText); // store for debug view
        } catch {
          excelParseWarning = "Excel parsing had issues — proceeding with file upload fallback.";
          setRawExcelText("(parse error — fell back to file upload)");
        }

        if (excelText && excelText.length > 100) {
          const truncated = excelText.length > 60000 ? excelText.slice(0, 60000) + "\n...[truncated at 60k chars]" : excelText;
          result = await base44.integrations.Core.InvokeLLM({
            prompt: LLM_PROMPT(truncated),
            response_json_schema: RESPONSE_SCHEMA,
            model: "claude_sonnet_4_6",
          });
          if (excelParseWarning) setExtractionWarning(excelParseWarning);
        } else {
          const uploaded = await base44.integrations.Core.UploadFile({ file });
          uploadedUrl = uploaded.file_url;
          result = await base44.integrations.Core.InvokeLLM({
            prompt: LLM_PROMPT(),
            file_urls: [uploadedUrl],
            response_json_schema: RESPONSE_SCHEMA,
            model: "claude_sonnet_4_6",
          });
          setExtractionWarning("Excel text extraction yielded minimal data — used file upload fallback. Review all fields carefully.");
        }
      } else {
        // PDF or image
        const uploaded = await base44.integrations.Core.UploadFile({ file });
        uploadedUrl = uploaded.file_url;
        result = await base44.integrations.Core.InvokeLLM({
          prompt: LLM_PROMPT(),
          file_urls: [uploadedUrl],
          response_json_schema: RESPONSE_SCHEMA,
          model: "claude_sonnet_4_6",
        });
      }

      // Validate extraction quality — warn about empty sections
      const warnings = [];
      if (!result?.article?.article_name) warnings.push("Article name not found");
      if (!result?.fabric_components?.length) warnings.push("No fabric components found");
      if (!result?.accessories?.length) warnings.push("No accessories found");
      if (warnings.length > 0) {
        setExtractionWarning((prev) =>
          [prev, `Some sections may be incomplete: ${warnings.join(", ")}. Please fill manually.`]
            .filter(Boolean).join(" | ")
        );
      }

      setFileUrl(uploadedUrl);
      setExtractedData(result);
      setStep(2);
    } catch (err) {
      setError("Extraction failed: " + err.message);
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
    queryClient.invalidateQueries({ queryKey: ["techPackRecords"] });
    setStep(3);
  };

  const handleReset = () => {
    setStep(0);
    setFile(null);
    setFileUrl(null);
    setExtractedData(null);
    setError(null);
    setSelectedPoId("");
    setEditingRecord(null);
    setIsNewVersion(false);
    setRawExcelText(null);
    setReviewTab("bulk");
  };

  const handleStartNew = () => {
    handleReset();
    setMainTab("process");
  };

  // Called from TechPackList: open an existing record for editing/viewing
  const handleEditRecord = (record, isRepeat = false, isVersion = false) => {
    setEditingRecord(record);
    setIsNewVersion(isVersion);
    const data = record.extracted_data || {};
    setExtractedData({
      article: isRepeat
        ? { ...data.article, order_quantity: null } // clear qty for repeat
        : (data.article || {}),
      fabric_components: data.fabric_components || [],
      stitching: data.stitching || [],
      accessories: data.accessories || [],
      packaging: data.packaging || {},
    });
    if (isRepeat) {
      setExtractionWarning("This is a repeat order — article code matched an existing tech pack. All fields are pre-filled. Update quantities and link to the new PO before saving.");
    } else if (isVersion) {
      setExtractionWarning("You are uploading a new version of this tech pack. Upload a new file below to re-extract, or edit data directly and save.");
    }
    setFileUrl(record.file_url || null);
    setSelectedPoId(record.po_id || "");
    setMainTab("process");
    setStep(2);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tech Pack</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload, extract, and manage tech packs for all articles.</p>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setMainTab("list"); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            mainTab === "list" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <List className="h-4 w-4" /> Saved Tech Packs
        </button>
        <button
          onClick={() => setMainTab("process")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            mainTab === "process" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Upload className="h-4 w-4" /> Process New
        </button>
      </div>

      {/* ── Tab: Saved Tech Packs ────────────────────────────────────────────── */}
      {mainTab === "list" && (
        <TechPackList onEdit={handleEditRecord} onNew={handleStartNew} />
      )}

      {/* ── Tab: Process New ────────────────────────────────────────────────── */}
      {mainTab === "process" && (
        <div className="space-y-4">
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
                  <p className="text-xs text-gray-400 mt-1">PDF, Excel (.xlsx), or Image (JPG, PNG)</p>
                  <input id="techpack-file" type="file"
                    accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
                    className="hidden" onChange={handleFileChange} />
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

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Link to Purchase Order (optional)</label>
                  <select
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={selectedPoId}
                    onChange={e => setSelectedPoId(e.target.value)}
                  >
                    <option value="">— Select PO —</option>
                    {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>)}
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
              <CardContent className="py-10 text-center space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                <p className="text-base font-semibold text-gray-800">Extracting Tech Pack Data...</p>
                <p className="text-sm text-gray-500">AI is reading the document and mapping all fields.</p>
                <p className="text-xs text-gray-400">This may take 15–30 seconds for complex documents.</p>
                {rawExcelText && (
                  <div className="mt-4 text-left max-w-2xl mx-auto">
                    <ExtractionDebugView rawText={rawExcelText} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Review */}
          {step === 2 && extractedData && (
            <div className="space-y-3">
              {/* Sub-tabs */}
              <div className="flex border-b border-gray-200 bg-white rounded-t-lg overflow-hidden">
                <button
                  onClick={() => setReviewTab("bulk")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${reviewTab === "bulk" ? "border-primary text-primary bg-blue-50/40" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <Table2 className="h-3.5 w-3.5" /> Bulk Edit & Validate
                </button>
                <button
                  onClick={() => setReviewTab("summary")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${reviewTab === "summary" ? "border-primary text-primary bg-blue-50/40" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <Eye className="h-3.5 w-3.5" /> Extraction Summary
                </button>
                <button
                  onClick={() => setReviewTab("review")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${reviewTab === "review" ? "border-primary text-primary bg-blue-50/40" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Full Review & Save
                </button>
                {rawExcelText && (
                  <button
                    onClick={() => setReviewTab("debug")}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${reviewTab === "debug" ? "border-amber-500 text-amber-700 bg-amber-50/40" : "border-transparent text-amber-500 hover:text-amber-700"}`}
                  >
                    🔍 Raw Debug
                  </button>
                )}
              </div>

              {/* Bulk Edit tab */}
              {reviewTab === "bulk" && (
                <BulkEditTable
                  extractedData={extractedData}
                  onChange={setExtractedData}
                />
              )}

              {/* Summary tab */}
              {reviewTab === "summary" && (
                <ExtractionSummaryTable extractedData={extractedData} />
              )}

              {/* Full review tab */}
              {reviewTab === "review" && (
                <TechPackReview
                  extractedData={extractedData}
                  selectedPoId={selectedPoId}
                  pos={pos}
                  onSaved={handleSaved}
                  onBack={() => { setStep(0); setEditingRecord(null); }}
                  warning={extractionWarning}
                  fileName={file?.name || editingRecord?.file_name || ""}
                  fileUrl={fileUrl || editingRecord?.file_url || ""}
                  existingRecordId={editingRecord?.id || null}
                  existingVersion={editingRecord?.version || 1}
                />
              )}

              {/* Debug tab */}
              {reviewTab === "debug" && rawExcelText && (
                <ExtractionDebugView rawText={rawExcelText} />
              )}
            </div>
          )}

          {/* Step 3: Saved */}
          {step === 3 && (
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <CheckCircle className="h-14 w-14 mx-auto text-green-500" />
                <p className="text-lg font-bold text-gray-800">Tech Pack Saved Successfully!</p>
                <p className="text-sm text-gray-500">All data has been saved to the respective modules and the Tech Pack library.</p>
                <div className="flex gap-3 justify-center pt-2">
                  <Button onClick={handleReset} variant="outline">Process Another</Button>
                  <Button onClick={() => { handleReset(); setMainTab("list"); }}>
                    View Saved Tech Packs
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}