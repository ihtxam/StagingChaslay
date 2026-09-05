import { Router, Request, Response } from "express";
import { eq, and, asc } from "drizzle-orm";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { getDb, schema } from "@/db";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

function normalizeZipRuleInput(body: Record<string, unknown>) {
  const zipCode = body.zipCode != null ? String(body.zipCode).trim() : "";
  const city = body.city != null ? String(body.city).trim() : "";
  if (!zipCode) {
    throw new Error("Postal code is required");
  }
  const name = city ? `${city} (${zipCode})` : zipCode;
  return {
    name,
    city: city || null,
    zipCode,
    zipFrom: null,
    zipTo: null,
  };
}

/**
 * GET /api/delivery-zip-rules
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rules = await db.query.deliveryZipRules.findMany({
      where: eq(schema.deliveryZipRules.merchantId, req.merchantId!),
      orderBy: [asc(schema.deliveryZipRules.sortOrder)],
    });
    res.json({ success: true, rules });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list ZIP rules" });
  }
});

/**
 * POST /api/delivery-zip-rules
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      minOrderAmount,
      deliveryFee,
      freeDeliveryMinOrder,
      estimatedMinutes,
      isActive,
      sortOrder,
    } = req.body;
    const zip = normalizeZipRuleInput(req.body);

    const db = getDb();
    const [rule] = await db
      .insert(schema.deliveryZipRules)
      .values({
        merchantId: req.merchantId!,
        name: zip.name,
        city: zip.city,
        zipCode: zip.zipCode,
        zipFrom: zip.zipFrom,
        zipTo: zip.zipTo,
        minOrderAmount: String(minOrderAmount ?? 0),
        deliveryFee: String(deliveryFee ?? 0),
        freeDeliveryMinOrder: String(freeDeliveryMinOrder ?? 0),
        estimatedMinutes: estimatedMinutes ?? 45,
        isActive: isActive !== false,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json({ success: true, rule });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create ZIP rule" });
  }
});

/**
 * PUT /api/delivery-zip-rules/:id
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (
      req.body.city !== undefined ||
      req.body.zipCode !== undefined
    ) {
      const zip = normalizeZipRuleInput({
        city: req.body.city,
        zipCode: req.body.zipCode,
      });
      patch.name = zip.name;
      patch.city = zip.city;
      patch.zipCode = zip.zipCode;
      patch.zipFrom = null;
      patch.zipTo = null;
    }
    if (req.body.minOrderAmount !== undefined) patch.minOrderAmount = String(req.body.minOrderAmount);
    if (req.body.deliveryFee !== undefined) patch.deliveryFee = String(req.body.deliveryFee);
    if (req.body.freeDeliveryMinOrder !== undefined) {
      patch.freeDeliveryMinOrder = String(req.body.freeDeliveryMinOrder);
    }
    if (req.body.estimatedMinutes !== undefined) patch.estimatedMinutes = req.body.estimatedMinutes;
    if (req.body.isActive !== undefined) patch.isActive = !!req.body.isActive;
    if (req.body.sortOrder !== undefined) patch.sortOrder = req.body.sortOrder;

    const db = getDb();
    const [rule] = await db
      .update(schema.deliveryZipRules)
      .set(patch)
      .where(
        and(
          eq(schema.deliveryZipRules.id, req.params.id),
          eq(schema.deliveryZipRules.merchantId, req.merchantId!)
        )
      )
      .returning();

    if (!rule) return res.status(404).json({ error: "ZIP rule not found" });
    res.json({ success: true, rule });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update ZIP rule" });
  }
});

/**
 * DELETE /api/delivery-zip-rules/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db
      .delete(schema.deliveryZipRules)
      .where(
        and(
          eq(schema.deliveryZipRules.id, req.params.id),
          eq(schema.deliveryZipRules.merchantId, req.merchantId!)
        )
      );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete ZIP rule" });
  }
});

export default router;
