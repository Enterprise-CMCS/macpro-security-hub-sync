import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
  GetFindingsCommandOutput,
  Remediation,
  AwsSecurityFinding,
} from "@aws-sdk/client-securityhub";

export interface SecurityHubFinding {
  title?: string;
  createdAt?: string;
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
    this.getAccountAlias().catch((error) => console.error(error));
  }

  private async getAccountAlias(): Promise<void> {
    const iamClient = new IAMClient({ region: this.region });
    const response = await iamClient.send(new ListAccountAliasesCommand({}));
    this.accountAlias = response.AccountAliases?.[0] || "";
  }

  async getAllActiveFindings() {
    try {
      const securityHubClient = new SecurityHubClient({ region: this.region });

      const currentTime = new Date();
      const oneDayAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);

      const filters = {
        RecordState: [{ Comparison: "EQUALS", Value: "ACTIVE" }],
        WorkflowStatus: [
          { Comparison: "EQUALS", Value: "NEW" },
          { Comparison: "EQUALS", Value: "NOTIFIED" },
        ],
        ProductName: [{ Comparison: "EQUALS", Value: "Security Hub" }],
        SeverityLabel: this.severityLabels,
        CreatedAt: [
          {
            Start: "1970-01-01T00:00:00Z",
            End: oneDayAgo.toISOString(),
          },
        ],
      };

      // use a Set to store unique findings by title
      const uniqueFindings = new Set<SecurityHubFinding>();

      // use a variable to track pagination
      let nextToken: string | undefined = undefined;

      do {
        const response: GetFindingsCommandOutput = await securityHubClient.send(
          new GetFindingsCommand({
            Filters: filters,
            MaxResults: 100, // this is the maximum allowed per page
            NextToken: nextToken,
          })
        );
        if (response.Findings) {
          for (const finding of response.Findings) {
            uniqueFindings.add(
              this.awsSecurityFindingToSecurityHubFinding(finding)
            );
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);

      return Array.from(uniqueFindings).map((finding) => {
        return { accountAlias: this.accountAlias, ...finding };
      });
    } catch (e: any) {
      throw new Error(`Error getting Security Hub findings: ${e.message}`);
    }
  }

  awsSecurityFindingToSecurityHubFinding(
    finding: AwsSecurityFinding
  ): SecurityHubFinding {
    if (!finding) return {};
    return {
      title: finding.Title,
      createdAt: new Date(finding.CreatedAt ?? "").toLocaleString(),
      region: finding.Region,
      accountAlias: this.accountAlias,
      awsAccountId: finding.AwsAccountId,
      severity:
        finding.Severity && finding.Severity.Label
          ? finding.Severity.Label
          : "",
      description: finding.Description,
      standardsControlArn:
        finding.ProductFields && finding.ProductFields.StandardsControlArn
          ? finding.ProductFields.StandardsControlArn
          : "",
      remediation: finding.Remediation,
    };
  }
}
