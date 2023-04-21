import { vi, beforeEach, afterEach } from "vitest";
import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
} from "@aws-sdk/client-securityhub";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { mockClient } from "aws-sdk-client-mock";
import * as mockResponses from "./mockResponses";
import { Constants } from "./constants";
import { AxiosRequestConfig } from "axios";
import { IssueObject, JsonResponse } from "jira-client";

let originalJiraClosedStatuses;

beforeEach(() => {
  jiraAddNewIssueCalls = [];
  jiraSearchCalls = [];
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

// IAM
export const iamClient = mockClient(IAMClient);
beforeEach(() => {
  iamClient
    .on(ListAccountAliasesCommand, {})
    .resolves(mockResponses.listAccountAliasesResponse);
});

// Security Hub
export const sHClient = mockClient(SecurityHubClient);
beforeEach(() => {
  sHClient
    .on(GetFindingsCommand, {})
    .resolvesOnce({
      ...mockResponses.getFindingsCommandResponse,
      NextToken: "test",
    })
    .resolves({
      ...mockResponses.getFindingsCommandResponse,
      ...{
        Findings: [
          {
            ...mockResponses.getFindingsCommandResponse.Findings[0],
            Title: "test ticket2",
            ProductFields: {
              Title: "Test Finding",
              StandardsControlArn: `arn:aws:securityhub:${Constants.TEST_AWS_REGION}:${Constants.TEST_AWS_ACCOUNT_ID}:control/aws-foundational-security-best-practices/v/1.0.0/KMS.3`,
            },
          },
        ],
      },
    });
});

// STS
export const stsClient = mockClient(STSClient);
beforeEach(() => {
  stsClient.on(GetCallerIdentityCommand, {}).resolves({
    Account: Constants.TEST_AWS_ACCOUNT_ID,
  });
});

// axios
export class AxiosMock {
  async request(config: AxiosRequestConfig) {
    if (config.url?.includes("/issue/ISSUE-123/watchers")) {
      throw new Error("Test error");
    }

    return { status: 200, data: {} };
  }
}

vi.mock("axios", () => {
  return {
    default: async function (config: AxiosRequestConfig) {
      const axiosInstance = new AxiosMock();
      return axiosInstance.request(config);
    },
  };
});

// jira-client
export let jiraAddNewIssueCalls: IssueObject[] = [];
export let jiraSearchCalls: JsonResponse[] = [];

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
