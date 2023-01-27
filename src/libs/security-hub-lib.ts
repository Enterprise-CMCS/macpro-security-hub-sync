import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
  AwsSecurityFindingFilters,
  AwsSecurityFinding,
  GetFindingsResponse,
} from "@aws-sdk/client-securityhub";
import { reportError } from "./error-lib";

export class SecurityHub {
  private readonly region: string;
  private readonly severities: string[];

  constructor({
    region = "us-east-1",
    severities = ["HIGH", "CRITICAL"],
  } = {}) {
    this.region = region;
    this.severities = severities;
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

  async getAllActiveFindings() {
    try {
      const client = new SecurityHubClient({ region: this.region });
      const severityLabels = this.severities.map((label) => ({
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

      // use a Set to store unique findings by title
      const uniqueFindings = new Set<AwsSecurityFinding>();

      // use a variable to track pagination
      let nextToken: string | undefined = undefined;

      do {
        const response: any = await client.send(
          new GetFindingsCommand({
            Filters: filters,
            MaxResults: 100, // this is the maximum allowed per page
            NextToken: nextToken,
          })
        );
        if (response.Findings) {
          for (const finding of response.Findings) {
            uniqueFindings.add(finding);
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);

      return Array.from(uniqueFindings);
    } catch (e) {
      reportError(e);
      return [];
    }
  }
}
