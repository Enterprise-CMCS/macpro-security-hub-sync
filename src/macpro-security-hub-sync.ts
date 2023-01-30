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
    const { Label: severity = "" } = finding.Severity || {};

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

    return (
      "----\n" +
      "\n" +
      "*This issue was generated from Security Hub data and is managed through automation.*\n" +
      "Please do not edit the title or body of this issue, or remove the security-hub tag.  All other edits/comments are welcome.\n" +
      `Finding Title: ${Title}\n` +
      "\n" +
      "----\n" +
      "\n" +
      "h2. Type of Issue:\n" +
      "\n" +
      "* Security Hub Finding\n" +
      "\n" +
      "h2. Title:\n" +
      "\n" +
      Title +
      "\n" +
      "h2. Description:\n" +
      "\n" +
      Description +
      "\n" +
      "\n" +
      "h2. Remediation:\n" +
      "\n" +
      Url +
      "\n" +
      Text +
      "\n" +
      "\n" +
      "h2. AWS Account:\n" +
      `${AwsAccountId} (${accountAlias})\n` +
      "\n\n" +
      "Severity:\n" +
      `${severity}\n` +
      "\n" +
      "h2. SecurityHubFindingUrl:\n" +
      `${this.createSecurityHubFindingUrl(StandardsControlArn)}\n` +
      "\n" +
      "\n" +
      "h2. AC:\n" +
      "\n" +
      "* All findings of this type are resolved or suppressed, indicated by a Workflow Status of Resolved or Suppressed.  (Note:  this ticket will automatically close when the AC is met.)"
    );
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
