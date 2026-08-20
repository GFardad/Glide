import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export function validateCampaignDirectory(root) {
    const constitution = join(root, "campaigns", "constitution.json");
    if (!existsSync(constitution)) {
        throw new Error("Campaign directory invalid: constitution.json missing");
    }
    try {
        JSON.parse(readFileSync(constitution, "utf8"));
    }
    catch (error) {
        throw new Error(`Campaign directory invalid: constitution.json: ${error.message}`);
    }
}
//# sourceMappingURL=campaign-fs.js.map