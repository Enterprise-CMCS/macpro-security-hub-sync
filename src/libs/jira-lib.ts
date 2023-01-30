import JiraClient, { IssueObject } from "jira-client";
import * as dotenv from "dotenv";

dotenv.config();

export class Jira {
  jira;

  constructor() {
    const requiredEnvVars = ["JIRA_HOST", "JIRA_USERNAME", "JIRA_TOKEN"];
    let missingEnvVars: string[] = [];
    requiredEnvVars.forEach((envVar) => {
      if (!process.env[envVar]) missingEnvVars.push(envVar);
    });
    if (missingEnvVars.length) {
      throw new Error(
        `required environment variables are not set ${missingEnvVars}`
      );
    }

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

  async getAllSecurityHubIssuesInJiraProject(
    projectKey: string
  ): Promise<IssueObject[]> {
    const searchOptions: JiraClient.SearchQuery = {};
    const query = `project = ${projectKey} AND labels = security-hub`;
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
      console.log("TODO: create Jira issue.");
      console.log("issue:", issue);
      console.log("Creating Jira issue.");

      const response = await this.jira.addNewIssue(issue);
      response[
        "webUrl"
      ] = `https://jonholman.atlassian.net/browse/${response.key}`;
      return response;
    } catch (e) {
      console.error("Error creating new issue:", e);
      throw e;
    }
  }
}
