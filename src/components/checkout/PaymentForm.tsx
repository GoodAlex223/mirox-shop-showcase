"use client";

import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentFormProps {
  onSuccess: () => void;
  onBack: () => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export function PaymentForm({
  onSuccess,
  onBack,
  isProcessing,
  setIsProcessing,
  error,
  setError,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Payment validation failed");
        setIsProcessing(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/confirmation`,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message || "Payment failed");
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess();
      } else {
        setError("Payment was not completed. Please try again.");
        setIsProcessing(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        onReady={() => setIsReady(true)}
        options={{
          layout: "tabs",
        }}
      />

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error}</div>
      )}

      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={isProcessing}>
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!stripe || !elements || !isReady || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Payment...
            </>
          ) : (
            "Complete Order"
          )}
        </Button>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Your payment is secured by Stripe. We never store your card details.
      </p>
    </form>
  );
}
