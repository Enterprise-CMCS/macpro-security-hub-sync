import JiraClient, { IssueObject } from "jira-client";
import * as dotenv from "dotenv";

dotenv.config();

export class Jira {
  jira = new JiraClient({
    protocol: "https",
    host: process.env.JIRA_HOST!,
    port: "443",
    username: process.env.JIRA_USERNAME,
    password: process.env.JIRA_TOKEN,
    apiVersion: "2",
    strictSSL: true,
  });

  // const issues = await this.jira.getIssuesForEpic("none");
  // console.log("issues:", issues);

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
      return await this.jira.addNewIssue(issue);
    } catch (e) {
      console.error("Error creating new issue:", e);
      throw e;
    }
  }
}
