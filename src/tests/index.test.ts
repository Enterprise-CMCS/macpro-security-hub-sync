import { it, describe, expect, beforeEach, afterEach, vi } from "vitest";
import "./mockClients";
import { SecurityHubJiraSync } from "../index";
import JiraClient, { IssueObject, JsonResponse } from "jira-client";
import { Jira } from "../libs";
import { Constants } from "./constants";
import * as mockResponses from "./mockResponses";

// ******** mocks ********
let jiraAddNewIssueCalls: IssueObject[] = [];
let jiraSearchCalls: JsonResponse[] = [];
let originalJiraClosedStatuses;

beforeEach(() => {
  process.env.JIRA_HOST = "testHost";
  process.env.JIRA_USERNAME = "testUsername";
  process.env.JIRA_TOKEN = "testToken";
  process.env.JIRA_PROJECT = Constants.TEST_PROJECT;
  process.env.JIRA_CLOSED_STATUSES = Constants.TEST_STATUS;
  jiraAddNewIssueCalls = [];
  jiraSearchCalls = [];
  originalJiraClosedStatuses = process.env.JIRA_CLOSED_STATUSES;
});

afterEach(() => {
  process.env.JIRA_CLOSED_STATUSES = originalJiraClosedStatuses;
});

vi.mock("jira-client", () => {
  return {
    default: class {
      searchJira(searchString: string) {
        jiraSearchCalls.push({ searchString });
        return Promise.resolve(mockResponses.searchJiraResponse);
      }
      async addNewIssue(issue: IssueObject) {
        jiraAddNewIssueCalls.push(issue);
        return Promise.resolve(mockResponses.addNewIssueJiraResponse);
      }
      getCurrentUser() {
        return "Current User";
      }
    },
  };
});

// ******** tests ********
describe("SecurityHubJiraSync", () => {
  it("jira returns search results", async () => {
    const jira = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';
    const result = await jira.searchJira(jqlString, {});
    expect(result).toEqual(mockResponses.searchJiraResponse);
  });

  it("sync response", async () => {
    const sync = new SecurityHubJiraSync({});
    const syncResult = await sync.sync();
    expect(syncResult).not.toBeDefined();
  });

  it("passes epic key when creating an issue", async () => {
    const sync = new SecurityHubJiraSync({ epicKey: "ABC-123" });
    await sync.sync();
    expect(jiraAddNewIssueCalls[0].fields.parent.key).toBe("ABC-123");
  });

  it("doesn't pass epic key if it isn't set", async () => {
    const sync = new SecurityHubJiraSync({});
    await sync.sync();
    expect(jiraAddNewIssueCalls[0].fields.parent).toBeUndefined();
  });

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

  it("Without JIRA_CLOSED_STATUSES environment variable", async () => {
    delete process.env.JIRA_CLOSED_STATUSES;
    const jira = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';
    const result = await jira.searchJira(jqlString, {});
    expect(result).toEqual(mockResponses.searchJiraResponse);
  });

  it("Missing a required environment variable", () => {
    delete process.env.JIRA_PROJECT;
    expect(() => new Jira()).toThrow(
      "Missing required environment variables: JIRA_PROJECT"
    );
  });
});
