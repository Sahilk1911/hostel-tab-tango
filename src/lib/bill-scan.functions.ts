import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const scanBillFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      image: z
        .string()
        .max(8_000_000, "Photo is too large")
        .regex(/^data:image\/(jpeg|png|webp);base64,/, "Use a JPG, PNG or WebP photo"),
    }),
  )
  .handler(async ({ data }) => {
    const { scanBill } = await import("./bill-scan.server");
    return scanBill(data.image);
  });
