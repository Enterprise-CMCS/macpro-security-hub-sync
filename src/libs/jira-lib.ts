import JiraClient, { IssueObject, JiraApiOptions } from "jira-client";
import * as dotenv from "dotenv";
import axios from "axios";

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
    const jiraParams: JiraApiOptions = {
      protocol: "https",
      host: process.env.JIRA_HOST!,
      port: "443",
      username: process.env.JIRA_USERNAME,
      apiVersion: "2",
      strictSSL: true,
    }
    if(process.env.JIRA_HOST?.includes("jiraent")){
      jiraParams.bearer = process.env.JIRA_TOKEN;
    } else {
      jiraParams.password = process.env.JIRA_TOKEN;
    }
    this.jira = new JiraClient(jiraParams);
  }

  async removeCurrentUserAsWatcher(issueKey: string) {
    try {
      const currentUser = await this.jira.getCurrentUser();

      // Remove the current user as a watcher
      await axios({
        method: "DELETE",
        url: `https://${process.env.JIRA_HOST}/rest/api/3/issue/${issueKey}/watchers`,
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.JIRA_USERNAME}:${process.env.JIRA_TOKEN}`
          ).toString("base64")}`,
        },
        params: {
          accountId: currentUser.accountId,
        },
      });
    } catch (err) {
      console.error("Error creating issue or removing watcher:", err);
    }
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
    console.log(fullQuery,searchOptions);
    try {
      do {
        const user = await this.jira.getCurrentUser();
        console.log(user)
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
      issue.fields.project = { key: process.env.JIRA_PROJECT };

      const newIssue = await this.jira.addNewIssue(issue);
      newIssue[
        "webUrl"
      ] = `https://${process.env.JIRA_HOST}/browse/${newIssue.key}`;
      await this.removeCurrentUserAsWatcher(newIssue.key);
      return newIssue;
    } catch (e: any) {
      throw new Error(`Error creating Jira issue: ${e.message}`);
    }
  }

  async closeIssue(issueKey: string) {
    if (!issueKey) return;
    try {
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
    } catch (e: any) {
      throw new Error(`Error closing issue ${issueKey}: ${e.message}`);
    }
  }
}
