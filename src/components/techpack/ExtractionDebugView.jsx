import React, { useState } from "react";
import { ChevronDown, ChevronUp, Download, X } from "lucide-react";

/**
 * Shows the raw text extracted from Excel before AI processing.
 * Temporary debug tool to diagnose extraction failures.
 */
export default function ExtractionDebugView({ rawText, onClose }) {
  const [open, setOpen] = useState(false);

  const handleExport = () => {
    const blob = new Blob([rawText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raw_excel_extraction.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-amber-300 rounded-lg bg-amber-50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
      >
        <span>🔍 Raw Excel Text (debug — click to inspect what AI received)</span>
        <div className="flex items-center gap-2">
          <span className="text-amber-600 font-normal">{rawText?.length || 0} chars</span>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      {open && (
        <div className="p-3 border-t border-amber-200">
          <div className="flex justify-end gap-2 mb-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 text-[10px] bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded hover:bg-amber-100"
            >
              <Download className="h-3 w-3" /> Export raw text
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-1 text-[10px] bg-white border border-gray-300 text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
              >
                <X className="h-3 w-3" /> Dismiss
              </button>
            )}
          </div>
          <pre className="w-full max-h-72 overflow-auto text-[10px] font-mono bg-white border border-amber-200 rounded p-3 whitespace-pre-wrap text-gray-700 leading-relaxed">
            {rawText || "(empty)"}
          </pre>
        </div>
      )}
    </div>
  );
}