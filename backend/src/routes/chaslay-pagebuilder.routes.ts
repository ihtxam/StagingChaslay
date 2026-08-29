import { Router, Request, Response } from "express";
import {
  verifyToken,
  requireMerchant,
  setMerchantContext,
  requirePermission,
} from "@/middleware/auth.middleware";
import { ChaslayPagebuilderService } from "@/services/chaslay-pagebuilder.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(requirePermission("MANAGE_ONLINE_SHOP"));

router.get("/", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.list(req.merchantId!);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to list" });
  }
});

router.get("/active", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.getActive(req.merchantId!);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to load active" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.get(req.merchantId!, Number(req.params.id));
    res.json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, error: error instanceof Error ? error.message : "Not found" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ success: false, error: "Name is required" });
    const data = await ChaslayPagebuilderService.create(req.merchantId!, {
      name,
      editor_state: req.body.editor_state ?? null,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to create" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.update(req.merchantId!, Number(req.params.id), {
      name: req.body.name,
      editor_state: req.body.editor_state,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to update" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await ChaslayPagebuilderService.remove(req.merchantId!, Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to delete" });
  }
});

router.post("/:id/activate", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.activate(req.merchantId!, Number(req.params.id));
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to activate" });
  }
});

router.post("/:id/deactivate", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.deactivate(req.merchantId!, Number(req.params.id));
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to deactivate" });
  }
});

router.get("/:builderId/pages", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.listPages(req.merchantId!, Number(req.params.builderId));
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to list pages" });
  }
});

router.post("/:builderId/pages", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.createPage(req.merchantId!, Number(req.params.builderId), {
      title: req.body.title,
      slug: req.body.slug,
      editor_state: req.body.editor_state ?? null,
      is_homepage: req.body.is_homepage,
      sort_order: req.body.sort_order,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to create page" });
  }
});

router.put("/:builderId/pages/:pageId", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayPagebuilderService.updatePage(
      req.merchantId!,
      Number(req.params.builderId),
      Number(req.params.pageId),
      {
        title: req.body.title,
        slug: req.body.slug,
        editor_state: req.body.editor_state,
        is_homepage: req.body.is_homepage,
        sort_order: req.body.sort_order,
      }
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to update page" });
  }
});

router.delete("/:builderId/pages/:pageId", async (req: Request, res: Response) => {
  try {
    await ChaslayPagebuilderService.removePage(
      req.merchantId!,
      Number(req.params.builderId),
      Number(req.params.pageId)
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to delete page" });
  }
});

export default router;
