import {
  reportError,
  Jira,
  SecurityHub,
  FindingWithAccountAlias,
} from "./libs";

export class SecurityHubJiraSync {
  private readonly jira = new Jira();
  private readonly securityHub;

  constructor({
    region = "us-east-1",
    severities = ["HIGH", "CRITICAL"],
  } = {}) {
    this.securityHub = new SecurityHub({ region, severities });
  }

  async sync() {
    // 1. Get all Security Hub issues from Jira for this AWS Account
    const jiraIssues = await this.jira.getAllSecurityHubIssuesInJiraProject(
      "TEST"
    );

    // 2. Get all current findings from Security Hub in this AWS account
    const shFindings: FindingWithAccountAlias[] =
      await this.securityHub.getAllActiveFindings();

    [
      // 3. Close existing Jira issues if their finding is no longer active/current

      // 4. Create Jira issue for current findings that do not already have a Jira issue
      shFindings[0],
    ].map((finding) => {
      console.log("finding:", JSON.stringify(finding, null, 2));
      this.createJiraIssueFromFinding(finding);
    });
  }

  createIssueBody(finding: FindingWithAccountAlias) {
    const {
      Remediation,
      Title,
      Description,
      Id,
      GeneratorId,
      AwsAccountId,
      accountAlias,
      Types,
      Severity,
    } = finding;

    const remediation = Remediation || {
      Recommendation: {},
    };
    const { Recommendation = {} } = remediation;
    const { Url = "", Text = "" } = Recommendation;
    const {
      ControlId = "",
      StandardsControlArn = "",
      "aws/securityhub/FindingId": findingId = "",
    } = finding.ProductFields || {};

    return `
      **************************************************************
      __This issue was generated from Security Hub data and is managed through automation.__
      Please do not edit the title or body of this issue, or remove the security-hub label.  All other edits/comments are welcome.
      Finding Title: ${Title}
      **************************************************************

      ## Type of Issue:

      - [x] Security Hub Finding

      ## Id:

      ${Id}

      ## GeneratorId:

      ${GeneratorId}

      ## Title:

      ${Title}

      ## Description

      ${Description}

      ## Remediation

      ${Url}
      ${Text}

      ## AC:

      - All findings of this type are resolved or suppressed, indicated by a Workflow Status of Resolved or Suppressed.  (Note:  this issue will automatically close when the AC is met.)\n
      AwsAccountId: ${AwsAccountId}\n
      AwsAccountAlias: ${accountAlias}\n
      Types: ${Types}\n
      Severity: ${JSON.stringify(Severity)}\n
      ControlId: ${ControlId}\n
      StandardsControlArn: ${StandardsControlArn}\n
      FindingId: ${findingId}\n`;
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

  async createJiraIssueFromFinding(finding: FindingWithAccountAlias) {
    const title = "New issue from jira-client"; // TODO
    const { Label: severity = "" } = finding.Severity || {};

    const newIssueData = {
      fields: {
        project: { key: "TEST" },
        summary: `SecurityHub Finding - ${finding.Title}`,
        description: this.createIssueBody(finding),
        issuetype: { name: "Task" },
        labels: [
          "security-hub",
          finding.Region,
          severity,
          finding.accountAlias,
        ],
      },
    };
    const newIssueInfo = await this.jira.createNewIssue(newIssueData);
    console.log("newIssueInfo:", newIssueInfo);
  }
}

async function testing() {
  const mySync = new SecurityHubJiraSync({
    // region: "us-east-1",
    // severities: ["HIGH"],
  });

  await mySync.sync();
}

testing();
