export type CateringTemplateId = "taco_bar" | "boxed_lunch" | "buffet_per_person";
export declare class CateringTemplatesService {
    static apply(merchantId: string, templateId: CateringTemplateId): Promise<{
        templateId: string;
        products: string[];
    }>;
}
//# sourceMappingURL=catering-templates.service.d.ts.map