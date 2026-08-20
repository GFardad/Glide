export interface IcmCampaignInput {
    root: string;
    id?: string;
    goal?: string;
    stages?: number[];
}
export interface IcmCampaignResult {
    root: string;
    id: string;
    stages: string[];
    walkTest: {
        orientable: boolean;
        readableStateFiles: string[];
        missing: string[];
        reportPath?: string;
    };
}
export declare function buildIcmCampaign(input: IcmCampaignInput): IcmCampaignResult;
export declare function runWalkTest(root: string): IcmCampaignResult["walkTest"];
//# sourceMappingURL=icm.d.ts.map