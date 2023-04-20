import { it, describe, expect, beforeEach, afterEach, vi } from "vitest";
import {
  jiraAddNewIssueCalls,
  jiraSearchCalls,
  sHClient,
  stsClient,
  AxiosMock,
} from "./mockClients";
import { SecurityHubJiraSync } from "../index";
import JiraClient from "jira-client";
import { Jira, SecurityHub } from "../libs";
import { Constants } from "./constants";
import * as mockResponses from "./mockResponses";
import {
  AwsSecurityFinding,
  GetFindingsCommand,
} from "@aws-sdk/client-securityhub";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { AxiosRequestConfig } from "axios";

// ******** mocks ********
let originalJiraClosedStatuses;

// Mock setup
beforeEach(() => {
  process.env.JIRA_HOST = "testHost";
  process.env.JIRA_USERNAME = "testUsername";
  process.env.JIRA_TOKEN = "testToken";
  process.env.JIRA_PROJECT = Constants.TEST_PROJECT;
  process.env.JIRA_CLOSED_STATUSES = Constants.TEST_STATUS;
  originalJiraClosedStatuses = process.env.JIRA_CLOSED_STATUSES;
});

afterEach(() => {
  process.env.JIRA_CLOSED_STATUSES = originalJiraClosedStatuses;
});

// ******** tests ********
describe("SecurityHubJiraSync", () => {
  it("JiraClient.searchJira should return expected search results", async () => {
    const jira = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';
    const result = await jira.searchJira(jqlString, {});
    expect(result).toEqual(mockResponses.searchJiraResponse);
  });

  it("SecurityHubJiraSync.sync should complete without error", async () => {
    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).resolves.not.toThrow();
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

  it('Jira lib should use ["Done"] for JIRA_CLOSED_STATUSES if the environment variable is not set', async () => {
    delete process.env.JIRA_CLOSED_STATUSES;
    const jira = new Jira();
    expect(jira.jiraClosedStatuses).toEqual(["Done"]);
  });

  it("Missing a required environment variable", () => {
    delete process.env.JIRA_PROJECT;
    expect(() => new Jira()).toThrow(
      "Missing required environment variables: JIRA_PROJECT"
    );
  });

  it("does not create new Jira issues if no findings are returned from Security Hub", async () => {
    sHClient.on(GetFindingsCommand, {}).resolvesOnce({
      Findings: [],
    });
    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).resolves.not.toThrow();
    expect(jiraAddNewIssueCalls).toEqual([]);
  });

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

  it("throws an error when the AWS Account ID is invalid or missing", async () => {
    stsClient
      .on(GetCallerIdentityCommand, {})
      .resolves({ Account: "invalid-account-id" });

    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).rejects.toThrow(
      "ERROR:  An issue was encountered when"
    );
  });

  it("throws an error when STS GetCallerIdentity throws an error", async () => {
    stsClient.on(GetCallerIdentityCommand, {}).rejects("error");

    const sync = new SecurityHubJiraSync({});
    await expect(sync.sync()).rejects.toThrow(
      "Error getting AWS Account ID: error"
    );
  });

  it("throws an error if searchQuery is missing AWS account ID label", async () => {
    const jira = new Jira();
    await expect(
      jira.getAllSecurityHubIssuesInJiraProject(["some-label"])
    ).rejects.toThrow();
  });

  it("getAllSecurityHubIssuesInJiraProject throws exception", async () => {
    const jira = new Jira();

    // Mock the JiraClient to return an incorrect retrun value
    jira.jira.searchJira = async () => {
      return new Error("test");
    };

    await expect(
      jira.getAllSecurityHubIssuesInJiraProject(["123456789012"])
    ).rejects.toThrow(
      "Error getting Security Hub issues from Jira: Cannot read properties of undefined"
    );
  });

  it("Error removing watcher from Jira issue", async () => {
    const axiosInstance = new AxiosMock();

    vi.mock("axios", () => {
      return {
        default: async function (config: AxiosRequestConfig) {
          return axiosInstance.request(config);
        },
      };
    });

    const jira = new Jira();

    try {
      await jira.removeCurrentUserAsWatcher("ISSUE-123");
    } catch (error) {
      expect(error.message).toContain("Test error");
    }
  });

  it("Error closing Jira issue", async () => {
    const jira = new Jira();

    // Mock the JiraClient to throw an error when transitioning an issue
    jira.jira.transitionIssue = async () => {
      throw new Error("Error transitioning issue");
    };

    try {
      await jira.closeIssue("TEST-1");
    } catch (error) {
      expect(error.message).toContain("Error closing issue");
    }
  });
});
