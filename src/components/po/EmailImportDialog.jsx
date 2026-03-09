import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Loader2, Mail, Sparkles } from "lucide-react";

export default function EmailImportDialog({ open, onOpenChange, onExtracted }) {
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExtract = async () => {
    if (!emailText.trim()) return;
    setLoading(true);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract purchase order details from the following email text. Return only what you can confidently find. For dates, use YYYY-MM-DD format.

Email content:
${emailText}`,
      response_json_schema: {
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
      },
    });

    setLoading(false);
    onExtracted({ ...result, source: "Email" });
    onOpenChange(false);
    setEmailText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Import PO from Email
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste the email content below. AI will extract the purchase order details automatically.
          </p>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExtract} disabled={loading || !emailText.trim()}>
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