import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createGlideServer } from "../packages/mcp-server/src/server.js";
import { Client } from "../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { InMemoryTransport } from "../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js";

describe("mcp-server stdio", () => {
  async function createClient(server = createGlideServer()) {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "test", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    return { client, server, close: async () => {
      await client.close();
      await server.close();
    }};
  }

  it("responds to initialize and lists tools", async () => {
    const { client, close } = await createClient();

    const init = await client.getServerVersion();
    expect(init).toMatchObject({ name: "glide", version: "0.1.0" });

    const listResp = await client.listTools();
    expect(listResp.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "glide_status" }),
      ])
    );

    await close();
  });

  it("calls glide_status", async () => {
    const { client, close } = await createClient();

    const resp = await client.callTool({ name: "glide_status", arguments: {} });
    expect(resp).toMatchObject({
      content: [
        { type: "text", text: expect.stringContaining('"status":"ok"') },
      ],
    });

    await close();
  });

  it("calls glide_goal_set and glide_goal_get", async () => {
    const { client, close } = await createClient();

    const setResp = await client.callTool({
      name: "glide_goal_set",
      arguments: { campaign_dir: "/tmp/glide-test", goal: "build a CLI" },
    });
    expect(setResp).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining('"ok":true') }],
    });

    const getResp = await client.callTool({
      name: "glide_goal_get",
      arguments: { campaign_dir: "/tmp/glide-test" },
    });
    expect(getResp).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"campaign_dir":"/tmp/glide-test"'),
        },
      ],
    });

    await close();
  });

  it("calls glide_executor ensure_contract", async () => {
    const { client, close } = await createClient();

    const resp = await client.callTool({
      name: "glide_executor",
      arguments: {
        action: "ensure_contract",
        workspace: "/tmp/glide-executor-test",
        agent_id: "agent-1",
      },
    });
    expect(resp).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining('"ok":true') }],
    });

    await close();
  });

  it("calls glide_tracer trace", async () => {
    const { client, close } = await createClient();

    await client.callTool({
      name: "glide_executor",
      arguments: {
        action: "ensure_contract",
        workspace: "/tmp/glide-tracer-test",
        agent_id: "agent-1",
      },
    });

    const resp = await client.callTool({
      name: "glide_tracer",
      arguments: {
        action: "trace",
        workspace: "/tmp/glide-tracer-test",
        agent_id: "agent-1",
      },
    });
    expect(resp).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"agent_id":"agent-1"'),
        },
      ],
    });

    await close();
  });
});
