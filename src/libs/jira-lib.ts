import JiraClient, { IssueObject } from "jira-client";
import * as dotenv from "dotenv";
import { Logger } from "./error-lib";

dotenv.config();

export class Jira {
  private readonly jira;
  jiraOpenStatuses: string[];

  constructor() {
    Jira.checkEnvVars();

    this.jiraOpenStatuses = process.env.JIRA_OPEN_STATUSES
      ? process.env.JIRA_OPEN_STATUSES.split(",")
      : ["To Do", "In Progress"];

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
      "JIRA_DOMAIN",
      "JIRA_PROJECT",
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
    console.log("process.env.JIRA_PROJECT:", process.env.JIRA_PROJECT);
    const searchOptions: JiraClient.SearchQuery = {};
    const query = `project = ${
      process.env.JIRA_PROJECT
    } AND labels = security-hub AND status in ("${this.jiraOpenStatuses.join(
      '","'
    )}")`;

    console.log("query:", query);

    let totalIssuesReceived = 0;
    let allIssues: IssueObject[] = [];
    let results: JiraClient.JsonResponse;

    do {
      results = await this.jira.searchJira(query, searchOptions);
      console.log("s:", results.issues.length);
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
      const response = await this.jira.addNewIssue(issue);
      response[
        "webUrl"
      ] = `https://${process.env.JIRA_DOMAIN}/browse/${response.key}`;
      return response;
    } catch (e) {
      console.error("Error creating new issue:", e);
      throw e;
    }
  }

  async closeIssue(issueKey: string) {
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
