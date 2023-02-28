import { it, describe, expect, beforeEach } from "vitest";
import { SecurityHubJiraSync } from "../index";
import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
} from "@aws-sdk/client-securityhub";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { mockClient } from "aws-sdk-client-mock";
import JiraClient from "jira-client";
import sinon from "sinon";
import { Jira } from "../libs";

// ******** constants ********

const testAwsAccountId = "012345678901";
const testProject = "testProject";
const testStatus = "testStatus";
const testAwsRegion = "us-east-1";

// ******** mock responses ********

const searchJiraResponse = {
  issues: [
    {
      fields: {
        summary: "Sample SecurityHub Finding",
      },
    },
  ],
};

const addNewIssueJiraResponse = {
  key: "TEST-15",
};

const listAccountAliasesResponse = {
  $metadata: {},
  AccountAliases: ["my-account-alias"],
};

const getFindingsCommandResponse = {
  Findings: [
    {
      SchemaVersion: undefined,
      Id: undefined,
      ProductArn: undefined,
      GeneratorId: undefined,
      AwsAccountId: undefined,
      CreatedAt: undefined,
      UpdatedAt: undefined,
      Title: undefined,
      Description: undefined,
      Resources: undefined,
    },
  ],
  $metadata: {},
};

// ******** mocks ********

// IAM
const iamClient = mockClient(IAMClient);
iamClient
  .on(ListAccountAliasesCommand, {})
  .resolves(listAccountAliasesResponse);

// Security Hub
const sHClient = mockClient(SecurityHubClient);
sHClient
  .on(GetFindingsCommand, {})
  .resolvesOnce({ ...getFindingsCommandResponse, NextToken: "test" })
  .resolves({
    ...getFindingsCommandResponse,
    ...{
      Findings: [
        {
          ...getFindingsCommandResponse.Findings[0],
          ProductFields: {
            Title: "Test Finding",
            StandardsControlArn: `arn:aws:securityhub:${testAwsRegion}:${testAwsAccountId}:control/aws-foundational-security-best-practices/v/1.0.0/KMS.3`,
          },
        },
      ],
    },
  });

// STS
const stsClient = mockClient(STSClient);
stsClient.on(GetCallerIdentityCommand, {}).resolves({
  Account: testAwsAccountId,
});

// Jira
const searchJiraStub = sinon.stub(JiraClient.prototype, "searchJira");
searchJiraStub.resolves(searchJiraResponse);

const addNewIssueJiraStub = sinon.stub(JiraClient.prototype, "addNewIssue");
addNewIssueJiraStub.resolves(addNewIssueJiraResponse);

// ******** setup ********

process.env.JIRA_HOST = "testHost";
process.env.JIRA_USERNAME = "testUsername";
process.env.JIRA_TOKEN = "testToken";
process.env.JIRA_PROJECT = testProject;
process.env.JIRA_CLOSED_STATUSES = testStatus;

beforeEach(() => {
  iamClient.resetHistory();
  stsClient.resetHistory();
  searchJiraStub.resetHistory();
  addNewIssueJiraStub.resetHistory();
});

// ******** tests ********

describe("SecurityHubJiraSync", () => {
  it("jira returns search results", async () => {
    const jira = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';
    const result = await jira.searchJira(jqlString, {});
    expect(result).toEqual(searchJiraResponse);
  });

  it("sync response", async () => {
    const sync = new SecurityHubJiraSync({});
    const syncResult = await sync.sync();
    expect(syncResult).not.toBeDefined();
  });

  it("passes epic key when creating an issue", async () => {
    const sync = new SecurityHubJiraSync({
      epicKey: "ABCD-1234",
    });
    await sync.sync();
    expect(addNewIssueJiraStub.getCall(0).args[0].fields.parent.key).toBe(
      "ABCD-1234"
    );
  });

  it("doesn't pass epic key if it isn't set", async () => {
    const sync = new SecurityHubJiraSync({});
    await sync.sync();
    expect(
      addNewIssueJiraStub.getCall(0).args[0].fields.parent
    ).toBeUndefined();
  });

  it("creates the expected JQL query when searching for Jira issues", async () => {
    const sync = new SecurityHubJiraSync({ region: testAwsRegion });
    await sync.sync();
    const actualQueryParts = searchJiraStub.getCall(0).args[0].split(" AND ");
    const expectedQueryParts = [
      `labels = 'security-hub'`,
      `labels = '${testAwsAccountId}'`,
      `labels = '${testAwsRegion}'`,
      `project = '${testProject}'`,
      `status not in ('${testStatus}')`,
    ];
    expect(actualQueryParts).toEqual(
      expect.arrayContaining(expectedQueryParts)
    );
  });

  it("Without JIRA_CLOSED_STATUSES environment variable", async () => {
    delete process.env.JIRA_CLOSED_STATUSES;
    const jira = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';
    const result = await jira.searchJira(jqlString, {});
    expect(result).toEqual(searchJiraResponse);
  });

  it("Missing a required environment variable", () => {
    delete process.env.JIRA_PROJECT;
    expect(() => new Jira()).toThrow(
      "Missing required environment variables: JIRA_PROJECT"
    );
  });
});
