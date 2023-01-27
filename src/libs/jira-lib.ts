

// const issues = await this.jira.getIssuesForEpic("none");

// console.log("issues:", issues);

// interface Issue {
//   labels: any[];
//   title: string;
//   state: string;
//   body: string;
//   number: any;
// }

//updateJiraIssue
//     // TODO: update this GitHub logic to Jira logic
//     // await this.octokit.rest.issues.update({
//     //   ...this.octokitRepoParams,
//     //   ...issueParams,
//     //   issue_number: issue.number,
//     // });

// createJiraIssue
//   // TODO: update this GitHub logic to Jira logic
//   // await this.octokit.rest.issues.create({
//   //   ...this.octokitRepoParams,
//   //   ...this.issueParamsForFinding(finding),
//   // });
//   // Due to github secondary rate limiting, we will take a 5s pause after creating issues.
//   // See: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#secondary-rate-limits
//   await new Promise((resolve) => setTimeout(resolve, 5000));
