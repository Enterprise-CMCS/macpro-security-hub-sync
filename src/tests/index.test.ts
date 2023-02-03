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

const iamClient = mockClient(IAMClient);
const sHClient = mockClient(SecurityHubClient);
const searchJiraStub = sinon.stub(JiraClient.prototype, "searchJira");
searchJiraStub.resolves(searchJiraResponse);

const LIST_ACCOUNT_ALIASES_RESPONSE = {
  $metadata: {},
  AccountAliases: ["my-account-alias"],
};
const GET_FINDINGS_COMMAND_RESPONSE: {
  Findings: AwsSecurityFinding[];
  $metadata: {};
} = {
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
  describe("JiraClient Tests", async () => {
    it("happy path", async () => {
      const jira = new JiraClient({ host: "" });
      const jqlString =
        'project = T4 AND labels = security-hub AND status not in ("Done")';

      const result = await jira.searchJira(jqlString, {});
      expect(result).toEqual(searchJiraResponse);
    });

    it("sync response", async () => {
      const sync = new SecurityHubJiraSync();
      const syncResult = await sync.sync();

      expect(syncResult).not.toBeDefined();
    });
  });

  describe("Without JIRA_CLOSED_STATUSES environment variable", async () => {
    delete process.env.JIRA_CLOSED_STATUSES;
    // process.env.PROJECT = "test";
    it("s path", async () => {
      const jira = new JiraClient({ host: "" });
      const jqlString =
        'project = T4 AND labels = security-hub AND status not in ("Done")';
      const result = await jira.searchJira(jqlString, {});
      expect(result).toEqual(searchJiraResponse);
    });
  });

  describe("missing a required environment variable", async () => {
    //   expect(new SecurityHubJiraSync()).rejects.toThrow(
    //     "Error: Missing required environment variables: PROJECT"
    //   );

    it("exception path", () => {
      delete process.env.PROJECT;
      const throwError = () => {
        new Jira();
      };
      expect(throwError).toThrow(
        "Missing required environment variables: PROJECT"
      );
    });
  });
});
