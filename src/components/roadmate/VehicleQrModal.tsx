import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Share2, Car, Download, Check, Copy } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVehicleNo?: string;
  journeyUrl?: string;
  journeyTitle?: string;
};

export function VehicleQrModal({
  open,
  onOpenChange,
  defaultVehicleNo = "HR 26 DQ 5555",
  journeyUrl,
  journeyTitle = "Chandigarh to Jaipur Highway Road Trip",
}: Props) {
  const [vehicleNo, setVehicleNo] = useState(defaultVehicleNo);
  const [activeTab, setActiveTab] = useState<"vehicle" | "trip">("vehicle");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const currentHost = typeof window !== "undefined" ? window.location.origin : "https://pingme-roadmate.vercel.app";
  const vehicleTagUrl = `${currentHost}/plan?vehicle=${encodeURIComponent(vehicleNo)}`;
  const shareUrl = journeyUrl || `${currentHost}/journeys`;

  const targetUrl = activeTab === "vehicle" ? vehicleTagUrl : shareUrl;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(targetUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: "#052e16",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [open, targetUrl, activeTab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = activeTab === "vehicle" ? `PingME-Tag-${vehicleNo.replace(/\s+/g, "-")}.png` : "RoadMate-Trip-QR.png";
    a.click();
    toast.success("QR code downloaded!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <QrCode className="size-5 text-emerald-600" />
            PingME Vehicle & Journey QR
          </DialogTitle>
          <DialogDescription>
            Scan with any smartphone camera to launch RoadMate or track this trip in real time.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-bold">
          <button
            type="button"
            className={`rounded-md py-1.5 transition ${activeTab === "vehicle" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("vehicle")}
          >
            🚗 Vehicle Tag QR
          </button>
          <button
            type="button"
            className={`rounded-md py-1.5 transition ${activeTab === "trip" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("trip")}
          >
            🗺️ Share Journey QR
          </button>
        </div>

        <div className="space-y-4 pt-2">
          {activeTab === "vehicle" ? (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Vehicle Registration Number
              </label>
              <div className="flex gap-2">
                <Input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  placeholder="e.g. DL 01 AB 1234"
                  className="font-mono font-bold tracking-wider uppercase"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Affix this tag to your car's windshield so you or valet can scan to start RoadMate.
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3 text-xs">
              <p className="font-semibold text-foreground truncate">{journeyTitle}</p>
              <p className="text-muted-foreground mt-0.5">Family & passengers can scan this QR to follow the live route on their phones.</p>
            </div>
          )}

          {/* QR Display */}
          <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-4 shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="PingME QR Tag"
                className="size-56 rounded-lg border shadow-xs"
              />
            ) : (
              <div className="size-56 flex items-center justify-center rounded-lg bg-muted">
                <QrCode className="size-12 animate-pulse text-muted-foreground" />
              </div>
            )}
            <p className="mt-2.5 text-xs text-muted-foreground font-mono text-center truncate max-w-[280px]">
              {targetUrl}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="text-xs font-semibold gap-1.5"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
              onClick={handleDownload}
            >
              <Download className="size-3.5" /> Download QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
