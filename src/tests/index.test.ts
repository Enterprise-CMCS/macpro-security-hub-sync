import { it, describe, expect, beforeEach } from "vitest";
import { SecurityHubJiraSync } from "../index";
import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import { mockClient } from "aws-sdk-client-mock";
import JiraClient from "jira-client";
import sinon from "sinon";

const searchJiraResponse = { issues: [] };
const iamClient = mockClient(IAMClient);
const searchJiraStub = sinon.stub(JiraClient.prototype, "searchJira");
searchJiraStub.resolves(searchJiraResponse);

const LIST_ACCOUNT_ALIASES_RESPONSE = {
  $metadata: {
    httpStatusCode: 200,
  },
  AccountAliases: ["my-account-alias"],
};

beforeEach(() => {
  iamClient.reset();
  iamClient
    .on(ListAccountAliasesCommand, {})
    .resolves(LIST_ACCOUNT_ALIASES_RESPONSE);
  searchJiraStub.resetBehavior();
  searchJiraStub.resolves(searchJiraResponse);
});

describe("SecurityHubJiraSync", () => {
  process.env.PROJECT = "myProject";

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
});
