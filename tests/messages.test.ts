import { describe, it, expect } from "vitest";
import {
  MSG_NOT_LOGGED_IN,
  MSG_NOT_MEMBER,
  MSG_GROUP_NOT_FOUND,
  MSG_GROUP_FULL,
  MSG_MEMBER_NOT_FOUND,
  MSG_MEMBER_NOT_PENDING,
  MSG_USERNAME_TAKEN,
  failedAction,
} from "@/lib/messages";

describe("message constants", () => {
  it("MSG_NOT_LOGGED_IN is defined", () => {
    expect(MSG_NOT_LOGGED_IN).toBe("You must be logged in.");
  });

  it("MSG_NOT_MEMBER is defined", () => {
    expect(MSG_NOT_MEMBER).toBe("You are not an active member of this group.");
  });

  it("MSG_GROUP_NOT_FOUND is defined", () => {
    expect(MSG_GROUP_NOT_FOUND).toBe("Group not found.");
  });

  it("MSG_GROUP_FULL is defined", () => {
    expect(MSG_GROUP_FULL).toContain("full");
    expect(MSG_GROUP_FULL).toContain("12");
  });

  it("MSG_MEMBER_NOT_FOUND is defined", () => {
    expect(MSG_MEMBER_NOT_FOUND).toBe("Member not found.");
  });

  it("MSG_MEMBER_NOT_PENDING is defined", () => {
    expect(MSG_MEMBER_NOT_PENDING).toBe("Member is not pending approval.");
  });

  it("MSG_USERNAME_TAKEN is defined", () => {
    expect(MSG_USERNAME_TAKEN).toBe("This username is already taken.");
  });
});

describe("failedAction", () => {
  it("generates a failure message with the given action", () => {
    expect(failedAction("save timeslot")).toBe(
      "Failed to save timeslot. Please try again."
    );
  });

  it("works with various action strings", () => {
    expect(failedAction("delete purchase")).toBe(
      "Failed to delete purchase. Please try again."
    );
    expect(failedAction("update price")).toBe(
      "Failed to update price. Please try again."
    );
  });
});
