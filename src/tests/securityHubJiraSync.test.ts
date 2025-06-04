import { it, describe, expect } from "vitest";
import {
  jiraAddNewIssueCalls,
  jiraSearchCalls,
  sHClient,
  stsClient,
} from "./mockClients";
import { SecurityHubJiraSync } from "../index";
import { Constants } from "./constants";
import {
  AwsSecurityFinding,
  GetFindingsCommand,
  SeverityLabel,
} from "@aws-sdk/client-securityhub";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";

describe("SecurityHubJiraSync tests", () => {
  testThrowsExceptionForInvalidSeverity();
  testCreatesExpectedJQLQuery();
  testNoNewJiraIssuesForNoFindings();
  testGetAwsAccountId();
  testThrowsErrorForInvalidAwsAccountId();
  testThrowsErrorForStsGetCallerIdentityError();
  testPassesEpicKey();
  testSecurityHubSeveritiesToJiraPriorities();
});

function testThrowsExceptionForInvalidSeverity() {
  it("Throws an exception for invalid severity", async () => {
    sHClient.on(GetFindingsCommand, {}).resolves({
      Findings: [
        {
          SchemaVersion: "1.0",
          Id: "test-id",
          ProductArn: "arn:aws:securityhub:us-east-1::product/test",
          GeneratorId: "test-generator",
          AwsAccountId: "123456789012",
          Types: [],
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
          Title: "sample ticket",
          Severity: { Label: "INVALID_SEVERITY" as any },
          Description: "mock description",
          Resources: [],
        } as AwsSecurityFinding,
      ],
    });
    const sHJS = new SecurityHubJiraSync({});
    await expect(sHJS.sync()).rejects.toThrow(
      "Invalid severity: INVALID_SEVERITY",
    );
  });
}

function testCreatesExpectedJQLQuery() {
  it("creates the expected JQL query when searching for Jira issues", async () => {
    const sHJS = new SecurityHubJiraSync({
      region: Constants.TEST_AWS_REGION,
    });
    await sHJS.sync();
    const actualQueryParts = jiraSearchCalls[0].searchString.split(" AND ");
    const expectedQueryParts = [
      `labels = 'security-hub'`,
      `labels = '${Constants.TEST_AWS_ACCOUNT_ID}'`,
      `labels = '${Constants.TEST_AWS_REGION}'`,
      `project = '${Constants.TEST_PROJECT}'`,
      `status not in ('${Constants.TEST_STATUS}')`,
    ];
    expect(actualQueryParts).toEqual(
      expect.arrayContaining(expectedQueryParts),
    );
  });
}

function testNoNewJiraIssuesForNoFindings() {
  it("does not create new Jira issues if no findings are returned from Security Hub", async () => {
    sHClient.on(GetFindingsCommand, {}).resolvesOnce({
      Findings: [],
    });
    const sHJS = new SecurityHubJiraSync({});
    await expect(sHJS.sync()).resolves.not.toThrow();
    expect(jiraAddNewIssueCalls).toEqual([]);
  });
}

function testGetAwsAccountId() {
  it("succesfully gets AWS Account ID", async () => {
    stsClient.on(GetCallerIdentityCommand, {}).resolves({ Account: "" });

    const sHJS = new SecurityHubJiraSync({});
    await expect(sHJS.sync()).rejects.toThrow(
      "ERROR:  An issue was encountered when",
    );
  });
}

function testThrowsErrorForInvalidAwsAccountId() {
  it("throws an error when the AWS Account ID is invalid or missing", async () => {
    stsClient
      .on(GetCallerIdentityCommand, {})
      .resolves({ Account: "invalid-account-id" });

    const sHJS = new SecurityHubJiraSync({});
    await expect(sHJS.sync()).rejects.toThrow(
      "ERROR:  An issue was encountered when",
    );
  });
}

function testThrowsErrorForStsGetCallerIdentityError() {
  it("throws an error when STS GetCallerIdentity throws an error", async () => {
    stsClient.on(GetCallerIdentityCommand, {}).rejects("error");

    const sHJS = new SecurityHubJiraSync({});
    await expect(sHJS.sync()).rejects.toThrow(
      "Error getting AWS Account ID: error",
    );
  });
}

function testPassesEpicKey() {
  it("passes epic key when creating an issue", async () => {
    const sHJS = new SecurityHubJiraSync({ epicKey: "ABC-123" });
    await sHJS.sync();
    expect(jiraAddNewIssueCalls[0].fields.parent.key).toBe("ABC-123");
  });
}

function testSecurityHubSeveritiesToJiraPriorities() {
  it("testing security hub severities to jira priorities", async () => {
    const sHJS = new SecurityHubJiraSync();
    [
      ["INFORMATIONAL", "5"],
      ["LOW", "4"],
      ["MEDIUM", "3"],
      ["HIGH", "2"],
      ["CRITICAL", "1"],
    ].forEach(([severity, priority]) => {
      expect(sHJS.getPriorityNumber(severity)).toEqual(priority);
    });
  });
}
