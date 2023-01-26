import {
  SecurityHubClient,
  GetFindingsCommand,
} from "@aws-sdk/client-securityhub";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import _ from "lodash";
const findingTitleRegex = /(?<=\nFinding Title: ).*/g;

// TODO: figure out types of everything being used.
interface Finding {
  Title: string;
  Description: string;
  Severity: string;
  Region: string;
  Recommendation: string;
}
// Title;
// Severity;
// Description;
// Recommendation: { Url; Text };

export class SecurityHubJiraSync {
  private severity: string[];
  private region: string;
  private accountNickname: string | null;

  constructor(options: {
    severity?: string[];
    region?: string;
    accountNickname?: string;
  }) {
    this.severity = options.severity || ["MEDIUM", "HIGH", "CRITICAL"]; // TODO: remove MEDIUM when finished with dev.
    this.region = options.region || "us-east-1";
    this.accountNickname = options.accountNickname || null;
  }

  async sync() {
    if (!this.accountNickname) {
      const stsClient = new STSClient({ region: this.region });
      this.accountNickname =
        (await stsClient.send(new GetCallerIdentityCommand({}))).Account ??
        null;
    }
    const findings = await this.getAllActiveFindings();
    const tickets = await this.getAllTickets();
    await this.closeTicketsWithoutAnActiveFinding(findings, tickets);
    await this.createOrUpdateTicketsBasedOnFindings(findings, tickets);
  }

  async getAllActiveFindings() {
    const EMPTY = Symbol("empty");
    const res = [];
    const severityLabels: { Comparison: string; Value: string }[] = [];
    this.severity.forEach((label) => {
      severityLabels.push({
        Comparison: "EQUALS",
        Value: label,
      });
    });
    const client = new SecurityHubClient({ region: this.region });

    // TODO: update the NextToken logic below to follow a pattern like this
    // for await (const page of paginateDescribeStacks({ client }, {})) {
    //   if (page.Stacks) {
    //     stages.push(
    //       ...new Set(
    //         page.Stacks.reduce((acc: string[], stack: Stack) => {
    //           const tags = tagsListToTagDict(stack.Tags || []);
    //           if (
    //             tags["STAGE"] &&
    //             tags["PROJECT"] === process.env.PROJECT &&
    //             !ignoreStages.includes(tags["STAGE"])
    //           ) {
    //             acc.push(tags["STAGE"]);
    //           }
    //           return acc;
    //         }, [])
    //       )

    for await (const lf of (async function* () {
      let NextToken;
      do {
        const functions = await client.send(
          new GetFindingsCommand({
            Filters: {
              RecordState: [
                {
                  Comparison: "EQUALS",
                  Value: "ACTIVE",
                },
              ],
              WorkflowStatus: [
                {
                  Comparison: "EQUALS",
                  Value: "NEW",
                },
                {
                  Comparison: "EQUALS",
                  Value: "NOTIFIED",
                },
              ],
              ProductName: [
                {
                  Comparison: "EQUALS",
                  Value: "Security Hub",
                },
              ],
              SeverityLabel: severityLabels,
            },
            MaxResults: 100,
            NextToken: NextToken !== EMPTY ? NextToken : undefined,
          })
        );
        yield* functions.Findings;
        NextToken = functions.NextToken;
      } while (NextToken);
    })()) {
      console.log("TODO res:", res);
      res.push(lf);
    }
    const formattedFindings = _.map(res, function (finding) {
      return {
        Title: finding.Title,
        Description: finding.Description,
        Severity: finding.Severity.Label,
        Region: finding.Region,
        Recommendation:
          finding.Remediation && finding.Remediation.Recommendation
            ? finding.Remediation.Recommendation
            : {
                Url: "No Recommendation URL provided.",
                Text: "No Recommendation Text provided.",
              },
      };
    });
    const uniqueFindings = _.uniqBy(formattedFindings, "Title");
    return uniqueFindings;
  }

  async getAllTickets() {
    let tickets: never[] = [];
    // TODO: update this GitHub logic to Jira logic
    // for await (const response of this.octokit.paginate.iterator(
    //   this.octokit.rest.tickets.listForRepo,
    //   {
    //     ...this.octokitRepoParams,
    //     state: "all",
    //     labels: ["security-hub", this.region, this.accountNickname],
    //   }
    // )) {
    //   tickets.push(...response.data);
    // }
    return tickets;
  }

  ticketParamsForFinding(finding: Finding) {
    return {
      title: `SecurityHub Finding - ${finding.Title}`,
      state: "open",
      labels: [
        "security-hub",
        this.region,
        finding.Severity,
        this.accountNickname,
      ],
      body: `**************************************************************
  __This ticket was generated from Security Hub data and is managed through automation.__
  Please do not edit the title or body of this ticket, or remove the security-hub tag.  All other edits/comments are welcome.
  Finding Title: ${finding.Title}
  **************************************************************


## Type of Ticket:

- [x] Security Hub Finding

## Title:

${finding.Title}

## Description

${finding.Description}

## Remediation

${finding.Recommendation.Url}
${finding.Recommendation.Text}

## AC:

- All findings of this type are resolved or suppressed, indicated by a Workflow Status of Resolved or Suppressed.  (Note:  this ticket will automatically close when the AC is met.)
      `,
    };
  }

  async createNewJiraTicket(finding) {
    console.log("TODO: create Jira ticket.");
    console.log("finding:", finding);

    // TODO: update this GitHub logic to Jira logic
    // await this.octokit.rest.tickets.create({
    //   ...this.octokitRepoParams,
    //   ...this.ticketParamsForFinding(finding),
    // });
    // Due to github secondary rate limiting, we will take a 5s pause after creating tickets.
    // See: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#secondary-rate-limits
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  async updateTicketIfItsDrifted(finding, ticket) {
    let ticketParams = this.ticketParamsForFinding(finding);
    let ticketLabels = [];
    ticket.labels.forEach((label) => {
      ticketLabels.push(label.name);
    });
    if (
      ticket.title != ticketParams.title ||
      ticket.state != ticketParams.state ||
      ticket.body != ticketParams.body ||
      !ticketParams.labels.every((v) => ticketLabels.includes(v))
    ) {
      console.log(
        `Ticket ${ticket.number}:  drift detected.  Updating ticket...`
      );
      // TODO: update this GitHub logic to Jira logic
      // await this.octokit.rest.tickets.update({
      //   ...this.octokitRepoParams,
      //   ...ticketParams,
      //   ticket_number: ticket.number,
      // });
    } else {
      console.log(
        `Ticket ${ticket.number}:  Ticket is up to date.  Doing nothing...`
      );
    }
  }

  async closeTicketsWithoutAnActiveFinding(findings, tickets) {
    console.log(
      `******** Discovering and closing any open Jira Tickets without an underlying, active Security Hub finding. ********`
    );

    // Store all finding ids in an array
    const findingsTitles = findings.map((finding) => finding.Title);

    console.log("TODO findingsTitles:", findingsTitles);

    // Search for open tickets that do not have a corresponding active SH finding.
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.state !== "open") continue; // We only care about open tickets here.
      const ticketTitle = ticket.body.match(findingTitleRegex);
      if (ticketTitle && findingsTitles.includes(ticketTitle[0])) {
        console.log(
          `Ticket ${ticket.number}:  Underlying finding found.  Doing nothing...`
        );
      } else {
        console.log(
          `Ticket ${ticket.number}:  No underlying finding found.  Closing ticket...`
        );
        // TODO: update this GitHub logic to Jira logic
        // await this.octokit.rest.tickets.update({
        //   ...this.octokitRepoParams,
        //   ticket_number: ticket.number,
        //   state: "closed",
        // });
      }
    }
  }

  async createOrUpdateTicketsBasedOnFindings(
    findings: string | any[],
    tickets: string | any[]
  ) {
    console.log(
      `******** Creating or updating Jira Tickets based on Security Hub findings. ********`
    );
    // Search for active SH findings that don't have an open ticket
    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i];
      let hit = false;
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        const ticketTitle = ticket.body.match(findingTitleRegex);
        if (finding.Title == ticketTitle) {
          hit = true;
          console.log(
            `Finding ${finding.Title}:  Ticket ${ticket.number} found for finding.  Checking it's up to date...`
          );
          await this.updateTicketIfItsDrifted(finding, ticket);
          break;
        }
      }
      if (!hit) {
        console.log(
          `Finding ${finding.Title}:  No ticket found for finding.  Creating ticket...`
        );
        await this.createNewJiraTicket(finding);
      }
    }
  }
}

async function TODO_temp_testing() {
  console.log("hi");

  const mySync = new SecurityHubJiraSync({
    // repository: "myorgname/myrepositoryname", // (required) The name of the repository in which to create Tickets.  If GH Actions, use process.env.GITHUB_REPOSITORY
    // auth: process.env.GITHUB_TOKEN, // (required)  A PAT with access to create tickets.  If GH Actions, use process.env.GITHUB_TOKEN
    // accountNickname: "dev", // (required) A sensible account nickname; will be used to label tickets.
    region: "us-east-1", // (optional, default: us-east-1) The SecHub region at which to look.
    severity: ["CRITICAL", "HIGH"], // (optional, default: ['CRITICAL','HIGH']) The finding types for which you want to create tickets.
  });

  console.log(await mySync.sync());
}

TODO_temp_testing();
