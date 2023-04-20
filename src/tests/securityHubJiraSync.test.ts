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
} from "@aws-sdk/client-securityhub";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";

describe("SecurityHubJiraSync tests", () => {
  testThrowsExceptionForInvalidSeverity();
  testCreatesExpectedJQLQuery();
  testNoNewJiraIssuesForNoFindings();
  testThrowsErrorForInvalidAwsAccountId();
  testThrowsErrorForStsGetCallerIdentityError();
  testPassesEpicKey();
});

function testThrowsExceptionForInvalidSeverity() {
  it("Throws an exception for invalid severity", async () => {
    sHClient.on(GetFindingsCommand, {}).resolves({
      Findings: [
        {
          Severity: { Label: "test" },
        } as AwsSecurityFinding,
      ],
    });
    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).rejects.toThrow("Invalid severity: test");
  });
}

function testCreatesExpectedJQLQuery() {
  it("creates the expected JQL query when searching for Jira issues", async () => {
    const sync = new SecurityHubJiraSync({
      region: Constants.TEST_AWS_REGION,
    });
    await sync.sync();
    const actualQueryParts = jiraSearchCalls[0].searchString.split(" AND ");
    const expectedQueryParts = [
      `labels = 'security-hub'`,
      `labels = '${Constants.TEST_AWS_ACCOUNT_ID}'`,
      `labels = '${Constants.TEST_AWS_REGION}'`,
      `project = '${Constants.TEST_PROJECT}'`,
      `status not in ('${Constants.TEST_STATUS}')`,
    ];
    expect(actualQueryParts).toEqual(
      expect.arrayContaining(expectedQueryParts)
    );
  });
}

function testNoNewJiraIssuesForNoFindings() {
  it("does not create new Jira issues if no findings are returned from Security Hub", async () => {
    sHClient.on(GetFindingsCommand, {}).resolvesOnce({
      Findings: [],
    });
    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).resolves.not.toThrow();
    expect(jiraAddNewIssueCalls).toEqual([]);
  });
}

function testThrowsErrorForInvalidAwsAccountId() {
  it("throws an error when the AWS Account ID is invalid or missing", async () => {
    stsClient
      .on(GetCallerIdentityCommand, {})
      .resolves({ Account: "invalid-account-id" });

    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).rejects.toThrow(
      "ERROR:  An issue was encountered when"
    );
  });
}

function testThrowsErrorForStsGetCallerIdentityError() {
  it("throws an error when STS GetCallerIdentity throws an error", async () => {
    stsClient.on(GetCallerIdentityCommand, {}).rejects("error");

    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).rejects.toThrow(
      "Error getting AWS Account ID: error"
    );
  });
}

function testPassesEpicKey() {
  it("passes epic key when creating an issue", async () => {
    const sync = new SecurityHubJiraSync({ epicKey: "ABC-123" });
    await sync.sync();
    expect(jiraAddNewIssueCalls[0].fields.parent.key).toBe("ABC-123");
  });
}
