import {
  SecurityHubClient,
  GetFindingsCommand,
  AwsSecurityFindingFilters,
  AwsSecurityFinding,
} from "@aws-sdk/client-securityhub";
import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import JiraApi from "jira-client";
import { reportError } from "./libs/error-lib";
import * as dotenv from "dotenv";

const findingTitleRegex = /(?<=\nFinding Title: ).*/g;
dotenv.config();
// TODO: figure out types of everything being used.
interface Finding {
  Remediation: any;
  Title: string;
  Description: string;
  Severity: any;
  Region: string;
  Recommendation: { Url: string; Text: string };
  Id: string;
}

interface Issue {
  labels: any[];
  title: string;
  state: string;
  body: string;
  number: any;
}

export class SecurityHubJiraSync {
  private severity: string[];
  private region: string;
  private accountAlias: string = "";
  jira: JiraApi;

  constructor(options: { severity?: string[]; region?: string }) {
    this.severity = options.severity || ["HIGH", "CRITICAL"];
    this.region = options.region || "us-east-1";
    this.jira = new JiraApi({
      protocol: "https",
      host: process.env.JIRA_HOST!,
      username: process.env.JIRA_USERNAME,
      password: process.env.JIRA_TOKEN,
      apiVersion: "2",
      strictSSL: true,
    });
  }

  private async getAccountAlias() {
    try {
      const stsClient = new IAMClient({ region: this.region });
      const aliases = (await stsClient.send(new ListAccountAliasesCommand({})))
        .AccountAliases;
      if (aliases && aliases[0]) return aliases[0];
      else return "";
    } catch (e) {
      reportError(e);
      return "";
    }
  }

  async sync() {
    if (!this.accountAlias) {
      this.accountAlias = await this.getAccountAlias();
      console.log("this.accountAlias:", this.accountAlias);
    }

    const findings = await this.getAllActiveFindings();
    const issues = await this.getAllIssues();
    console.log("issues:", issues);
    await this.closeIssuesWithoutAnActiveFinding(findings, issues);
    await this.createOrUpdateIssuesBasedOnFindings(findings, issues);
  }

  async getAllActiveFindings() {
    try {
      const client = new SecurityHubClient({ region: this.region });
      const severityLabels = this.severity.map((label) => ({
        Comparison: "EQUALS",
        Value: label,
      }));
      const filters = {
        RecordState: [{ Comparison: "EQUALS", Value: "ACTIVE" }],
        WorkflowStatus: [
          { Comparison: "EQUALS", Value: "NEW" },
          { Comparison: "EQUALS", Value: "NOTIFIED" },
        ],
        ProductName: [{ Comparison: "EQUALS", Value: "Security Hub" }],
        SeverityLabel: severityLabels,
      };

      const findings = await this.getAllResultsFromPagination(client, filters);

      const formattedFindings = findings.map((finding) => {
        return {
          Title: finding.Title,
          Description: finding.Description,
          Severity: finding.Severity && finding.Severity.Label,
          Region: finding.Region,
          Recommendation:
            finding.Remediation && finding.Remediation.Recommendation,
        };
      });

      const uniqueFindings = [
        ...new Set(formattedFindings.map((finding) => finding.Title)),
      ].map((title) => {
        return formattedFindings.find((finding) => finding.Title === title);
      });

      return uniqueFindings;
    } catch (e) {
      reportError(e);
      return [];
    }
  }

  async getAllResultsFromPagination(
    client: SecurityHubClient,
    filters: AwsSecurityFindingFilters,
    nextToken: string | undefined = undefined
  ): Promise<AwsSecurityFinding[]> {
    const response = await client.send(
      new GetFindingsCommand({
        Filters: filters,
        MaxResults: 100,
        NextToken: nextToken,
      })
    );
    const findings = response.Findings;
    if (response.NextToken) {
      if (findings)
        return findings.concat(
          await this.getAllResultsFromPagination(
            client,
            filters,
            response.NextToken
          )
        );
      else return [];
    } else {
      return findings || [];
    }
  }

  // async createSampleIssues() {
  //   const data = new JiraApi.issu();
  //   await this.jira.addNewIssue();
  // }

  async getAllIssues() {
    // let issues: never[] = [];

    const issues = await this.jira.getIssuesForEpic("none");

    console.log("issues:", issues);

    // TODO: update this GitHub logic to Jira logic
    // for await (const response of this.octokit.paginate.iterator(
    //   this.octokit.rest.issues.listForRepo,
    //   {
    //     ...this.octokitRepoParams,
    //     state: "all",
    //     labels: ["security-hub", this.region, this.accountAlias],
    //   }
    // )) {
    //   issues.push(...response.data);
    // }
    return issues;
  }

  issueParamsForFinding(finding: Finding) {
    return {
      title: `SecurityHub Finding - ${finding.Title}`,
      state: "open",
      labels: [
        "security-hub",
        this.region,
        finding.Severity,
        this.accountAlias,
      ],
      body: `**************************************************************
    __This issue was generated from Security Hub data and is managed through automation.__
    Please do not edit the title or body of this issue, or remove the security-hub tag.  All other edits/comments are welcome.
    Finding Title: ${finding.Title}
    **************************************************************

  ## Type of Issue:

  - [x] Security Hub Finding

  ## Title:

  ${finding.Title}

  ## Description

  ${finding.Description}

  ## Remediation

  ${finding.Recommendation.Url}
  ${finding.Recommendation.Text}

  ## AC:

  - All findings of this type are resolved or suppressed, indicated by a Workflow Status of Resolved or Suppressed.  (Note:  this issue will automatically close when the AC is met.)
        `,
    };
  }

  async createJiraIssue(finding: Finding) {
    console.log("TODO: create Jira issue.");
    console.log("finding:", finding);

    // TODO: update this GitHub logic to Jira logic
    // await this.octokit.rest.issues.create({
    //   ...this.octokitRepoParams,
    //   ...this.issueParamsForFinding(finding),
    // });
    // Due to github secondary rate limiting, we will take a 5s pause after creating issues.
    // See: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#secondary-rate-limits
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  async updateJiraIssue(finding: Finding, issue: Issue) {
    let issueParams = this.issueParamsForFinding(finding);
    let issueLabels: (string | null)[] = [];
    issue.labels.forEach((label) => {
      issueLabels.push(label.name);
    });
    if (
      issue.title != issueParams.title ||
      issue.state != issueParams.state ||
      issue.body != issueParams.body ||
      !issueParams.labels.every((v) => issueLabels.includes(v || ""))
    ) {
      console.log(`Issue ${issue.number}:  drift detected.  Updating issue...`);
      // TODO: update this GitHub logic to Jira logic
      // await this.octokit.rest.issues.update({
      //   ...this.octokitRepoParams,
      //   ...issueParams,
      //   issue_number: issue.number,
      // });
    } else {
      console.log(
        `Issue ${issue.number}:  Issue is up to date.  Doing nothing...`
      );
    }
  }

  async closeIssuesWithoutAnActiveFinding(
    findings: Finding[],
    issues: Issue[]
  ) {
    console.log(
      `******** Discovering and closing any open Jira Issues without an underlying, active Security Hub finding. ********`
    );

    // Store all finding ids in an array
    const findingsTitles = findings.map((finding) => finding.Title);

    console.log("TODO findingsTitles:", findingsTitles);

    // Search for open issues that do not have a corresponding active SH finding.
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      if (issue.state !== "open") continue; // We only care about open issues here.
      const issueTitle = issue.body.match(findingTitleRegex);
      if (issueTitle && findingsTitles.includes(issueTitle[0])) {
        console.log(
          `Issue ${issue.number}:  Underlying finding found.  Doing nothing...`
        );
      } else {
        console.log(
          `Issue ${issue.number}:  No underlying finding found.  Closing issue...`
        );
        // TODO: update this GitHub logic to Jira logic
        // await this.octokit.rest.issues.update({
        //   ...this.octokitRepoParams,
        //   issue_number: issue.number,
        //   state: "closed",
        // });
      }
    }
  }

  async createOrUpdateIssuesBasedOnFindings(findings: any[], issues: any[]) {
    console.log(
      `******** Creating or updating Jira Issues based on Security Hub findings. ********`
    );
    findings.forEach(async (finding) => {
      const matchingIssue = issues.find((issue) => {
        const issueTitle = issue.body.match(findingTitleRegex);
        return finding.Title === issueTitle;
      });

      if (matchingIssue) {
        console.log(
          `Finding ${finding.Title}:  Issue ${matchingIssue.number} found for finding.  Checking it's up to date...`
        );
        await this.updateJiraIssue(finding, matchingIssue);
      } else {
        console.log(
          `Finding ${finding.Title}:  No issue found for finding.  Creating issue...`
        );
        await this.createJiraIssue(finding);
      }
    });
  }
}

async function TODO_temp_testing() {
  console.log("hi");

  const mySync = new SecurityHubJiraSync({
    region: "us-east-1",
    severity: ["CRITICAL", "HIGH", "MEDIUM"],
  });

  console.log(await mySync.sync());
}

TODO_temp_testing();
