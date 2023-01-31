import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
  GetFindingsCommandOutput,
  Remediation,
  AwsSecurityFinding,
} from "@aws-sdk/client-securityhub";
import { Logger } from "./error-lib";

export interface FindingWithAccountAlias {
  title?: string;
  region?: string;
  accountAlias?: string;
  awsAccountId?: string;
  severity?: string;
  description?: string;
  standardsControlArn?: string;
  remediation?: Remediation;
}

export class SecurityHub {
  private readonly region: string;
  private readonly severityLabels: { Comparison: string; Value: string }[];
  private accountAlias = "";

  constructor({
    region = "us-east-1",
    severities = ["HIGH", "CRITICAL"],
  } = {}) {
    this.region = region;
    this.severityLabels = severities.map((severity) => ({
      Comparison: "EQUALS",
      Value: severity,
    }));
    this.getAccountAlias().catch((error) => Logger.logError(error));
  }

  private async getAccountAlias(): Promise<void> {
    const iamClient = new IAMClient({ region: this.region });
    const response = await iamClient.send(new ListAccountAliasesCommand({}));
    this.accountAlias = response.AccountAliases?.[0] || "";
  }

  async getAllActiveFindings() {
    try {
      const securityHubClient = new SecurityHubClient({ region: this.region });
      const filters = {
        RecordState: [{ Comparison: "EQUALS", Value: "ACTIVE" }],
        WorkflowStatus: [
          { Comparison: "EQUALS", Value: "NEW" },
          { Comparison: "EQUALS", Value: "NOTIFIED" },
        ],
        ProductName: [{ Comparison: "EQUALS", Value: "Security Hub" }],
        SeverityLabel: this.severityLabels,
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

      return Array.from(uniqueFindings).map((finding) => {
        return { accountAlias: this.accountAlias, ...finding };
      });
    } catch (error) {
      Logger.logError(error as Error);
      return [];
    }
  }
}
