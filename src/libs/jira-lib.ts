import JiraClient, { IssueObject } from "jira-client";
import * as dotenv from "dotenv";

dotenv.config();

export class Jira {
  private readonly jira;
  jiraClosedStatuses: string[];

  constructor() {
    Jira.checkEnvVars();

    this.jiraClosedStatuses = process.env.JIRA_CLOSED_STATUSES
      ? process.env.JIRA_CLOSED_STATUSES.split(",").map((status) =>
          status.trim()
        )
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

  private static formatLabelQuery(label: string): string {
    return `labels = '${label}'`;
  }

  async getAllSecurityHubIssuesInJiraProject(
    identifyingLabels: string[]
  ): Promise<IssueObject[]> {
    const labelQueries = [...identifyingLabels, "security-hub"].map((label) =>
      Jira.formatLabelQuery(label)
    );
    const projectQuery = `project = '${process.env.JIRA_PROJECT}'`;
    const statusQuery = `status not in ('${this.jiraClosedStatuses.join(
      "','" // wrap each closed status in single quotes
    )}')`;
    const fullQuery = [...labelQueries, projectQuery, statusQuery].join(
      " AND "
    );
    // We  want to do everything possible to prevent matching tickets that we shouldn't
    if (!fullQuery.includes(Jira.formatLabelQuery("security-hub"))) {
      throw new Error(
        "ERROR:  Your query does not include the 'security-hub' label, and is too broad.  Refusing to continue"
      );
    }
    if (!fullQuery.match(Jira.formatLabelQuery("[0-9]{12}"))) {
      throw new Error(
        "ERROR:  Your query does not include an AWS Account ID as a label, and is too broad.  Refusing to continue"
      );
    }

    let totalIssuesReceived = 0;
    let allIssues: IssueObject[] = [];
    let results: JiraClient.JsonResponse;
    const searchOptions: JiraClient.SearchQuery = {};
    try {
      do {
        results = await this.jira.searchJira(fullQuery, searchOptions);
        allIssues = allIssues.concat(results.issues);
        totalIssuesReceived += results.issues.length;
        searchOptions.startAt = totalIssuesReceived;
      } while (totalIssuesReceived < results.total);
    } catch (e: any) {
      throw new Error(
        `Error getting Security Hub issues from Jira: ${e.message}`
      );
    }
    return allIssues;
  }

  async createNewIssue(issue: IssueObject): Promise<IssueObject> {
    try {
      console.log("Creating Jira issue");

      issue.fields.project = { key: process.env.JIRA_PROJECT };

      const response = await this.jira.addNewIssue(issue);
      response[
        "webUrl"
      ] = `https://${process.env.JIRA_HOST}/browse/${response.key}`;
      return response;
    } catch (e: any) {
      throw new Error(`Error creating Jira issue: ${e.message}`);
    }
  }

  async closeIssue(issueKey: string) {
    if (!issueKey) return;
    try {
      console.log("Need to close Jira issue:", issueKey);
      const transitions = await this.jira.listTransitions(issueKey);
      const doneTransition = transitions.transitions.find(
        (t: { name: string }) => t.name === "Done"
      );

      if (!doneTransition) {
        throw new Error(`Cannot find "Done" transition for issue ${issueKey}`);
      }

      await this.jira.transitionIssue(issueKey, {
        transition: { id: doneTransition.id },
      });
      console.log(`Issue ${issueKey} has been transitioned to "Done"`);
    } catch (e: any) {
      throw new Error(`Error closing issue ${issueKey}: ${e.message}`);
    }
  }
}
