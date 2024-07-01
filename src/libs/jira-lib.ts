import JiraClient, {
  IssueObject,
  JiraApiOptions,
  TransitionObject,
} from "jira-client";
import * as dotenv from "dotenv";
import axios, { AxiosHeaderValue, AxiosHeaders } from "axios";

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
    };
    if (process.env.JIRA_HOST?.includes("jiraent")) {
      jiraParams.bearer = process.env.JIRA_TOKEN;
    } else {
      jiraParams.password = process.env.JIRA_TOKEN;
    }
    this.jira = new JiraClient(jiraParams);
  }
  async doesUserExist(accountId: string): Promise<boolean> {
    try {
      const user = await this.jira.getUser(accountId, "groups");
      // User exists
      return true;
    } catch (err: any) {
      if (err.statusCode === 404) {
        // User does not exist
        return false;
      } else {
        try {
          const user = await this.jira.searchUsers({
            username: accountId,
            query: "",
          });
          return true;
        } catch (e: any) {
          // Handle other errors if needed
          console.error(err);
          return false;
        }
        // Handle other errors if needed
        console.error(err);
        return false;
      }
    }
  }
  async removeCurrentUserAsWatcher(issueKey: string) {
    try {
      const currentUser = await this.jira.getCurrentUser();

      // Remove the current user as a watcher
      const axiosHeader = {
        Authorization: "",
      };
      if (process.env.JIRA_HOST?.includes("jiraent")) {
        axiosHeader["Authorization"] = `Bearer ${process.env.JIRA_TOKEN}`;
      } else {
        axiosHeader["Authorization"] = `Basic ${Buffer.from(
          `${process.env.JIRA_USERNAME}:${process.env.JIRA_TOKEN}`
        ).toString("base64")}`;
      }
      await axios({
        method: "DELETE",
        url: `https://${process.env.JIRA_HOST}/rest/api/3/issue/${issueKey}/watchers`,
        headers: axiosHeader,
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
    console.log(fullQuery, searchOptions);
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
  async getPriorityIdsInDescendingOrder(): Promise<string[]> {
    try {
      const priorities = await this.jira.listPriorities();

      // Get priority IDs in descending order
      const descendingPriorityIds = priorities.map(
        (priority: { id: any }) => priority.id
      );

      return descendingPriorityIds;
    } catch (err) {
      console.error(err);
      return [];
    }
  }
  async createNewIssue(issue: IssueObject): Promise<IssueObject> {
    try {
      const assignee = process.env.ASSIGNEE ?? "";
      if (assignee) {
        const isAssignee = await this.doesUserExist(assignee);
        if (isAssignee) {
          if (process.env.JIRA_HOST?.includes("jiraent")) {
            issue.fields.assignee = { name: assignee };
          } else {
            issue.fields.assignee = { accountId: assignee };
          }
        }
      }
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
  async linkIssues(newIssueKey: string, issueID: string, linkType = "Relates") {
    const linkData = {
      type: { name: linkType },
      inwardIssue: { key: newIssueKey },
      outwardIssue: { key: issueID },
    };

    try {
      await this.jira.issueLink(linkData);
      console.log(`Successfully linked issue ${newIssueKey} with ${issueID}`);
    } catch (error) {
      console.error("Error linking issues:", error);
    }
  }
  async updateIssueTitleById(
    issueId: string,
    updatedIssue: Partial<IssueObject>
  ) {
    try {
      const response = await this.jira.updateIssue(issueId, updatedIssue);
      console.log("Issue title updated successfully:", response);
    } catch (error) {
      console.error("Error updating issue title:", error);
    }
  }
  async addCommentToIssueById(issueId: string, comment: string) {
    try {
      const response = await this.jira.addComment(issueId, comment);
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  }
  async findPathToClosure(transitions: any, currentStatus: string) {
    const visited = new Set();
    const queue: { path: string[]; status: string }[] = [
      { path: [], status: currentStatus },
    ];

    while (queue.length > 0) {
      const { path, status } = queue.shift()!;
      visited.add(status);

      const possibleTransitions = transitions.filter(
        (transition: { from: { name: string } }) =>
          transition.from.name === status
      );

      for (const transition of possibleTransitions) {
        const newPath = [...path, transition.id];
        const newStatus = transition.to.name;

        if (
          newStatus.toLowerCase().includes("close") ||
          newStatus.toLowerCase().includes("done")
        ) {
          return newPath; // Found a path to closure
        }

        if (!visited.has(newStatus)) {
          queue.push({ path: newPath, status: newStatus });
        }
      }
    }

    return []; // No valid path to closure found
  }
  async completeWorkflow(issueKey: string) {
    const opposedStatuses = ["canceled", "backout", "rejected"];
    try {
      const issue = await this.jira.findIssue(issueKey);
      const processedTransitions: string[] = [];
      do {
        const availableTransitions = await this.jira.listTransitions(issueKey);
        if (availableTransitions.transitions.length > 0) {
          const targetTransitions = availableTransitions.transitions.filter(
            (transition: { name: string }) =>
              !opposedStatuses.includes(transition.name.toLowerCase()) &&
              !processedTransitions.includes(transition.name.toLowerCase())
          );
          if (targetTransitions.length <= 0) {
            if (!processedTransitions.length) {
              throw new Error("Unsupported workflow; no transition available");
            }
            const lastStatus =
              processedTransitions[
                processedTransitions.length - 1
              ].toLowerCase();
            const doneStatuses = ["done", "closed", "close", "complete"];
            if (!doneStatuses.includes(lastStatus)) {
              throw new Error(
                "Unsupported Workflow: does not contain any of " +
                  doneStatuses.join(",") +
                  "statuses"
              );
            }
            break;
          }
          const transitionId = targetTransitions[0].id;
          processedTransitions.push(targetTransitions[0].name.toLowerCase());
          await this.jira.transitionIssue(issueKey, {
            transition: { id: transitionId },
          });
          console.log(
            `Transitioned issue ${issueKey} to the next stage: ${targetTransitions[0].name}`
          );
        } else {
          break;
        }
      } while (true);
    } catch (e) {
      console.log("Error completing the workflow ", e);
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
        this.completeWorkflow(issueKey);
        return;
      }

      await this.jira.transitionIssue(issueKey, {
        transition: { id: doneTransition.id },
      });
    } catch (e: any) {
      throw new Error(`Error closing issue ${issueKey}: ${e.message}`);
    }
  }
}
