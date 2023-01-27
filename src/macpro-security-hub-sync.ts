import { reportError } from "./libs/error-lib";
import { Jira } from "./libs/jira-lib";
// import { SecurityHub } from "./libs/security-hub-lib";

const findingTitleRegex = /(?<=\nFinding Title: ).*/g;

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

export class SecurityHubJiraSync {
  private accountAlias: string = "";
  private jira = new Jira();
  // private securityHub = new SecurityHub({
  //   region: "us-east-1",
  //   severities: ["HIGH", "CRITICAL", "MEDIUM"],
  // });

  constructor(options: { severity?: string[]; region?: string }) {
    this.testing();
  }

  async testing() {
    // const test = await this.securityHub.getAllActiveFindings();
    const blah = await this.jira.createNewIssue({ projectKey: "TEST" });
    console.log("blah:", blah);
    const test = await this.jira.getAllIssuesInProject("TEST");
    console.log("test:", test.length);
  }

  async sync() {
    // if (!this.accountAlias) {
    //   this.accountAlias = await this.getAccountAlias();
    //   console.log("this.accountAlias:", this.accountAlias);
    // }
    // const findings = await this.getAllActiveFindings();
    // const issues = await this.getAllIssues();
    // console.log("issues:", issues);
    // await this.closeIssuesWithoutAnActiveFinding(findings, issues);
    // await this.createOrUpdateIssuesBasedOnFindings(findings, issues);
  }

  issueParamsForFinding(finding: Finding) {
    return {
      title: `SecurityHub Finding - ${finding.Title}`,
      state: "open",
      labels: [
        "security-hub",
        // this.region,
        finding.Severity,
        // this.accountAlias,
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

  // async closeIssuesWithoutAnActiveFinding(
  //   findings: Finding[]
  //   issues: Issue[]
  // ) {
  //   console.log(
  //     `******** Discovering and closing any open Jira Issues without an underlying, active Security Hub finding. ********`
  //   );

  //   // Store all finding ids in an array
  //   const findingsTitles = findings.map((finding) => finding.Title);

  //   console.log("TODO findingsTitles:", findingsTitles);

  //   // Search for open issues that do not have a corresponding active SH finding.
  //   for (let i = 0; i < issues.length; i++) {
  //     const issue = issues[i];
  //     if (issue.state !== "open") continue; // We only care about open issues here.
  //     const issueTitle = issue.body.match(findingTitleRegex);
  //     if (issueTitle && findingsTitles.includes(issueTitle[0])) {
  //       console.log(
  //         `Issue ${issue.number}:  Underlying finding found.  Doing nothing...`
  //       );
  //     } else {
  //       console.log(
  //         `Issue ${issue.number}:  No underlying finding found.  Closing issue...`
  //       );
  //       // TODO: update this GitHub logic to Jira logic
  //       // await this.octokit.rest.issues.update({
  //       //   ...this.octokitRepoParams,
  //       //   issue_number: issue.number,
  //       //   state: "closed",
  //       // });
  //     }
  //   }
  // }

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
        // TODO:
        // await this.updateJiraIssue(finding, matchingIssue);
      } else {
        console.log(
          `Finding ${finding.Title}:  No issue found for finding.  Creating issue...`
        );
        // TODO:
        // await this.createJiraIssue(finding);
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

  // console.log(await mySync.sync());
}

TODO_temp_testing();
