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

const iamClient = mockClient(IAMClient);
const sHClient = mockClient(SecurityHubClient);
const stsClient = mockClient(STSClient);
const searchJiraStub = sinon.stub(JiraClient.prototype, "searchJira");
searchJiraStub.resolves(searchJiraResponse);
const addNewIssueJiraStub = sinon.stub(JiraClient.prototype, "addNewIssue");

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
            StandardsControlArn:
              "arn:aws:securityhub:us-east-1:0123456789012:control/aws-foundational-security-best-practices/v/1.0.0/KMS.3",
          },
        },
      ],
    },
  });

beforeEach(() => {
  iamClient.reset();
  iamClient
    .on(ListAccountAliasesCommand, {})
    .resolves(listAccountAliasesResponse);
  stsClient.reset();
  stsClient.on(GetCallerIdentityCommand, {}).resolves({
    Account: "012345678901",
  });
  searchJiraStub.resetBehavior();
  searchJiraStub.resolves(searchJiraResponse);
  addNewIssueJiraStub.resetBehavior();
  addNewIssueJiraStub.resolves(addNewIssueJiraResponse);
  process.env.JIRA_HOST = "test";
  process.env.JIRA_USERNAME = "test";
  process.env.JIRA_TOKEN = "test";
  process.env.JIRA_PROJECT = "test";
  process.env.JIRA_CLOSED_STATUSES = "test";
});

describe("SecurityHubJiraSync", () => {
  it("jira returns search results", async () => {
    const jira = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';

    const result = await jira.searchJira(jqlString, {});
    expect(result).toEqual(searchJiraResponse);
  });

  it("sync response", async () => {
    const sync = new SecurityHubJiraSync();
    const syncResult = await sync.sync();

    expect(syncResult).not.toBeDefined();
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
