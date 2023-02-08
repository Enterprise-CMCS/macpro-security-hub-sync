import JiraClient, { IssueObject } from "jira-client";
import * as dotenv from "dotenv";
import { Logger } from "./error-lib";

dotenv.config();

export class Jira {
  private readonly jira;
  jiraClosedStatuses: string[];

  constructor() {
    Jira.checkEnvVars();

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

  async getAllSecurityHubIssuesInJiraProject(
    identifyingLabels: string[]
  ): Promise<IssueObject[]> {
    // think reduce not map
    const labelQuery = identifyingLabels.reduce(
      (accumulator, currentValue) =>
        accumulator + `AND labels = ${currentValue} `,
      ""
    );
    const searchOptions: JiraClient.SearchQuery = {};
    const query = `project = ${
      process.env.JIRA_PROJECT
    } AND labels = security-hub ${labelQuery} AND status not in ("${this.jiraClosedStatuses.join(
      '","'
    )}")`;

    let totalIssuesReceived = 0;
    let allIssues: IssueObject[] = [];
    let results: JiraClient.JsonResponse;
    do {
      // We  want to do everything possible to prevent matching tickets that we shouldn't
      if (!query.includes("AND labels = security-hub ")) {
        throw "ERROR:  Your query does not include the 'security-hub' label, and is too broad.  Refusing to continue";
      }
      if (!query.match(" AND labels = [0-9]{12}")) {
        throw "ERROR:  Your query does not include an AWS Account ID as a label, and is too broad.  Refusing to continue";
      }

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
