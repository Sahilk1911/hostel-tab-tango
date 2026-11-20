import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch, GATEWAY_URL } from "./ai-gateway.server";

const MODEL = "openai/gpt-6-astra";

const billSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  grandTotal: z.number().nullable(),
  restaurant: z.string().nullable(),
});

export type ScannedBill = {
  title: string | null;
  items: { name: string; price: number }[]; // price in paise (line total)
  total: number | null; // paise
};

export type ScanResult = { ok: true; bill: ScannedBill } | { ok: false; error: string };

const INSTRUCTIONS = `You read photos of Indian bills and receipts (Zomato/Swiggy orders, restaurant bills, grocery bills, electricity bills).
Extract every purchased line item. For each item give a short name, the quantity, and "price" = the LINE TOTAL in rupees for that line (quantity × unit price).
Do NOT include taxes, GST, delivery fees, packaging, platform fees, tips or discounts as items.
grandTotal = the final amount actually paid in rupees (after taxes, fees and discounts), or null if not visible.
restaurant = the shop or restaurant name, or null.
If the image is not a bill, return an empty items list.`;

export async function scanBill(imageDataUrl: string): Promise<ScanResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "Bill scanning isn't set up yet." };

  const gateway = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: gateway.fetch,
  });

  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions: INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the items from this bill." },
            { type: "image", image: new URL(imageDataUrl) },
          ],
        },
      ],
      output: Output.object({ schema: billSchema }),
      maxRetries: 1,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const out = await result.output;
    const items = out.items
      .filter((i) => i.name.trim() && i.price > 0)
      .map((i) => ({
        name: i.quantity > 1 ? `${i.name.trim()} ×${i.quantity}` : i.name.trim(),
        price: Math.round(i.price * 100),
      }));
    if (items.length === 0) {
      return { ok: false, error: "Couldn't find any items on this photo. Try a clearer, straight photo of the bill." };
    }
    return {
      ok: true,
      bill: {
        title: out.restaurant?.trim() || null,
        items,
        total: out.grandTotal && out.grandTotal > 0 ? Math.round(out.grandTotal * 100) : null,
      },
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { ok: false, error: "Couldn't read this bill. Try a clearer photo." };
    }
    const status = APICallError.isInstance(error) ? error.statusCode : undefined;
    console.error("scanBill failed", status, error);
    if (status === 429) return { ok: false, error: "Too many scans right now. Please wait a minute and try again." };
    if (status === 402) return { ok: false, error: "AI credits have run out. Add credits in your workspace to keep scanning bills." };
    if (status === 403) return { ok: false, error: "Bill scanning is blocked for this workspace right now." };
    if (status === 400) return { ok: false, error: "This photo couldn't be processed. Try a JPG or PNG photo." };
    return { ok: false, error: "Bill scanning failed. Please try again in a moment." };
  }
}
