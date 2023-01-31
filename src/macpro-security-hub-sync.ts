import { Jira, SecurityHub, OurFindingType } from "./libs";
import { Remediation } from "@aws-sdk/client-securityhub";
import { IssueObject } from "jira-client";

interface SecurityHubJiraSyncOptions {
  region?: string;
  severities?: string[];
  jiraOpenStatuses?: string[];
}

export class SecurityHubJiraSync {
  private readonly jira: Jira;
  private readonly securityHub: SecurityHub;
  private readonly jiraOpenStatuses: string[];
  private readonly jiraProjectName: string;

  constructor(
    jira_project_name: string,
    options: Partial<{
      region: string;
      severities: string[];
      jira_open_statuses: string[];
    }> = {}
  ) {
    const region = options.region || "us-east-1";
    const severities = options.severities || ["HIGH", "CRITICAL"];
    const jira_open_statuses = options.jira_open_statuses || [
      "To Do",
      "In Progress",
    ];
    this.jira_project_name = jira_project_name;
    this.securityHub = new SecurityHub({ region, severities });
    this.jira_open_statuses = jira_open_statuses;
  }

  async sync() {
    // Step 1. Get all Security Hub issues from Jira for this AWS Account, and for now filter to open statuses (TODO: discuss with the team)
    const jiraIssues = (
      await this.jira.getAllSecurityHubIssuesInJiraProject(
        this.jira_project_name
      )
    ).filter((issue) =>
      this.jira_open_statuses.includes(issue.fields.status.name)
    );

    // console.log(
    //   "all current statuses on security hub issues:",
    //   new Set(jiraIssues.map((i) => i.fields.status.name))
    // );

    // Step 2. Get all current findings from Security Hub in this AWS account
    const shFindings: FindingWithAccountAlias[] =
      await this.securityHub.getAllActiveFindings();

    // Step 3. Close existing Jira issues if their finding is no longer active/current
    this.closeIssuesForResolvedFindings(jiraIssues, shFindings);

    // Step 4. Create Jira issue for current findings that do not already have a Jira issue
    const existingJiraIssueTitles = Array.from(
      new Set(jiraIssues.map((i) => i.fields.summary))
    );

    const uniqueSecurityHubFindings = [
      ...new Set(
        shFindings.map((finding) =>
          JSON.stringify(this.extractDesiredFieldsFromFinding(finding))
        )
      ),
    ].map((finding) => JSON.parse(finding));

    uniqueSecurityHubFindings
      .filter(
        (finding) =>
          !existingJiraIssueTitles.includes(
            "SecurityHub Finding - " + finding.Title
          )
      )
      .map((finding) => this.createJiraIssueFromFinding(finding));
  }

  closeIssuesForResolvedFindings(
    jiraIssues: IssueObject[],
    shFindings: FindingWithAccountAlias[]
  ) {
    const expectedJiraIssueTitles = Array.from(
      new Set(
        shFindings.map((finding) => `SecurityHub Finding - ${finding.Title}`)
      )
    );

    // close all security-hub labeled Jira issues that do not have an active finding
    jiraIssues
      .filter((issue) =>
        this.jira_open_statuses.includes(issue.fields.status.name)
      )
      .map((issue) => {
        if (!expectedJiraIssueTitles.includes(issue.fields.summary))
          this.jira.closeIssue(issue.key);
      });
  }

  createIssueBody(finding: FindingWithAccountAliasPartial) {
    const {
      Remediation: { Recommendation: { Url = "", Text = "" } = {} } = {},
      Title = "",
      Description = "",
      accountAlias = "",
      AwsAccountId = "",
      Severity = "",
      StandardsControlArn = "",
    } = finding;

    return `----

      *This issue was generated from Security Hub data and is managed through automation.*
      Please do not edit the title or body of this issue, or remove the security-hub tag.  All other edits/comments are welcome.
      Finding Title: ${Title}

      ----

      h2. Type of Issue:

      * Security Hub Finding

      h2. Title:

      ${Title}

      h2. Description:

      ${Description}

      h2. Remediation:

      ${Url}
      ${Text}

      h2. AWS Account:
      ${AwsAccountId} (${accountAlias})

      h2. Severity:
      ${Severity}

      h2. SecurityHubFindingUrl:
      ${this.createSecurityHubFindingUrl(StandardsControlArn)}

      h2. AC:

      * All findings of this type are resolved or suppressed, indicated by a Workflow Status of Resolved or Suppressed.  (Note:  this ticket will automatically close when the AC is met.)`;
  }

  createSecurityHubFindingUrl(standardsControlArn = "") {
    if (!standardsControlArn) {
      return "";
    }

    const [
      ,
      partition,
      ,
      region,
      ,
      ,
      securityStandards,
      ,
      securityStandardsVersion,
      controlId,
    ] = standardsControlArn.split(/[/:]+/);
    return `https://${region}.console.${partition}.amazon.com/securityhub/home?region=${region}#/standards/${securityStandards}-${securityStandardsVersion}/${controlId}`;
  }

  async createJiraIssueFromFinding(finding: FindingWithAccountAliasPartial) {
    const newIssueData = {
      fields: {
        project: { key: this.jiraProjectName },
        summary: `SecurityHub Finding - ${finding.title}`,
        description: this.createIssueBody(finding),
        issuetype: { name: "Task" },
        labels: [
          "security-hub",
          finding.region,
          finding.severity,
          finding.accountAlias,
        ],
      },
    };
    const newIssueInfo = await this.jira.createNewIssue(newIssueData);
    console.log("new Jira issue created:", newIssueInfo);
  }
}

async function testing() {
  // severities: ["MEDIUM"]
  await new SecurityHubJiraSync("TES5", {}).sync();
}

testing();
