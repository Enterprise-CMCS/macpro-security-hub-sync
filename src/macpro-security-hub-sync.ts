import {
  reportError,
  Jira,
  SecurityHub,
  FindingWithAccountAlias,
} from "./libs";

export class SecurityHubJiraSync {
  private readonly jira = new Jira();
  private readonly securityHub = new SecurityHub();

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
    const remediation = finding.Remediation ?? {
      Recommendation: { Url: "", Text: "" },
    };
    const recommendation = remediation.Recommendation ?? {};
    delete finding.ProductFields;
    const productFields = finding.ProductFields ?? {
      ControlId: "",
      StandardsControlArn: "",
      "aws/securityhub/FindingId": "",
    };

    return (
      `
**************************************************************
__This issue was generated from Security Hub data and is managed through automation.__
Please do not edit the title or body of this issue, or remove the security-hub label.  All other edits/comments are welcome.
Finding Title: ${finding.Title}
**************************************************************

## Type of Issue:

- [x] Security Hub Finding

## Id:

${finding.Id}

## GeneratorId:

${finding.GeneratorId}

## Title:

${finding.Title}

## Description

${finding.Description}

## Remediation

${recommendation.Url}
${recommendation.Text}

## AC:

- All findings of this type are resolved or suppressed, indicated by a Workflow Status of Resolved or Suppressed.  (Note:  this issue will automatically close when the AC is met.)\n` +
      `AwsAccountId: ${finding.AwsAccountId}\n` +
      `AwsAccountAlias: ${finding.accountAlias}\n` +
      `Types: ${finding.Types}\n` +
      `Severity: ${JSON.stringify(finding.Severity)}\n` +
      `ControlId: ${productFields.ControlId}\n` +
      `StandardsControlArn: ${productFields.StandardsControlArn}\n` +
      `ProductFields: ${productFields["aws/securityhub/FindingId"]}\n` +
      `AwsAccountId: ${finding.AwsAccountId}\n` +
      `SecurityHubFindingUrl: ${this.createSecurityHubFindingUrl(
        productFields.StandardsControlArn
      )}\n`
    );
  }

  createSecurityHubFindingUrl(standardsControlArn: string) {
    const [
      _arn,
      partition,
      _securityhub,
      region,
      _accountId,
      _control,
      securityStandards,
      _v,
      securityStandardsVersion,
      controlId,
    ] = standardsControlArn.split(/[/:]+/);
    return `https://${region}.console.${partition}.amazon.com/securityhub/home?region=${region}#/standards/${securityStandards}-${securityStandardsVersion}/${controlId}`;
  }

  async createJiraIssueFromFinding(finding: FindingWithAccountAlias) {
    const title = "New issue from jira-client";
    const description = "";
    const recommendationText = "";
    const recommendationUrl = "";
    const severity = finding.Severity ?? { Label: "" };

    const newIssueData = {
      fields: {
        project: {
          key: "TEST",
        },
        summary: `SecurityHub Finding - ${title}`,
        description: this.createIssueBody(finding),
        issuetype: {
          name: "Task",
        },
        labels: [
          "security-hub",
          finding.Region,
          severity.Label,
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
    region: "us-east-1",
    severity: ["CRITICAL"],
  });

  await mySync.sync();
}

testing();
