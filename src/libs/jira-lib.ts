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

  async getAllIssuesInProject(projectKey: string): Promise<IssueObject[]> {
    // TODO: do we need to paginate?
    // TODO: How can we filter for security hub items?  Labels?
    // TODO: What will be the unique ID for a finding over its lifetime?
    // TODO: limit to open tickets?

    // filter for open tickets
    let query = `${projectKey} and status = "Open"`;
    const results = await this.jira.searchJira(query);
    return results.issues;
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
