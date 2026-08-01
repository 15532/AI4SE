import { describe, expect, it } from "vitest";
import { parseAction } from "../../src/core/actions";

describe("parseAction scaffold", () => {
  it("exports parseAction", () => {
    expect(typeof parseAction).toBe("function");
  });
});
