import { z } from "zod";

const nonEmptyString = z.string().refine((value) => value.trim().length > 0, {
  message: "Value must not be empty or whitespace only",
});

export const MinimalPluginManifestSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  version: nonEmptyString,
  description: z.string().optional(),
  entrypoint: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  permissions: z
    .object({
      filesystem: z.enum(["read", "write", "none"]).optional(),
      network: z.boolean().optional(),
      exec: z.boolean().optional(),
    })
    .optional(),
});

export type MinimalPluginManifest = z.infer<typeof MinimalPluginManifestSchema>;

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePluginManifest(input: unknown): ManifestValidationResult {
  const result = MinimalPluginManifestSchema.safeParse(input);
  if (result.success) {
    return { valid: true, errors: [], warnings: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    warnings: [],
  };
}
