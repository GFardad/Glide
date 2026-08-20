import { customAlphabet, nanoid } from "nanoid";
// Alphabets chosen to avoid problematic characters in filenames/IDs
const AGENT_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_";
const SESSION_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_";
const CAMPAIGN_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const AMENDMENT_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_";
const TRACE_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const agentIdGenerator = customAlphabet(AGENT_ID_ALPHABET, 22);
const sessionIdGenerator = customAlphabet(SESSION_ID_ALPHABET, 22);
const campaignIdGenerator = customAlphabet(CAMPAIGN_ID_ALPHABET, 22);
const amendmentIdGenerator = customAlphabet(AMENDMENT_ID_ALPHABET, 22);
const traceIdGenerator = customAlphabet(TRACE_ID_ALPHABET, 16);
export function generateAgentId() {
    return `agent_${agentIdGenerator()}`;
}
export function generateSessionId() {
    return `session_${sessionIdGenerator()}`;
}
export function generateCampaignId() {
    return `campaign_${campaignIdGenerator()}`;
}
export function generateAmendmentId() {
    return `amendment_${amendmentIdGenerator()}`;
}
export function generateTraceId() {
    return `trace_${traceIdGenerator()}`;
}
export function generateNanoId(size = 21) {
    return nanoid(size);
}
export function isAgentId(value) {
    return /^agent_[A-Za-z0-9_]{22}$/.test(value);
}
export function isSessionId(value) {
    return /^session_[A-Za-z0-9_]{22}$/.test(value);
}
export function isCampaignId(value) {
    return /^campaign_[A-Za-z0-9]{22}$/.test(value);
}
export function isAmendmentId(value) {
    return /^amendment_[A-Za-z0-9_]{22}$/.test(value);
}
export function isTraceId(value) {
    return /^trace_[A-Za-z0-9]{16}$/.test(value);
}
//# sourceMappingURL=id.js.map