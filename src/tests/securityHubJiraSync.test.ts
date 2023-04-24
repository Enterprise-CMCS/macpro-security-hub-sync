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
  testGetAwsAccountId();
  testThrowsErrorForInvalidAwsAccountId();
  testThrowsErrorForStsGetCallerIdentityError();
  testPassesEpicKey();
  testErrorClosingIssue();
  testErrorCreatingIssue();
  testSecurityHubSeveritiesToJiraPriorities();
});

function testThrowsExceptionForInvalidSeverity() {
  it("Throws an exception for invalid severity", async () => {
    sHClient.on(GetFindingsCommand, {}).resolves({
      Findings: [
        {
          Title: "sample ticket",
          Severity: { Label: "test" },
        } as AwsSecurityFinding,
      ],
    });
    const sHJS = new SecurityHubJiraSync({});
    await expect(sHJS.sync()).rejects.toThrow("Invalid severity: test");
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
      expect.arrayContaining(expectedQueryParts)
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
      "ERROR:  An issue was encountered when"
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
      "ERROR:  An issue was encountered when"
    );
  });
}

function testThrowsErrorForStsGetCallerIdentityError() {
  it("throws an error when STS GetCallerIdentity throws an error", async () => {
    stsClient.on(GetCallerIdentityCommand, {}).rejects("error");

    const sHJS = new SecurityHubJiraSync({});
    await expect(sHJS.sync()).rejects.toThrow(
      "Error getting AWS Account ID: error"
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

function testErrorClosingIssue() {
  it("testing error closing Jira issue", async () => {
    const sHJS = new SecurityHubJiraSync();
    const jiraIssues = [{ fields: { summary: "test-issue" }, key: "ABC-123" }];
    const shFindings = [{ title: "test-finding" }];

    // mock the jira.closeIssue function to throw an error
    sHJS.jira.closeIssue = () => {
      throw new Error("Test error");
    };

    await expect(
      sHJS.closeIssuesForResolvedFindings(jiraIssues, shFindings)
    ).rejects.toThrow(
      "Error closing Jira issue for resolved finding: Test error"
    );
  });
}

function testErrorCreatingIssue() {
  it("testing error creating Jira issue", async () => {
    const sHJS = new SecurityHubJiraSync();

    // mock the jira.createNewIssue function to throw an error
    sHJS.jira.createNewIssue = ({}) => {
      throw new Error("Test error");
    };

    await expect(sHJS.createJiraIssueFromFinding({}, [])).rejects.toThrow(
      "Error creating Jira issue from finding: Test error"
    );
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
