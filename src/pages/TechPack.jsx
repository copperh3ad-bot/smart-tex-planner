import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload, FileText, CheckCircle, Loader2, X, List, Plus, Table2, Eye,
  AlertTriangle, FileSpreadsheet, FileScan, Layers, ChevronRight, Trash2
} from "lucide-react";

import TechPackReview from "../components/techpack/TechPackReview";
import TechPackList from "../components/techpack/TechPackList";
import ExtractionDebugView from "../components/techpack/ExtractionDebugView";
import ExtractionSummaryTable from "../components/techpack/ExtractionSummaryTable";
import BulkEditTable from "../components/techpack/BulkEditTable";
import SmartExcelImport from "../components/techpack/SmartExcelImport";
import SyncDiagnosticDashboard from "../components/techpack/SyncDiagnosticDashboard";
import TechPackSummaryView from "../components/techpack/TechPackSummaryView";
import * as XLSX from "xlsx";

const STEPS = ["Upload", "Extracting", "Review & Edit", "Saved"];

// ─── LLM prompt & schema (unchanged) ──────────────────────────────────────
const LLM_PROMPT = (extraContext = "") => `You are a textile/garment manufacturing tech pack data extraction specialist. Extract ALL structured data from this document and return it as a single JSON object.

${extraContext ? `=== RAW EXCEL CONTENT (ALL SHEETS) ===
${extraContext}
=== END OF EXCEL CONTENT ===

IMPORTANT: The above text is pipe-delimited (column1 | column2 | column3). Each line is one row. Sheet names appear as "=== SHEET: <name> ===". Parse every sheet carefully.` : ""}

## EXTRACTION RULES

### ARTICLE INFO
Search every section/sheet for:
- article_name: product name, article name, product type, style name, or any prominent title
- article_code: SKU / item code / style number / ref no — alphanumeric with dashes e.g. "FT2-TW-WH"
- size_label: size, size label — e.g. Twin, Queen, King, S, M, L
- color: color, colour, colorway
- order_quantity: order qty, quantity, pcs, units
- customer_name: brand, buyer, customer
- If article_name is missing, derive from product type + size_label

### FABRIC SPECS / COMPONENTS
Look for a "Fabric specs", "Fabric", "BOM", "Consumption", or "Materials" section/table.
The columns may be: Component, Fabric, GSM, Color, Construction, Finish — OR — component_type, fabric_type, gsm, width, composition, etc.
For EACH fabric row extract:
- component_type: "Component" column value — e.g. "Platform only", "Skirt only", "Body", "Flat Sheet", "Fitted Sheet", "Pillow Case", "This is inside bound seam — all inside seams"
- fabric_type: "Fabric" column — full description e.g. "100% Tencel jersey knitted fabric in white", "70gsm — 100% Polyester interlock knitted fabric in white"
- composition: extract fiber content from fabric description e.g. "100% Tencel", "100% Polyester", "100% Cotton"
- gsm: numeric GSM value from "GSM" column — e.g. 113, 70
- color: "Color" column value — e.g. "White", "—" (use null if dash)
- construction: "Construction" column value — e.g. "32S - A100", "75DFTY", "190T" — map to width field
- finish: "Finish" column — full finish description e.g. "0.02mmTPU PU Coating(DingZing) in White Color B) SILVADUR (TM) 930 Antimicrobial - PRN 98-10" — store in notes field
- consumption_per_unit: if present; default 0 if not found
- wastage_percent: if present; default 0 if not found
- product_size: product dimensions if present
- direction: knitting direction if present

### LABELS SECTION
Look for a "Labels" section/table with columns: Section, Type, Material, Size, Color, Placement.
For EACH label row extract as an accessory with category "Label":
- item_description: combine "Section" + "Type" — e.g. "SATIN PRINTED LABEL — Satin woven label with printed artwork"
- size_spec: "Size" column — e.g. "60x133mm (6x13.3cm) (full length)", "4.0cmX6.0cm", "50x80mm (5x8cm)"
- color: "Color" column — e.g. "Label white ground with printed color fonts"
- notes: "Placement" column — full placement instructions
- material: "Material" column — e.g. "100% polyester satin woven fabric", "3M non woven material with white ground"
- quantity_per_piece: 1 (default for labels)
- unit: "Pcs"
ALSO add each label to packaging.labels[] array with type, description, size_cm, material, color, placement fields.

### ACCESSORIES / TRIMS SECTION
Look for "Accessories", "Trims", "BOM" sections. Extract every row and classify:
- Zipper/zip → "Zipper"
- Slider → "Slider"
- Elastic/tape → "Elastic"
- Button/snap → "Button"
- Cord/dori/drawstring → "Dori"
- Thread/sewing thread → "Stitching Thread"
- Label (care/brand/woven/wash/size/law tag/hang tag) → "Label"
- Polybag/poly bag → "Polybag"
- Stiffener/board/insert board → "Stiffener"
- Carton/box → "Carton"
- Sticker/barcode/UPC → "Sticker"
- Insert card/inlay card → "Insert Card"
- Anything else → "Accessory"

### PACKAGING
- Labels array: all label rows with type, description, size_cm, material, color, placement
- Polybag: type, size_cm, thickness_microns, printed
- Stiffener: used, material, size_cm
- Insert Card: used, description, size_cm
- Carton: type, quality, size_cm, pieces_per_carton, cbm_per_carton
- Stickers: array of sticker rows

### CRITICAL RULES
1. NEVER return empty article fields — search every section for article name and code
2. wastage values between 0 and 1 (e.g. 0.1) → multiply by 100 to get percent
3. Extract ALL rows from every table — do not skip rows
4. For "—" or empty cells use null, not empty string
5. The "Construction" column in fabric specs maps to the width/construction field
6. Capture the full "Finish" text as a notes field on fabric components
7. Extract label placement instructions fully into the notes/placement field

Return ONLY valid JSON (no markdown, no extra text):
{
  "article": {
    "article_name": "string — required, never empty",
    "article_code": "string",
    "size_label": "string",
    "color": "string",
    "description": "string",
    "order_quantity": null,
    "customer_name": "string"
  },
  "fabric_components": [
    {
      "component_type": "string — e.g. Platform only, Skirt only",
      "product_size": "string or null",
      "direction": "string or null",
      "fabric_type": "string — full fabric description",
      "composition": "string — fiber content e.g. 100% Tencel",
      "gsm": 0,
      "width": 0,
      "construction": "string — e.g. 32S-A100, 75DFTY",
      "finish": "string — full finish/coating description or null",
      "consumption_per_unit": 0,
      "wastage_percent": 0,
      "notes": "string or null"
    }
  ],
  "stitching": [],
  "accessories": [
    {
      "category": "string",
      "item_description": "string — full description",
      "color": "string or null",
      "size_spec": "string or null",
      "material": "string or null",
      "placement": "string or null",
      "quantity_per_piece": null,
      "unit": "Pcs"
    }
  ],
  "packaging": {
    "labels": [
      {
        "label_type": "string — e.g. Brand Label, Care Label, Law Tag",
        "section": "string",
        "type": "string",
        "description": "string",
        "material": "string",
        "size_cm": "string",
        "color": "string",
        "placement": "string"
      }
    ],
    "polybag": null,
    "stiffener": null,
    "insert_card": null,
    "carton": null,
    "stickers": []
  }
}`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    article: {
      type: "object",
      properties: {
        article_name: { type: "string" },
        article_code: { type: "string" },
        size_label: { type: "string" },
        color: { type: "string" },
        description: { type: "string" },
        order_quantity: { type: "number" },
        customer_name: { type: "string" },
      },
    },
    fabric_components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          component_type: { type: "string" },
          product_size: { type: "string" },
          direction: { type: "string" },
          fabric_type: { type: "string" },
          composition: { type: "string" },
          gsm: { type: "number" },
          width: { type: "number" },
          construction: { type: "string" },
          finish: { type: "string" },
          consumption_per_unit: { type: "number" },
          wastage_percent: { type: "number" },
          notes: { type: "string" },
        },
      },
    },
    stitching: { type: "array" },
    accessories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          item_description: { type: "string" },
          color: { type: "string" },
          size_spec: { type: "string" },
          material: { type: "string" },
          placement: { type: "string" },
          quantity_per_piece: { type: "number" },
          unit: { type: "string" },
        },
      },
    },
    packaging: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label_type: { type: "string" },
              section: { type: "string" },
              type: { type: "string" },
              description: { type: "string" },
              material: { type: "string" },
              size_cm: { type: "string" },
              color: { type: "string" },
              placement: { type: "string" },
            },
          },
        },
        polybag: { type: "object" },
        stiffener: { type: "object" },
        insert_card: { type: "object" },
        carton: { type: "object" },
        stickers: { type: "array" },
      },
    },
  },
};

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

const normalizeExtracted = (result) => {
  if (result?.fabric_components?.length) {
    result.fabric_components = result.fabric_components.map(fc => ({
      ...fc,
      wastage_percent: (fc.wastage_percent != null && fc.wastage_percent > 0 && fc.wastage_percent < 1)
        ? +(fc.wastage_percent * 100).toFixed(1)
        : fc.wastage_percent,
    }));
  }
  if (result?.article && !result.article.article_name) {
    const parts = [result.article.description, result.article.size_label].filter(Boolean);
    if (parts.length) result.article.article_name = parts.join(" ");
  }
  return result;
};

// ─── File status badge ─────────────────────────────────────────────────────
function FileBadge({ status, count }) {
  const map = {
    pending:    { label: "Pending",    cls: "bg-gray-100 text-gray-600" },
    extracting: { label: "Extracting…", cls: "bg-blue-100 text-blue-700 animate-pulse" },
    done:       { label: "Done",       cls: "bg-green-100 text-green-700" },
    error:      { label: "Error",      cls: "bg-red-100 text-red-600" },
  };
  const s = map[status] || map.pending;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{count != null ? `${count} files` : s.label}</span>;
}

export default function TechPack() {
  const [mainTab, setMainTab] = useState("list");

  // Multi-file queue: [{ id, file, status, extractedData, fileUrl, rawText, error, packingType }]
  const [fileQueue, setFileQueue] = useState([]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [step, setStep] = useState(0); // 0=upload 1=extracting 2=review 3=saved
  const [selectedPoId, setSelectedPoId] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [isNewVersion, setIsNewVersion] = useState(false);
  const [reviewTab, setReviewTab] = useState("summary");
  const [packingType, setPackingType] = useState("Sheet Pack");
  // For single-file backward compat (editing existing)
  const [singleExtracted, setSingleExtracted] = useState(null);
  const [singleFileUrl, setSingleFileUrl] = useState(null);
  const [singleRawText, setSingleRawText] = useState(null);
  const [extractionWarning, setExtractionWarning] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: pos = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date"),
  });

  // Whether we're in "editing existing record" mode (single file, no queue)
  const isEditMode = !!editingRecord;

  // Active file in queue
  const activeFile = fileQueue[activeFileIdx];

  // ─── Add files to queue ──────────────────────────────────────────────────
  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems = files.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      status: "pending",
      extractedData: null,
      fileUrl: null,
      rawText: null,
      error: null,
      packingType: packingType,
    }));
    setFileQueue(prev => {
      const updated = [...prev, ...newItems];
      // Auto-select first new file if nothing was selected
      if (prev.length === 0) setActiveFileIdx(0);
      return updated;
    });
    setGlobalError(null);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const newItems = files.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      status: "pending",
      extractedData: null,
      fileUrl: null,
      rawText: null,
      error: null,
      packingType: packingType,
    }));
    setFileQueue(prev => [...prev, ...newItems]);
  };

  const removeFile = (idx) => {
    setFileQueue(prev => prev.filter((_, i) => i !== idx));
    setActiveFileIdx(prev => Math.max(0, prev > idx ? prev - 1 : prev));
  };

  const updateQueueItem = (idx, patch) => {
    setFileQueue(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  // ─── Extract a single file from queue ───────────────────────────────────
  const extractFile = async (idx) => {
    const item = fileQueue[idx];
    if (!item) return;
    updateQueueItem(idx, { status: "extracting", error: null });

    try {
      let result;
      let uploadedUrl = null;
      let rawText = null;

      if (isExcel(item.file)) {
        let excelText = "";
        try {
          excelText = await parseExcelToText(item.file);
          rawText = excelText;
        } catch {
          rawText = "(parse error)";
        }

        if (excelText && excelText.length > 100) {
          const truncated = excelText.length > 60000 ? excelText.slice(0, 60000) + "\n...[truncated]" : excelText;
          result = await base44.integrations.Core.InvokeLLM({
            prompt: LLM_PROMPT(truncated),
            response_json_schema: RESPONSE_SCHEMA,
            model: "claude_sonnet_4_6",
          });
        } else {
          const uploaded = await base44.integrations.Core.UploadFile({ file: item.file });
          uploadedUrl = uploaded.file_url;
          result = await base44.integrations.Core.InvokeLLM({
            prompt: LLM_PROMPT(),
            file_urls: [uploadedUrl],
            response_json_schema: RESPONSE_SCHEMA,
            model: "claude_sonnet_4_6",
          });
        }
      } else {
        const uploaded = await base44.integrations.Core.UploadFile({ file: item.file });
        uploadedUrl = uploaded.file_url;
        result = await base44.integrations.Core.InvokeLLM({
          prompt: LLM_PROMPT(),
          file_urls: [uploadedUrl],
          response_json_schema: RESPONSE_SCHEMA,
          model: "claude_sonnet_4_6",
        });
      }

      result = normalizeExtracted(result);
      updateQueueItem(idx, { status: "done", extractedData: result, fileUrl: uploadedUrl, rawText });
    } catch (err) {
      updateQueueItem(idx, { status: "error", error: err.message });
    }
  };

  // ─── Extract ALL pending files sequentially ──────────────────────────────
  const handleExtractAll = async () => {
    setStep(1);
    setGlobalError(null);
    const pendingIndices = fileQueue.map((f, i) => f.status === "pending" ? i : -1).filter(i => i >= 0);
    for (const idx of pendingIndices) {
      await extractFile(idx);
    }
    // After all done, go to review of the first file
    setActiveFileIdx(0);
    setStep(2);
  };

  // ─── Extract only the active file ───────────────────────────────────────
  const handleExtractActive = async () => {
    if (!activeFile) return;
    setStep(1);
    await extractFile(activeFileIdx);
    setStep(2);
  };

  const handleManualEntry = () => {
    if (isEditMode) {
      setSingleExtracted({ article: {}, fabric_components: [], stitching: [], accessories: [], packaging: {} });
    } else {
      updateQueueItem(activeFileIdx, {
        status: "done",
        extractedData: { article: {}, fabric_components: [], stitching: [], accessories: [], packaging: {} },
      });
    }
    setStep(2);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["articles"] });
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    queryClient.invalidateQueries({ queryKey: ["techPackRecords"] });

    if (!isEditMode && fileQueue.length > 1) {
      // Move to next file that isn't saved yet
      const nextIdx = fileQueue.findIndex((f, i) => i > activeFileIdx && f.status === "done");
      if (nextIdx >= 0) {
        setActiveFileIdx(nextIdx);
        setReviewTab("summary");
        // Stay on step 2
      } else {
        setStep(3);
      }
    } else {
      setStep(3);
    }
  };

  const handleReset = () => {
    setStep(0);
    setFileQueue([]);
    setActiveFileIdx(0);
    setSingleExtracted(null);
    setSingleFileUrl(null);
    setSingleRawText(null);
    setExtractedData(null);
    setGlobalError(null);
    setExtractionWarning(null);
    setSelectedPoId("");
    setEditingRecord(null);
    setIsNewVersion(false);
    setReviewTab("bulk");
  };

  // Prevent stale setExtractedData — proxy to either queue or single
  const setExtractedData = (data) => {
    if (isEditMode) {
      setSingleExtracted(data);
    } else {
      updateQueueItem(activeFileIdx, { extractedData: data });
    }
  };

  const handleStartNew = () => { handleReset(); setMainTab("process"); };

  const handleEditRecord = (record, isRepeat = false, isVersion = false) => {
    setEditingRecord(record);
    setIsNewVersion(isVersion);
    const data = record.extracted_data || {};
    const ed = {
      article: isRepeat ? { ...data.article, order_quantity: null } : (data.article || {}),
      fabric_components: data.fabric_components || [],
      stitching: data.stitching || [],
      accessories: data.accessories || [],
      packaging: data.packaging || {},
    };
    setSingleExtracted(ed);
    setSingleFileUrl(record.file_url || null);
    setPackingType(record.packaging_type || "Sheet Pack");
    if (isRepeat) setExtractionWarning("Repeat order — all fields pre-filled. Update quantities and link to new PO before saving.");
    else if (isVersion) setExtractionWarning("New version — upload a new file to re-extract, or edit directly and save.");
    setSelectedPoId(record.po_id || "");
    setMainTab("process");
    setStep(2);
  };

  // Resolve current extracted data (edit mode vs queue)
  const currentExtracted = isEditMode ? singleExtracted : activeFile?.extractedData;
  const currentFileUrl   = isEditMode ? singleFileUrl  : activeFile?.fileUrl;
  const currentRawText   = isEditMode ? singleRawText  : activeFile?.rawText;
  const currentFileName  = isEditMode
    ? (editingRecord?.file_name || "")
    : (activeFile?.file?.name || "");

  const pendingCount   = fileQueue.filter(f => f.status === "pending").length;
  const extractingCount = fileQueue.filter(f => f.status === "extracting").length;
  const doneCount      = fileQueue.filter(f => f.status === "done").length;
  const errorCount     = fileQueue.filter(f => f.status === "error").length;

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
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {[
          { key: "list",        icon: <List className="h-4 w-4" />,            label: "Saved Tech Packs" },
          { key: "process",     icon: <FileScan className="h-4 w-4" />,         label: "AI Extract (PDF/Excel)" },
          { key: "import",      icon: <FileSpreadsheet className="h-4 w-4" />,  label: "Structured Excel Import" },
          { key: "diagnostics", icon: <CheckCircle className="h-4 w-4" />,      label: "Sync Diagnostics" },
        ].map(t => (
          <button key={t.key}
            onClick={() => { if (t.key !== "process") setMainTab(t.key); else { handleReset(); setMainTab("process"); } }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              mainTab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Saved Tech Packs ─────────────────────────────────────────── */}
      {mainTab === "list" && <TechPackList onEdit={handleEditRecord} onNew={handleStartNew} />}

      {/* ── Structured Excel Import ──────────────────────────────────── */}
      {mainTab === "import" && (
        <SmartExcelImport
          pos={pos}
          selectedPoId={selectedPoId}
          onSaved={() => {
            ["techPackRecords","articles","fabricTemplates","priceLists","articlePackaging",
             "accessoryItems","poItems","purchaseOrders"].forEach(k =>
              queryClient.invalidateQueries({ queryKey: [k] })
            );
          }}
          onClose={() => {
            ["techPackRecords","articles","fabricTemplates","priceLists","articlePackaging",
             "accessoryItems","poItems","purchaseOrders"].forEach(k =>
              queryClient.invalidateQueries({ queryKey: [k] })
            );
            setMainTab("list");
          }}
        />
      )}

      {/* ── Sync Diagnostics ─────────────────────────────────────────── */}
      {mainTab === "diagnostics" && <SyncDiagnosticDashboard />}

      {/* ── AI Extract Process ───────────────────────────────────────── */}
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

          {/* ── Step 0: Upload ────────────────────────────────────────── */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Upload Tech Pack(s)
                  <span className="text-xs font-normal text-gray-400 ml-1">— select one or many files at once</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700">Click to upload or drag & drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, Excel (.xlsx / .xls), or Image (JPG, PNG) — <b>multiple files supported</b></p>
                  <p className="text-[10px] text-gray-400 mt-1">Large files (up to 50MB each) are supported</p>
                  <input ref={fileInputRef} type="file" multiple
                    accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
                    className="hidden" onChange={handleFilesChange} />
                </div>

                {/* File queue list */}
                {fileQueue.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-medium px-1">
                      <span>{fileQueue.length} file{fileQueue.length > 1 ? "s" : ""} queued</span>
                      <div className="flex gap-2">
                        {doneCount > 0 && <FileBadge status="done" count={doneCount} />}
                        {errorCount > 0 && <FileBadge status="error" count={errorCount} />}
                      </div>
                    </div>
                    {fileQueue.map((item, idx) => (
                      <div key={item.id}
                        onClick={() => setActiveFileIdx(idx)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 border cursor-pointer transition-all ${
                          idx === activeFileIdx
                            ? "border-primary bg-blue-50"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}>
                        {isExcel(item.file)
                          ? <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                          : <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{item.file.name}</p>
                          <p className="text-[10px] text-gray-400">{(item.file.size / 1024).toFixed(0)} KB · {isExcel(item.file) ? "Excel" : item.file.name.endsWith(".pdf") ? "PDF" : "Image"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Per-file pack type selector */}
                          <select
                            className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none"
                            value={item.packingType}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); updateQueueItem(idx, { packingType: e.target.value }); }}>
                            {["Sheet Pack", "Roll Pack", "Box Pack"].map(pt => <option key={pt} value={pt}>{pt}</option>)}
                          </select>
                          <FileBadge status={item.status} />
                          {item.status === "done" && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                          {item.status === "error" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" title={item.error} />}
                          <button onClick={e => { e.stopPropagation(); removeFile(idx); }}
                            className="text-gray-300 hover:text-red-400 ml-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PO + pack type defaults */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Default Packaging Type</label>
                    <div className="flex rounded-lg overflow-hidden border border-gray-300">
                      {["Sheet Pack", "Roll Pack", "Box Pack"].map(pt => (
                        <button key={pt} type="button" onClick={() => {
                          setPackingType(pt);
                          // Apply to all pending files
                          setFileQueue(prev => prev.map(f => f.status === "pending" ? { ...f, packingType: pt } : f));
                        }}
                          className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${
                            packingType === pt
                              ? pt === "Sheet Pack" ? "bg-blue-700 text-white"
                                : pt === "Roll Pack" ? "bg-green-700 text-white"
                                : "bg-orange-700 text-white"
                              : "bg-white text-gray-500 hover:bg-gray-50"
                          }`}>
                          {pt}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Applied to all pending files · can override per file above</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Link to Purchase Order (optional)</label>
                    <select
                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={selectedPoId}
                      onChange={e => setSelectedPoId(e.target.value)}>
                      <option value="">— Select PO —</option>
                      {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>)}
                    </select>
                  </div>
                </div>

                {globalError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                    {globalError}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {fileQueue.length > 1 && pendingCount > 0 && (
                    <Button onClick={handleExtractAll} className="gap-2 flex-1">
                      <Upload className="h-4 w-4" />
                      Extract All ({pendingCount} file{pendingCount > 1 ? "s" : ""})
                    </Button>
                  )}
                  {fileQueue.length === 1 && (
                    <Button onClick={handleExtractActive} disabled={!activeFile} className="gap-2 flex-1">
                      <Upload className="h-4 w-4" /> Extract Data from Tech Pack
                    </Button>
                  )}
                  {fileQueue.length > 1 && activeFile?.status === "pending" && (
                    <Button variant="outline" onClick={handleExtractActive} className="gap-2">
                      <ChevronRight className="h-4 w-4" /> Extract Selected Only
                    </Button>
                  )}
                  {fileQueue.length === 0 && (
                    <Button disabled className="gap-2 flex-1 opacity-50">
                      <Upload className="h-4 w-4" /> Select files above to continue
                    </Button>
                  )}
                  {doneCount > 0 && (
                    <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                      <Eye className="h-4 w-4" /> Review Extracted ({doneCount})
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleManualEntry} className="text-gray-500">
                    Enter Manually
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 1: Extracting ────────────────────────────────────── */}
          {step === 1 && (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                <p className="text-base font-semibold text-gray-800">
                  Extracting Tech Pack Data{fileQueue.length > 1 ? ` (${extractingCount + doneCount}/${fileQueue.length})` : ""}…
                </p>
                <p className="text-sm text-gray-500">AI is reading the document and mapping all fields.</p>
                <p className="text-xs text-gray-400">15–60 seconds per file depending on size and complexity.</p>
                {fileQueue.length > 1 && (
                  <div className="max-w-sm mx-auto space-y-1 mt-2">
                    {fileQueue.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs text-left">
                        <FileBadge status={item.status} />
                        <span className="truncate text-gray-600">{item.file.name}</span>
                        {item.error && <span className="text-red-500 text-[10px]">{item.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Review ────────────────────────────────────────── */}
          {step === 2 && currentExtracted && (
            <div className="space-y-3">
              {/* Multi-file navigator */}
              {!isEditMode && fileQueue.length > 1 && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 overflow-x-auto">
                  <span className="text-xs text-gray-500 font-medium flex-shrink-0">Files:</span>
                  {fileQueue.map((item, idx) => (
                    <button key={item.id} onClick={() => setActiveFileIdx(idx)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border flex-shrink-0 transition-all ${
                        idx === activeFileIdx
                          ? "border-primary bg-primary text-white font-semibold"
                          : item.status === "done" ? "border-green-300 bg-green-50 text-green-700"
                          : item.status === "error" ? "border-red-300 bg-red-50 text-red-600"
                          : "border-gray-200 text-gray-500"
                      }`}>
                      {item.file.name.length > 20 ? item.file.name.slice(0, 18) + "…" : item.file.name}
                      {item.status === "done" && idx !== activeFileIdx && <CheckCircle className="h-3 w-3" />}
                      {item.status === "error" && <AlertTriangle className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Extraction warning */}
              {extractionWarning && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{extractionWarning}
                </div>
              )}

              {/* Sub-tabs */}
              <div className="flex border-b border-gray-200 bg-white rounded-t-lg overflow-hidden overflow-x-auto">
                {[
                  { key: "summary", icon: <Eye className="h-3.5 w-3.5" />,         label: "Tech Pack Summary" },
                  { key: "bulk",    icon: <Table2 className="h-3.5 w-3.5" />,      label: "Bulk Edit & Validate" },
                  { key: "extract", icon: <FileText className="h-3.5 w-3.5" />,    label: "Extraction Detail" },
                  { key: "review",  icon: <CheckCircle className="h-3.5 w-3.5" />, label: "Full Review & Save" },
                  ...(currentRawText ? [{ key: "debug", icon: <span>🔍</span>, label: "Raw Debug" }] : []),
                ].map(t => (
                  <button key={t.key} onClick={() => setReviewTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                      reviewTab === t.key
                        ? t.key === "debug" ? "border-amber-500 text-amber-700 bg-amber-50/40" : "border-primary text-primary bg-blue-50/40"
                        : t.key === "debug" ? "border-transparent text-amber-500 hover:text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {reviewTab === "summary" && (
                <TechPackSummaryView extractedData={currentExtracted} />
              )}
              {reviewTab === "bulk" && (
                <BulkEditTable extractedData={currentExtracted} onChange={setExtractedData} />
              )}
              {reviewTab === "extract" && (
                <ExtractionSummaryTable extractedData={currentExtracted} />
              )}
              {reviewTab === "review" && (
                <TechPackReview
                  extractedData={currentExtracted}
                  selectedPoId={selectedPoId}
                  pos={pos}
                  onSaved={handleSaved}
                  onBack={() => { setStep(0); setEditingRecord(null); }}
                  warning={extractionWarning}
                  fileName={currentFileName}
                  fileUrl={currentFileUrl || editingRecord?.file_url || ""}
                  existingRecordId={editingRecord?.id || null}
                  existingVersion={editingRecord?.version || 1}
                  initialPackingType={isEditMode ? (editingRecord?.packaging_type || packingType) : (activeFile?.packingType || packingType)}
                />
              )}
              {reviewTab === "debug" && currentRawText && (
                <ExtractionDebugView rawText={currentRawText} />
              )}
            </div>
          )}

          {/* ── Step 3: Saved ─────────────────────────────────────────── */}
          {step === 3 && (
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <CheckCircle className="h-14 w-14 mx-auto text-green-500" />
                <p className="text-lg font-bold text-gray-800">Tech Pack Saved Successfully!</p>
                <p className="text-sm text-gray-500">All data has been saved to the Tech Pack library.</p>
                <div className="flex gap-3 justify-center pt-2">
                  <Button onClick={handleReset} variant="outline">Process Another</Button>
                  <Button onClick={() => { handleReset(); setMainTab("list"); }}>View Saved Tech Packs</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}