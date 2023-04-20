import { it, describe, expect } from "vitest";
import "./mockClients";
import { SecurityHub } from "../libs";
import { Constants } from "./constants";
import {
  AwsSecurityFinding,
  GetFindingsCommand,
} from "@aws-sdk/client-securityhub";
import { iamClient, sHClient } from "./mockClients";
import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";

describe("SecurityHub tests", () => {
  testSecurityHubGetAllFindings();
  testGetAllActiveFindingsThrowsException();
  testAccountAliasUndefined();
  testUndefinedFinding();
});

function testSecurityHubGetAllFindings() {
  it("gets all active findings without a env var for SECURITY_HUB_NEW_ISSUE_DELAY", async () => {
    delete process.env.SECURITY_HUB_NEW_ISSUE_DELAY;
    const securityHub = new SecurityHub({
      region: "us-east-1",
      severities: ["CRITICAL"],
    });

    const result = await securityHub.getAllActiveFindings();

    expect(securityHub.accountAlias).toEqual("my-account-alias");
    expect(result.length).toEqual(2);
  });
}

function testGetAllActiveFindingsThrowsException() {
  it("handles an error correctly", async () => {
    sHClient.on(GetFindingsCommand, {}).rejects(new Error("Test error"));
    const securityHub = new SecurityHub({
      region: "us-east-1",
      severities: ["CRITICAL"],
    });
    await expect(securityHub.getAllActiveFindings()).rejects.toThrow(
      "Test error"
    );
  });
}

function testAccountAliasUndefined() {
  it("handles undefined AccountAliases", async () => {
    iamClient.on(ListAccountAliasesCommand, {}).resolves({});
    const securityHub = new SecurityHub({});
    expect(securityHub.accountAlias).toEqual("");
  });
}

function testUndefinedFinding() {
  it("returns empty object when finding is undefined", () => {
    const sH = new SecurityHub();
    const result = sH.awsSecurityFindingToSecurityHubFinding(undefined!);
    expect(result).toEqual({});
  });
}
