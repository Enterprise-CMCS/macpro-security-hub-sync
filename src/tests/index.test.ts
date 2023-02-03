import { it, describe, expect, beforeEach } from "vitest";
import { SecurityHubJiraSync } from "../index";
import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
  AwsSecurityFinding,
} from "@aws-sdk/client-securityhub";
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

const LIST_ACCOUNT_ALIASES_RESPONSE = {
  $metadata: {},
  AccountAliases: ["my-account-alias"],
};

const GET_FINDINGS_COMMAND_RESPONSE = {
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
const searchJiraStub = sinon.stub(JiraClient.prototype, "searchJira");
searchJiraStub.resolves(searchJiraResponse);

sHClient
  .on(GetFindingsCommand, {})
  .resolvesOnce({ ...GET_FINDINGS_COMMAND_RESPONSE, NextToken: "test" })
  .resolves(GET_FINDINGS_COMMAND_RESPONSE);

beforeEach(() => {
  iamClient.reset();
  iamClient
    .on(ListAccountAliasesCommand, {})
    .resolves(LIST_ACCOUNT_ALIASES_RESPONSE);
  searchJiraStub.resetBehavior();
  searchJiraStub.resolves(searchJiraResponse);
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
    delete process.env.PROJECT;
    expect(() => new Jira()).toThrow(
      "Missing required environment variables: PROJECT"
    );
  });
});
