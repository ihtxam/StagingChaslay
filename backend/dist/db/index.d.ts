import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
type Database = NodePgDatabase<typeof schema>;
export declare function getDb(): Database;
export type { Database };
export { schema };
export type { CmsBlock, CmsOpenPageData, CmsOpenPageConfig, CmsPuckData, CmsTheme, ReservationSettings, ReservationStatus, VacationSettings, VacationPeriod, MerchantSmtpSettings, MerchantBrevoSettings, MarketingSettings, ReportEmailSettings, OfferRules, OfferType, } from "./schema";
//# sourceMappingURL=index.d.ts.map