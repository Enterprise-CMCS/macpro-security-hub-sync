import { Jira, SecurityHub, SecurityHubFinding } from "./libs";
import { IssueObject } from "jira-client";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

interface SecurityHubJiraSyncOptions {
  region?: string;
  severities?: string[];
  customJiraFields?: { [id: string]: any };
  epicKey?: string;
}

export class SecurityHubJiraSync {
  private readonly jira: Jira;
  private readonly securityHub: SecurityHub;
  private readonly customJiraFields;
  private readonly region;
  private readonly epicKey;
  constructor(options: SecurityHubJiraSyncOptions = {}) {
    const {
      region = "us-east-1",
      severities = ["MEDIUM", "HIGH", "CRITICAL"],
      customJiraFields = {},
    } = options;
    this.securityHub = new SecurityHub({ region, severities });
    this.region = region;
    this.jira = new Jira();
    this.customJiraFields = customJiraFields;
    this.epicKey = options.epicKey;
  }

  async sync() {
    // Step 0. Gather and set some information that will be used throughout this function
    const accountId = await this.getAWSAccountID();
    const identifyingLabels: string[] = [accountId, this.region];

    // Step 1. Get all open Security Hub issues from Jira
    const jiraIssues = await this.jira.getAllSecurityHubIssuesInJiraProject(
      identifyingLabels
    );

    // Step 2. Get all current findings from Security Hub
    const shFindings = await this.securityHub.getAllActiveFindings();

    // Step 3. Close existing Jira issues if their finding is no longer active/current
    await this.closeIssuesForResolvedFindings(jiraIssues, shFindings);

    // Step 4. Create Jira issue for current findings that do not already have a Jira issue
    await this.createJiraIssuesForNewFindings(
      jiraIssues,
      shFindings,
      identifyingLabels
    );
  }

  async getAWSAccountID() {
    const client = new STSClient({
      region: this.region,
    });
    const command = new GetCallerIdentityCommand({});
    let response;
    try {
      response = await client.send(command);
    } catch (e: any) {
      throw new Error(`Error getting AWS Account ID: ${e.message}`);
    }
    let accountID: string = response.Account || "";
    if (!accountID.match("[0-9]{12}")) {
      throw new Error(
        "ERROR:  An issue was encountered when looking up your AWS Account ID.  Refusing to continue."
      );
    }
    return accountID;
  }

  async closeIssuesForResolvedFindings(
    jiraIssues: IssueObject[],
    shFindings: SecurityHubFinding[]
  ) {
    const expectedJiraIssueTitles = Array.from(
      new Set(
        shFindings.map((finding) => `SecurityHub Finding - ${finding.title}`)
      )
    );
    try {
      // close all security-hub labeled Jira issues that do not have an active finding
      for (var i = 0; i < jiraIssues.length; i++) {
        if (!expectedJiraIssueTitles.includes(jiraIssues[i].fields.summary)) {
          await this.jira.closeIssue(jiraIssues[i].key);
        }
      }
    } catch (e: any) {
      throw new Error(
        `Error closing Jira issue for resolved finding: ${e.message}`
      );
    }
  }

  createIssueBody(finding: SecurityHubFinding) {
    const {
      remediation: {
        Recommendation: {
          Url: remediationUrl = "",
          Text: remediationText = "",
        } = {},
      } = {},
      title = "",
      description = "",
      accountAlias = "",
      awsAccountId = "",
      severity = "",
      standardsControlArn = "",
    } = finding;

    return `----

      *This issue was generated from Security Hub data and is managed through automation.*
      Please do not edit the title or body of this issue, or remove the security-hub tag.  All other edits/comments are welcome.
      Finding Title: ${title}

      ----

      h2. Type of Issue:

      * Security Hub Finding

      h2. Title:

      ${title}

      h2. Description:

      ${description}

      h2. Remediation:

      ${remediationUrl}
      ${remediationText}

      h2. AWS Account:
      ${awsAccountId} (${accountAlias})

      h2. Severity:
      ${severity}

      h2. SecurityHubFindingUrl:
      ${this.createSecurityHubFindingUrl(standardsControlArn)}

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

  async createJiraIssueFromFinding(
    finding: SecurityHubFinding,
    identifyingLabels: string[]
  ) {
    const newIssueData: IssueObject = {
      fields: {
        summary: `SecurityHub Finding - ${finding.title}`,
        description: this.createIssueBody(finding),
        issuetype: { name: "Task" },
        labels: [
          "security-hub",
          finding.severity,
          finding.accountAlias,
          ...identifyingLabels,
        ],
        ...this.customJiraFields,
      },
    };
    if (this.epicKey) {
      newIssueData.fields.parent = { key: this.epicKey };
    }
    let newIssueInfo;
    try {
      newIssueInfo = await this.jira.createNewIssue(newIssueData);
    } catch (e: any) {
      throw new Error(`Error creating Jira issue from finding: ${e.message}`);
    }
    console.log("New Jira issue created:", newIssueInfo);
  }

  createJiraIssuesForNewFindings(
    jiraIssues: IssueObject[],
    shFindings: SecurityHubFinding[],
    identifyingLabels: string[]
  ) {
    const existingJiraIssueTitles = jiraIssues.map((i) => i.fields.summary);
    const uniqueSecurityHubFindings = [
      ...new Set(shFindings.map((finding) => JSON.stringify(finding))),
    ].map((finding) => JSON.parse(finding));
    uniqueSecurityHubFindings
      .filter(
        (finding) =>
          !existingJiraIssueTitles.includes(
            `SecurityHub Finding - ${finding.title}`
          )
      )
      .forEach((finding) =>
        this.createJiraIssueFromFinding(finding, identifyingLabels)
      );
  }
}
