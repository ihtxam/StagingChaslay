import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { PizzaTemplatesService } from "@/services/pizza-templates.service";

const router = Router();

router.use(verifyToken, requireMerchant, setMerchantContext);

router.get("/", async (req: Request, res: Response) => {
  try {
    const templates = await PizzaTemplatesService.list(req.merchantId!);
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list pizza templates",
    });
  }
});

router.get("/:templateId", async (req: Request, res: Response) => {
  try {
    const template = await PizzaTemplatesService.get(req.merchantId!, String(req.params.templateId));
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load pizza template",
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const template = await PizzaTemplatesService.create(req.merchantId!, req.body);
    res.status(201).json({ success: true, template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create pizza template";
    res.status(message.includes("required") ? 400 : 500).json({ error: message });
  }
});

router.put("/:templateId", async (req: Request, res: Response) => {
  try {
    const template = await PizzaTemplatesService.update(
      req.merchantId!,
      String(req.params.templateId),
      req.body
    );
    res.json({ success: true, template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update pizza template";
    const code = message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
    res.status(code).json({ error: message });
  }
});

router.delete("/:templateId", async (req: Request, res: Response) => {
  try {
    await PizzaTemplatesService.remove(req.merchantId!, String(req.params.templateId));
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete pizza template";
    res.status(message.includes("not found") ? 404 : 500).json({ error: message });
  }
});

export default router;
