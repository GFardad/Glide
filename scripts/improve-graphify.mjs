#!/usr/bin/env node
/**
 * Deep graph engineering for Glide Graphify.
 *
 * Goals:
 * 1) Normalize schema: ensure links expose both `relation` and `type`.
 * 2) Filter noise: drop audit-only/markdown-only nodes that do not help real navigation.
 * 3) Reassign singleton communities to parent clusters by connectivity.
 * 4) Add freshness + quality metadata.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const GRAPH_JSON = join(process.cwd(), 'graphify-out', 'graph.json');
if (!existsSync(GRAPH_JSON)) {
  console.error(`graph.json not found at ${GRAPH_JSON}`);
  process.exit(1);
}

const graph = JSON.parse(readFileSync(GRAPH_JSON, 'utf8'));
const nodes = graph.nodes ?? [];
const links = graph.links ?? [];

const nodeMap = new Map();
for (const node of nodes) {
  nodeMap.set(node.id, node);
}

const auditNoise = new Set([
  'audit',
  'strategy',
  'report',
  'findings',
  'plan',
  'architecture',
  'comparison',
  'line-by-line',
  'file-by-file',
]);

function looksLikeNoise(node) {
  const hay = `${node.label ?? ''} ${node.community_name ?? ''} ${node.source_file ?? ''}`.toLowerCase();
  for (const token of auditNoise) {
    if (hay.includes(token)) return true;
  }
  return false;
}

const filteredNodes = nodes.filter((node) => !looksLikeNoise(node));
const filteredIds = new Set(filteredNodes.map((n) => n.id));

const filteredLinks = links.filter((link) => filteredIds.has(link.source) && filteredIds.has(link.target));

const retainedNodeCount = filteredNodes.length;
const retainedLinkCount = filteredLinks.length;
const droppedNodeCount = nodes.length - retainedNodeCount;
const droppedLinkCount = links.length - retainedLinkCount;

const communityCounts = new Map();
for (const node of filteredNodes) {
  const community = typeof node.community === 'number' ? node.community : null;
  if (community === null || community === undefined) continue;
  communityCounts.set(community, (communityCounts.get(community) ?? 0) + 1);
}

const singletonThreshold = 2;
const singletonCommunities = new Set();
for (const [community, count] of communityCounts) {
  if (count <= singletonThreshold) {
    singletonCommunities.add(community);
  }
}

const adjacency = new Map();
for (const link of filteredLinks) {
  const list = adjacency.get(link.source) ?? [];
  if (!list.includes(link.target)) list.push(link.target);
  adjacency.set(link.source, list);

  if (!graph.directed) {
    const back = adjacency.get(link.target) ?? [];
    if (!back.includes(link.source)) back.push(link.source);
    adjacency.set(link.target, back);
  }
}

for (const node of filteredNodes) {
  if (node.community == null || node.community === undefined) continue;
  if (!singletonCommunities.has(node.community)) continue;

  const neighbors = adjacency.get(node.id) ?? [];
  const neighborCommunities = new Map();
  for (const neighborId of neighbors) {
    const neighbor = nodeMap.get(neighborId);
    if (!neighbor || neighbor.community == null) continue;
    if (singletonCommunities.has(neighbor.community)) continue;
    neighborCommunities.set(neighbor.community, (neighborCommunities.get(neighbor.community) ?? 0) + 1);
  }

  let best = null;
  let bestCount = 0;
  for (const [community, count] of neighborCommunities) {
    if (count > bestCount) {
      bestCount = count;
      best = community;
    }
  }

  node.community = best ?? node.community;
  node.community_name = node.community_name ?? String(node.community);
}

for (const link of filteredLinks) {
  const label = link.relation ?? link.type ?? 'unknown';
  link.type = label;
  if (!link.relation) link.relation = label;
  if (!link.confidence) link.confidence = 'EXTRACTED';
  if (!link.confidence_score && link.confidence === 'EXTRACTED') link.confidence_score = 1;
  if (!link.weight) link.weight = 1;
}

const cleanedGraph = {
  ...graph,
  nodes: filteredNodes,
  links: filteredLinks,
  metadata: {
    generatedAt: new Date().toISOString(),
    commit: getGitCommitSync(),
    noiseFiltered: droppedNodeCount > 0 || droppedLinkCount > 0,
    retainedNodes: retainedNodeCount,
    retainedLinks: retainedLinkCount,
    droppedNodes: droppedNodeCount,
    droppedLinks: droppedLinkCount,
    singletonCommunitiesReassigned: singletonCommunities.size,
    graphQuality: {
      density: Number(((2 * retainedLinkCount) / (retainedNodeCount * (retainedNodeCount - 1) || 1)).toFixed(4)),
      avgCommunitySize: Number((retainedNodeCount / Math.max(communityCounts.size, 1)).toFixed(2)),
    },
  },
};

writeFileSync(GRAPH_JSON, `${JSON.stringify(cleanedGraph, null, 2)}\n`);
console.log(JSON.stringify({
  generatedAt: cleanedGraph.metadata.generatedAt,
  retainedNodes: retainedNodeCount,
  retainedLinks: retainedLinkCount,
  droppedNodes: droppedNodeCount,
  droppedLinks: droppedLinkCount,
  singletonCommunitiesReassigned: singletonCommunities.size,
  graphQuality: cleanedGraph.metadata.graphQuality,
}, null, 2));

function getGitCommitSync() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
