import Ajv, { type ErrorObject } from "npm:ajv@8.12.0";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });

export function validateSchema<T>(
  schema: Record<string, unknown>,
  data: unknown,
): { valid: boolean; errors: ErrorObject[] } {
  const validate = ajv.compile(schema);
  const valid = validate(data) as boolean;
  return { valid, errors: validate.errors ?? [] };
}

export function formatAjvErrors(errors: ErrorObject[]): string[] {
  return errors.map((error) => {
    const path = error.instancePath || "(root)";
    return `${path} ${error.message ?? "is invalid"}`;
  });
}
