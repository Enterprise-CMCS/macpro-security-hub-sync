import { it, describe, expect } from "vitest";
import { AxiosMock } from "./mockClients";
import JiraClient from "jira-client";
import { Jira } from "../libs";
import * as mockResponses from "./mockResponses";

describe("Jira tests", () => {
  testJiraClientSearchJira();
  testJiraClientSearchHandlesZeroResults();
  testJiraLibSearchWithClosedStatuses();
  testThrowsErrorIfSearchQueryMissingAwsAccountId();
  testThrowsExceptionInGetAllSecurityHubIssuesInJiraProject();
  testErrorRemovingWatcherFromJiraIssue();
  testErrorClosingJiraIssue();
  testMissingRequiredEnvVar();
  testErrorCreatingJiraIssue();
  testCannotFindDoneTransitionForIssue();
  testTransitionIssue();
});

function testJiraClientSearchJira() {
  it("JiraClient.searchJira should return expected search results", async () => {
    const jira = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';
    const result = await jira.searchJira(jqlString, {});
    expect(result).toEqual(mockResponses.searchJiraResponse);
  });
}

function testJiraClientSearchHandlesZeroResults() {
  it("Successfully handles a search with zero results", async () => {
    const jira = new Jira();

    // Mock the JiraClient to return an empty array when searching for issues
    jira.jira.searchJira = async () => {
      return { issues: [] };
    };

    const results = await jira.getAllSecurityHubIssuesInJiraProject([
      "123456789012",
    ]);

    expect(results).toHaveLength(0);
  });
}

function testJiraLibSearchWithClosedStatuses() {
  it("Jira lib should search Jira with the correct JQL string and closed statuses", async () => {
    // Test if JIRA_CLOSED_STATUSES is set to "Done" if the environment variable is not set
    delete process.env.JIRA_CLOSED_STATUSES;
    const jira = new Jira();
    expect(jira.jiraClosedStatuses).toEqual(["Done"]);

    // Test if JiraClient.searchJira returns the expected search results with the correct JQL string
    const jiraClient = new JiraClient({ host: "" });
    const jqlString =
      'project = TEST AND labels = security-hub AND status not in ("Done")';
    const result = await jiraClient.searchJira(jqlString, {});
    expect(result).toEqual(mockResponses.searchJiraResponse);
  });
}

function testThrowsErrorIfSearchQueryMissingAwsAccountId() {
  it("throws an error if searchQuery is missing AWS account ID label", async () => {
    const jira = new Jira();
    await expect(
      jira.getAllSecurityHubIssuesInJiraProject(["some-label"])
    ).rejects.toThrow();
  });
}

function testThrowsExceptionInGetAllSecurityHubIssuesInJiraProject() {
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
}

function testErrorRemovingWatcherFromJiraIssue() {
  it("Error removing watcher from Jira issue", async () => {
    const axiosInstance = new AxiosMock();

    const jira = new Jira();

    try {
      await jira.removeCurrentUserAsWatcher("ISSUE-123");
    } catch (error) {
      expect(error.message).toContain("Test error");
    }
  });
}

function testErrorClosingJiraIssue() {
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
}

function testMissingRequiredEnvVar() {
  it("Missing a required environment variable", () => {
    delete process.env.JIRA_PROJECT;
    expect(() => new Jira()).toThrow(
      "Missing required environment variables: JIRA_PROJECT"
    );
  });
}

function testErrorCreatingJiraIssue() {
  it("Error creating Jira issue", async () => {
    const jira = new Jira();

    jira.jira.addNewIssue = async () => {
      throw new Error("Error adding new issue");
    };

    try {
      await jira.createNewIssue({});
    } catch (error) {
      expect(error.message).toContain("Error creating Jira issue");
    }
  });
}

function testCannotFindDoneTransitionForIssue() {
  it("Cannot find 'Done' transition for issue", async () => {
    const jira = new Jira();

    jira.jira.listTransitions = async () => {
      return { transitions: [{ id: "1", name: "In Progress" }] };
    };

    try {
      await jira.closeIssue("TEST-1");
    } catch (error) {
      expect(error.message).toContain(
        'Cannot find "Done" transition for issue TEST-1'
      );
    }
  });
}

function testTransitionIssue() {
  it("Successfully transitions the Jira issue", async () => {
    const jira = new Jira();
    const issueKey = "TEST-1";
    const doneTransition = { id: "100", name: "Done" };

    jira.jira.listTransitions = async () => {
      return { transitions: [doneTransition] };
    };

    jira.jira.transitionIssue = async (key, options) => {
      expect(key).toBe(issueKey);
      expect(options).toEqual({ transition: { id: doneTransition.id } });
    };

    await jira.closeIssue(issueKey);
  });
}
