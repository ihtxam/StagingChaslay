import { queryRaw, ensureMerchantColumnsSchema } from "@/lib/ensure-merchant-schema";
import {
  createEmptyPizzaTemplate,
  normalizePizzaBuilderSettings,
  normalizePizzaTemplate,
  type PizzaBuilderSettings,
  type PizzaBuilderTemplate,
} from "@/lib/pizza-builder-settings";

type MerchantPizzaRow = { pizza_builder_settings?: unknown };

function isMissingColumn(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return /pizza_builder_settings/i.test(msg) && /does not exist|column/i.test(msg);
}

async function withColumn<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isMissingColumn(error)) throw error;
    await ensureMerchantColumnsSchema();
    return await fn();
  }
}

async function readSettings(merchantId: string): Promise<PizzaBuilderSettings> {
  return withColumn(async () => {
    const rows = await queryRaw<MerchantPizzaRow>(
      `SELECT pizza_builder_settings FROM merchants WHERE id = $1 LIMIT 1`,
      [merchantId]
    );
    if (!rows[0]) throw new Error("Merchant not found");
    return normalizePizzaBuilderSettings(rows[0].pizza_builder_settings);
  });
}

async function writeSettings(merchantId: string, settings: PizzaBuilderSettings): Promise<void> {
  await withColumn(async () => {
    await queryRaw(
      `UPDATE merchants SET pizza_builder_settings = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [merchantId, JSON.stringify(settings)]
    );
  });
}

export class PizzaTemplatesService {
  static async list(merchantId: string): Promise<PizzaBuilderTemplate[]> {
    const settings = await readSettings(merchantId);
    return settings.templates;
  }

  static async get(merchantId: string, templateId: string): Promise<PizzaBuilderTemplate | null> {
    const templates = await this.list(merchantId);
    return templates.find((tpl) => tpl.id === templateId) || null;
  }

  static async create(merchantId: string, raw: unknown): Promise<PizzaBuilderTemplate> {
    const incoming = normalizePizzaTemplate({
      ...createEmptyPizzaTemplate(),
      ...(raw && typeof raw === "object" ? raw : {}),
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });
    if (!incoming.name.trim()) throw new Error("Template name is required");
    incoming.createdAt = new Date().toISOString();
    incoming.updatedAt = incoming.createdAt;
    const settings = await readSettings(merchantId);
    settings.templates.push(incoming);
    await writeSettings(merchantId, settings);
    return incoming;
  }

  static async update(
    merchantId: string,
    templateId: string,
    raw: unknown
  ): Promise<PizzaBuilderTemplate> {
    const settings = await readSettings(merchantId);
    const index = settings.templates.findIndex((tpl) => tpl.id === templateId);
    if (index < 0) throw new Error("Template not found");
    const prev = settings.templates[index];
    const next = normalizePizzaTemplate({
      ...prev,
      ...(raw && typeof raw === "object" ? raw : {}),
      id: prev.id,
      createdAt: prev.createdAt,
    });
    if (!next.name.trim()) throw new Error("Template name is required");
    next.updatedAt = new Date().toISOString();
    settings.templates[index] = next;
    await writeSettings(merchantId, settings);
    return next;
  }

  static async remove(merchantId: string, templateId: string): Promise<void> {
    const settings = await readSettings(merchantId);
    const next = settings.templates.filter((tpl) => tpl.id !== templateId);
    if (next.length === settings.templates.length) throw new Error("Template not found");
    await writeSettings(merchantId, { templates: next });
  }
}
