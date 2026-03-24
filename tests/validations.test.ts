import { describe, it, expect } from "vitest";
import {
  usernameSchema,
  firstNameSchema,
  lastNameSchema,
  emailSchema,
  passwordSchema,
  signUpSchema,
  loginSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  groupNameSchema,
  inviteCodeSchema,
  consecutiveDaysSchema,
  dateRangeSchema,
} from "@/lib/validations";

describe("usernameSchema", () => {
  it("accepts valid username", () => {
    expect(usernameSchema.safeParse("janedoe").success).toBe(true);
  });

  it("accepts hyphens and underscores", () => {
    expect(usernameSchema.safeParse("jane_doe-123").success).toBe(true);
  });

  it("rejects too short", () => {
    const result = usernameSchema.safeParse("ab");
    expect(result.success).toBe(false);
  });

  it("rejects too long", () => {
    const result = usernameSchema.safeParse("a".repeat(31));
    expect(result.success).toBe(false);
  });

  it("rejects invalid characters", () => {
    const result = usernameSchema.safeParse("jane doe!");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(usernameSchema.safeParse("").success).toBe(false);
  });

  it("accepts exactly 3 characters", () => {
    expect(usernameSchema.safeParse("abc").success).toBe(true);
  });

  it("accepts exactly 30 characters", () => {
    expect(usernameSchema.safeParse("a".repeat(30)).success).toBe(true);
  });
});

describe("firstNameSchema", () => {
  it("accepts valid name", () => {
    expect(firstNameSchema.safeParse("Jane").success).toBe(true);
  });

  it("rejects empty", () => {
    expect(firstNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects over 50 characters", () => {
    expect(firstNameSchema.safeParse("a".repeat(51)).success).toBe(false);
  });

  it("accepts exactly 50 characters", () => {
    expect(firstNameSchema.safeParse("a".repeat(50)).success).toBe(true);
  });
});

describe("lastNameSchema", () => {
  it("accepts valid name", () => {
    expect(lastNameSchema.safeParse("Doe").success).toBe(true);
  });

  it("rejects empty", () => {
    expect(lastNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects over 50 characters", () => {
    expect(lastNameSchema.safeParse("a".repeat(51)).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("accepts valid email", () => {
    expect(emailSchema.safeParse("jane@example.com").success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts valid password", () => {
    expect(passwordSchema.safeParse("password123").success).toBe(true);
  });

  it("rejects short password", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });

  it("rejects over 72 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
  });

  it("accepts exactly 8 characters", () => {
    expect(passwordSchema.safeParse("abcd1234").success).toBe(true);
  });

  it("accepts exactly 72 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
  });
});

describe("signUpSchema", () => {
  const valid = {
    email: "jane@example.com",
    password: "password123",
    username: "janedoe",
    firstName: "Jane",
    lastName: "Doe",
    avatarColor: "blue",
  };

  it("accepts valid input", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing fields", () => {
    const result = signUpSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    expect(
      loginSchema.safeParse({ email: "jane@example.com", password: "x" })
        .success
    ).toBe(true);
  });

  it("rejects empty password", () => {
    expect(
      loginSchema.safeParse({ email: "jane@example.com", password: "" }).success
    ).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(
      loginSchema.safeParse({ email: "not-valid", password: "x" }).success
    ).toBe(false);
  });

  it("accepts any non-empty password (no min length)", () => {
    expect(
      loginSchema.safeParse({ email: "jane@example.com", password: "x" })
        .success
    ).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "newpass12",
        confirmPassword: "newpass12",
      }).success
    ).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "newpass12",
        confirmPassword: "different",
      }).success
    ).toBe(false);
  });

  it("rejects short password even when matching", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "short",
        confirmPassword: "short",
      }).success
    ).toBe(false);
  });

  it("rejects password over 72 characters", () => {
    const long = "a".repeat(73);
    expect(
      resetPasswordSchema.safeParse({ password: long, confirmPassword: long })
        .success
    ).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("accepts valid input", () => {
    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "old12345",
        newPassword: "new12345",
        confirmPassword: "new12345",
      }).success
    ).toBe(true);
  });

  it("rejects empty current password", () => {
    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "new12345",
        confirmPassword: "new12345",
      }).success
    ).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "old12345",
        newPassword: "new12345",
        confirmPassword: "different",
      }).success
    ).toBe(false);
  });

  it("rejects new password over 72 characters", () => {
    const long = "a".repeat(73);
    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "old12345",
        newPassword: long,
        confirmPassword: long,
      }).success
    ).toBe(false);
  });

  it("rejects short new password", () => {
    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "old12345",
        newPassword: "short",
        confirmPassword: "short",
      }).success
    ).toBe(false);
  });
});

describe("groupNameSchema", () => {
  it("accepts valid name", () => {
    expect(groupNameSchema.safeParse("My Group").success).toBe(true);
  });

  it("rejects empty", () => {
    expect(groupNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects over 50 characters", () => {
    expect(groupNameSchema.safeParse("a".repeat(51)).success).toBe(false);
  });
});

describe("inviteCodeSchema", () => {
  it("accepts valid code", () => {
    expect(inviteCodeSchema.safeParse("abc123").success).toBe(true);
  });

  it("rejects empty", () => {
    expect(inviteCodeSchema.safeParse("").success).toBe(false);
  });

  it("rejects over 50 characters", () => {
    expect(inviteCodeSchema.safeParse("a".repeat(51)).success).toBe(false);
  });
});

describe("consecutiveDaysSchema", () => {
  it("accepts valid number", () => {
    expect(consecutiveDaysSchema.safeParse("5").success).toBe(true);
  });

  it("accepts 1", () => {
    expect(consecutiveDaysSchema.safeParse("1").success).toBe(true);
  });

  it("accepts 19", () => {
    expect(consecutiveDaysSchema.safeParse("19").success).toBe(true);
  });

  it("rejects 0", () => {
    expect(consecutiveDaysSchema.safeParse("0").success).toBe(false);
  });

  it("rejects 20", () => {
    expect(consecutiveDaysSchema.safeParse("20").success).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(consecutiveDaysSchema.safeParse("2.5").success).toBe(false);
  });

  it("rejects negative number", () => {
    expect(consecutiveDaysSchema.safeParse("-1").success).toBe(false);
  });

  it("rejects non-numeric string", () => {
    expect(consecutiveDaysSchema.safeParse("abc").success).toBe(false);
  });
});

describe("dateRangeSchema", () => {
  it("accepts valid date range", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-14",
        endDate: "2028-07-18",
      }).success
    ).toBe(true);
  });

  it("accepts same start and end date", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-14",
        endDate: "2028-07-14",
      }).success
    ).toBe(true);
  });

  it("rejects start after end", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-18",
        endDate: "2028-07-14",
      }).success
    ).toBe(false);
  });

  it("rejects start before Olympic period", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-11",
        endDate: "2028-07-14",
      }).success
    ).toBe(false);
  });

  it("rejects end after Olympic period", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-14",
        endDate: "2028-07-31",
      }).success
    ).toBe(false);
  });

  it("accepts Olympic start boundary", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-12",
        endDate: "2028-07-14",
      }).success
    ).toBe(true);
  });

  it("accepts Olympic end boundary", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-14",
        endDate: "2028-07-30",
      }).success
    ).toBe(true);
  });

  it("rejects empty start date", () => {
    expect(
      dateRangeSchema.safeParse({ startDate: "", endDate: "2028-07-14" })
        .success
    ).toBe(false);
  });

  it("rejects empty end date", () => {
    expect(
      dateRangeSchema.safeParse({ startDate: "2028-07-14", endDate: "" })
        .success
    ).toBe(false);
  });

  it("accepts full Olympic period (Jul 12 to Jul 30)", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-07-12",
        endDate: "2028-07-30",
      }).success
    ).toBe(true);
  });

  it("rejects dates completely outside Olympic period", () => {
    expect(
      dateRangeSchema.safeParse({
        startDate: "2028-06-01",
        endDate: "2028-06-10",
      }).success
    ).toBe(false);
  });
});
