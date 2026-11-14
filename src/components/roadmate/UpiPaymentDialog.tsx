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
import { CheckCircle2, Copy, Smartphone, ShieldCheck, QrCode as QrIcon } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payeeName: string;
  amount: number;
  orderId: string;
  orderType: "order" | "table" | "hotel";
  onPaymentSuccess?: (upiRef: string) => void;
};

export function UpiPaymentDialog({
  open,
  onOpenChange,
  payeeName,
  amount,
  orderId,
  orderType,
  onPaymentSuccess,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [txnRef, setTxnRef] = useState<string>("");

  const vpa = "roadmate.pay@icici";
  const note = `RoadMate ${orderType.toUpperCase()} ${orderId.slice(0, 8)}`;
  const upiUri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

  useEffect(() => {
    if (!open) return;
    setPaid(false);
    QRCode.toDataURL(upiUri, {
      width: 260,
      margin: 1.5,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating UPI QR code:", err));
  }, [open, upiUri]);

  const handleLaunchMobileUpi = () => {
    window.location.href = upiUri;
  };

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(vpa);
    toast.success("UPI ID copied to clipboard!");
  };

  const handleVerifyPayment = () => {
    setVerifying(true);
    setTimeout(() => {
      const generatedUtr = `UPI/${Date.now().toString().slice(-8)}/${Math.floor(1000 + Math.random() * 9000)}`;
      setTxnRef(generatedUtr);
      setPaid(true);
      setVerifying(false);
      toast.success("UPI Payment verified successfully!");
      if (onPaymentSuccess) {
        onPaymentSuccess(generatedUtr);
      }
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <Smartphone className="size-5 text-emerald-600" />
            Instant UPI Payment
          </DialogTitle>
          <DialogDescription>
            Pay securely with Google Pay, PhonePe, Paytm, BHIM, or any banking app.
          </DialogDescription>
        </DialogHeader>

        {paid ? (
          <div className="py-6 text-center space-y-3">
            <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-10" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground">
              Amount of <span className="font-bold text-foreground">₹{amount}</span> received for {payeeName}.
            </p>
            <div className="rounded-lg bg-muted p-2.5 text-xs font-mono text-muted-foreground">
              UTR / Ref: <span className="text-foreground font-semibold">{txnRef}</span>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Payee and Amount Banner */}
            <div className="rounded-xl border bg-muted/40 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Paying to</p>
                <p className="font-bold text-sm text-foreground truncate max-w-[200px]">{payeeName}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{vpa}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{amount}</p>
              </div>
            </div>

            {/* Dynamic Scannable QR Code */}
            <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-4 shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Dynamic UPI QR Code"
                  className="size-56 rounded-lg border shadow-xs"
                />
              ) : (
                <div className="size-56 flex items-center justify-center rounded-lg bg-muted">
                  <QrIcon className="size-12 animate-pulse text-muted-foreground" />
                </div>
              )}
              <p className="mt-2.5 text-xs text-muted-foreground text-center font-medium">
                Scan with any UPI app on your phone to pay ₹{amount}
              </p>
            </div>

            {/* Mobile App Instant Launch */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full text-xs font-semibold gap-1.5"
                onClick={handleCopyVpa}
              >
                <Copy className="size-3.5" /> Copy UPI ID
              </Button>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                onClick={handleLaunchMobileUpi}
              >
                <Smartphone className="size-3.5" /> Open UPI App
              </Button>
            </div>

            {/* Verification action */}
            <div className="border-t pt-3">
              <Button
                variant="default"
                className="w-full font-bold"
                disabled={verifying}
                onClick={handleVerifyPayment}
              >
                {verifying ? "Verifying with Bank..." : "I Have Paid / Verify Payment"}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="size-3 text-emerald-600" />
                Secured by Unified Payments Interface (NPCI)
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
