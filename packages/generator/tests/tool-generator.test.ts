import { createStandardComponentRegistry } from "@surfaceweave/core";
import { describe, expect, it } from "vitest";

import {
  fromAgentToolDefinition,
  fromOpenApiOperation,
  generateToolSurface,
  normalizeToolSchema,
} from "../src/index.js";

describe("Tool Schema adapters and generator", () => {
  it("generates deterministic nested fields, constraints, formats, and defaults", () => {
    const definition = fromAgentToolDefinition({
      name: "order.create",
      version: "2.0.0",
      inputSchema: {
        type: "object",
        required: ["quantity", "delivery"],
        properties: {
          note: { type: ["string", "null"], maxLength: 80 },
          quantity: { type: "integer", default: 1, minimum: 1 },
          delivery: {
            type: "object",
            properties: {
              email: { type: "string", format: "email" },
              requestedAt: {
                type: "string",
                format: "date-time",
                readOnly: true,
              },
            },
          },
          priority: {
            oneOf: [
              { const: "normal", enum: ["normal"] },
              { const: "urgent", enum: ["urgent"] },
            ],
          },
        },
      },
    });
    const input = {
      definition,
      surfaceId: "order-input",
      initialValues: { delivery: {} },
    };
    const first = generateToolSurface(input, createStandardComponentRegistry());
    const second = generateToolSurface(
      input,
      createStandardComponentRegistry(),
    );

    expect(first).toEqual(second);
    expect(first.data.quantity).toBe(1);
    expect(first.schemaRef).toEqual({ id: "order.create", version: "2.0.0" });
    const delivery = first.tree.children?.find(
      (node) => node.stableId === "delivery",
    );
    expect(delivery?.children?.map((node) => node.stableId)).toEqual([
      "delivery.email",
      "delivery.requestedAt",
    ]);
    expect(delivery?.children?.[0]?.props.format).toBe("email");
    expect(delivery?.children?.[1]?.props.readOnly).toBe(true);
    expect(
      first.tree.children?.find((node) => node.stableId === "priority")?.props
        .options,
    ).toEqual(["normal", "urgent"]);
  });

  it("adapts one OpenAPI operation without retaining transport details", () => {
    const definition = fromOpenApiOperation({
      path: "/orders",
      method: "post",
      document: {
        openapi: "3.1.1",
        info: { title: "Tea", version: "2026-08" },
        servers: [{ url: "https://not-retained.example" }],
        paths: {
          "/orders": {
            post: {
              operationId: "order.create",
              parameters: [
                {
                  name: "tenant",
                  in: "header",
                  required: true,
                  schema: { type: "string" },
                },
              ],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["quantity"],
                      properties: { quantity: { type: "integer" } },
                    },
                  },
                },
              },
              responses: {
                "201": {
                  content: {
                    "application/json": { schema: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(definition.id).toBe("order.create");
    expect(JSON.stringify(definition)).not.toContain("not-retained.example");
    expect(definition.inputSchema).toMatchObject({
      required: ["quantity"],
      properties: { quantity: { type: "integer" } },
    });
    expect(JSON.stringify(definition.inputSchema)).not.toContain("tenant");
    const surface = generateToolSurface(
      { definition, surfaceId: "order-form" },
      createStandardComponentRegistry(),
    );
    expect(JSON.stringify(surface.tree)).not.toContain("tenant");
  });

  it("keeps host parameters out of forms and only exposes safe headers by explicit policy", () => {
    const document = {
      openapi: "3.1.1",
      info: { title: "Reports", version: "1.0.0" },
      paths: {
        "/reports": {
          get: {
            operationId: "reports.list",
            parameters: [
              {
                name: "scope",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "X-Tenant-Id",
                in: "header",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "X-Report-Format",
                in: "header",
                schema: { type: "string", enum: ["summary", "detailed"] },
              },
              {
                name: "Authorization",
                in: "header",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };

    const definition = fromOpenApiOperation({
      document,
      path: "/reports",
      method: "get",
      parameterSources: { "header:X-Report-Format": "user" },
    });

    expect(definition.inputSchema).toMatchObject({
      required: ["scope"],
      properties: {
        scope: { type: "string" },
        "X-Report-Format": {
          type: "string",
          enum: ["summary", "detailed"],
        },
      },
    });
    expect(JSON.stringify(definition.inputSchema)).not.toContain("X-Tenant-Id");
    expect(JSON.stringify(definition.inputSchema)).not.toContain(
      "Authorization",
    );

    expect(() =>
      fromOpenApiOperation({
        document,
        path: "/reports",
        method: "get",
        parameterSources: { "header:Authorization": "user" },
      }),
    ).toThrow(/cannot be user-controlled/);
  });

  it("projects Tool UI layout hints into portable grouped form nodes", () => {
    const definition = fromAgentToolDefinition({
      name: "purchase.create",
      version: "1.0.0",
      inputSchema: {
        type: "object",
        properties: {
          address: { type: "string" },
          receiver: { type: "string" },
          remark: { type: "string" },
        },
      },
    });
    definition.uiHints = {
      softHints: {
        layout: { columns: 2, gap: 16 },
        groups: {
          delivery: {
            title: "Delivery",
            layout: { columns: 2, gap: 8 },
          },
        },
        fields: {
          address: { group: "delivery", layout: { span: 2 } },
          receiver: { group: "delivery" },
        },
      },
    };

    const surface = generateToolSurface(
      { definition, surfaceId: "purchase-input" },
      createStandardComponentRegistry(),
    );

    expect(surface.tree.layout).toEqual({
      columns: 2,
      gap: 16,
      modes: { compact: { columns: 1 } },
    });
    expect(surface.tree.children?.[0]).toMatchObject({
      component: "Section",
      props: { title: "Delivery" },
      layout: { columns: 2, gap: 8 },
    });
    expect(surface.tree.children?.[0]?.children?.[0]?.layout).toEqual({
      span: 2,
    });
  });

  it("rejects invalid schemas and deterministically falls back for unsupported valid keywords", () => {
    expect(() => normalizeToolSchema({ type: "not-a-type" })).toThrow();
    expect(normalizeToolSchema({ allOf: [{ type: "string" }] })).toEqual({
      type: "string",
    });
  });
});
