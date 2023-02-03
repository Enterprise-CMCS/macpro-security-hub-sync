import JiraClient, { IssueObject } from "jira-client";
import * as dotenv from "dotenv";
import { Logger } from "./error-lib";

dotenv.config();

export class Jira {
  private readonly jira;
  jiraClosedStatuses: string[];
  project: string;

  constructor() {
    Jira.checkEnvVars();

    this.project = process.env.PROJECT ?? "";
    this.jiraClosedStatuses = process.env.JIRA_CLOSED_STATUSES
      ? process.env.JIRA_CLOSED_STATUSES.split(",")
      : ["Done"];

    this.jira = new JiraClient({
      protocol: "https",
      host: process.env.JIRA_HOST!,
      port: "443",
      username: process.env.JIRA_USERNAME,
      password: process.env.JIRA_TOKEN,
      apiVersion: "2",
      strictSSL: true,
    });
  }

  private static checkEnvVars(): void {
    const requiredEnvVars = [
      "JIRA_HOST",
      "JIRA_USERNAME",
      "JIRA_TOKEN",
      "JIRA_PROJECT",
      "PROJECT",
    ];
    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    );

    if (missingEnvVars.length) {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`
      );
    }
  }

  async getAllSecurityHubIssuesInJiraProject(): Promise<IssueObject[]> {
    const searchOptions: JiraClient.SearchQuery = {};
    const query = `project = ${process.env.JIRA_PROJECT} AND labels = ${
      this.project
    } AND labels = security-hub AND status not in ("${this.jiraClosedStatuses.join(
      '","'
    )}")`;

    let totalIssuesReceived = 0;
    let allIssues: IssueObject[] = [];
    let results: JiraClient.JsonResponse;

    do {
      results = await this.jira.searchJira(query, searchOptions);
      allIssues = allIssues.concat(results.issues);
      totalIssuesReceived += results.issues.length;
      searchOptions.startAt = totalIssuesReceived;
    } while (totalIssuesReceived < results.total);

    return allIssues;
  }

  async createNewIssue(issue: IssueObject): Promise<IssueObject> {
    try {
      console.log("Creating Jira issue.");
      issue.fields.project = { key: process.env.JIRA_PROJECT };

      // add aditional labels
      issue.fields.labels.push(this.project);

      const response = await this.jira.addNewIssue(issue);
      response[
        "webUrl"
      ] = `https://${process.env.JIRA_HOST}/browse/${response.key}`;
      return response;
    } catch (e) {
      console.error("Error creating new issue:", e);
      throw e;
    }
  }

  async closeIssue(issueKey: string) {
    if (!issueKey) return;
    try {
      console.log("need to close jira issue:", issueKey);

      const transitions = await this.jira.listTransitions(issueKey);
      const doneTransition = transitions.transitions.find(
        (t: { name: string }) => t.name === "Done"
      );
      const doneTransitionId = doneTransition ? doneTransition.id : undefined;

      if (!doneTransition) {
        console.error(`Cannot find "Done" transition for issue ${issueKey}`);
        return;
      }

      await this.jira.transitionIssue(issueKey, {
        transition: { id: doneTransition.id },
      });
      console.log(`Issue ${issueKey} has been transitioned to "Done"`);
    } catch (error) {
      console.error(
        `Failed to transition issue ${issueKey} to "Done": ${error}`
      );
    }
  }
}
