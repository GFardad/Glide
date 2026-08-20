import { customAlphabet } from "nanoid";
const AGENT_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SESSION_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
const CAMPAIGN_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const agentIdGenerator = customAlphabet(AGENT_ID_ALPHABET, 22);
const sessionIdGenerator = customAlphabet(SESSION_ID_ALPHABET, 22);
const campaignIdGenerator = customAlphabet(CAMPAIGN_ID_ALPHABET, 22);
export function generateAgentId() {
    return `agent_${agentIdGenerator()}`;
}
export function generateSessionId() {
    return `session_${sessionIdGenerator()}`;
}
export function generateCampaignId() {
    return `campaign_${campaignIdGenerator()}`;
}
export function isAgentId(value) {
    return /^agent_[A-Za-z0-9_-]{22}$/.test(value);
}
export function isSessionId(value) {
    return /^session_[A-Za-z0-9_-]{22}$/.test(value);
}
export function isCampaignId(value) {
    return /^campaign_[A-Za-z0-9]{22}$/.test(value);
}
//# sourceMappingURL=ids.js.map