import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
  GetFindingsCommandOutput,
  Remediation,
  AwsSecurityFinding,
  AwsSecurityFindingFilters,
} from "@aws-sdk/client-securityhub";

export interface Resource {
  Id: string;
  Partition: string;
  Region: string;
  Type: string;
}
export interface SecurityHubFinding {
  title?: string;
  region?: string;
  accountAlias?: string;
  awsAccountId?: string;
  severity?: string;
  description?: string;
  standardsControlArn?: string;
  remediation?: Remediation;
  Resources?: Resource[];
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

      // delay for filtering out ephemeral issues
      const delayForNewIssues =
        typeof process.env.SECURITY_HUB_NEW_ISSUE_DELAY !== "undefined"
          ? +process.env.SECURITY_HUB_NEW_ISSUE_DELAY
          : 24 * 60 * 60 * 1000; // 1 day
      const maxDatetime = new Date(currentTime.getTime() - delayForNewIssues);

      const filters: AwsSecurityFindingFilters = {
        RecordState: [{ Comparison: "EQUALS", Value: "ACTIVE" }],
        WorkflowStatus: [
          { Comparison: "EQUALS", Value: "NEW" },
          { Comparison: "EQUALS", Value: "NOTIFIED" },
        ],
        SeverityLabel: this.severityLabels,
        CreatedAt: [
          {
            Start: "1970-01-01T00:00:00Z",
            End: maxDatetime.toISOString(),
          },
        ],
      };
      if (process.env.INCLUDE_ALL_PRODUCTS !== "true") {
        filters.ProductName = [{ Comparison: "EQUALS", Value: "Security Hub" }];
      }
      if (process.env.SKIP_PRODUCTS) {
        const skipList: string[] = process.env.SKIP_PRODUCTS.split(",");
        skipList.forEach((product) => {
          if (!filters.ProductName) {
            filters.ProductName = [];
          }
          filters.ProductName?.push({
            Comparison: "NOT_EQUALS",
            Value: product,
          });
        });
      }
      // use an object to store unique findings by title
      const uniqueFindings: { [title: string]: SecurityHubFinding } = {};

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
        if (response && response.Findings) {
          for (const finding of response.Findings) {
            const findingForJira =
              this.awsSecurityFindingToSecurityHubFinding(finding);
            if (findingForJira.title)
              uniqueFindings[findingForJira.title] = findingForJira;
          }
        }
        if (response && response.NextToken) nextToken = response.NextToken;
        else nextToken = undefined;
      } while (nextToken);

      return Object.values(uniqueFindings).map((finding) => {
        return {
          accountAlias: this.accountAlias,
          ...finding,
        };
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
      Resources: finding.Resources as unknown as Resource[],
    };
  }
}
