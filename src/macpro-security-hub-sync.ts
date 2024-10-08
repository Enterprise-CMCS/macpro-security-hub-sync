import { Jira, Resource, SecurityHub, SecurityHubFinding } from "./libs";
import { IssueObject } from "jira-client";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

interface SecurityHubJiraSyncOptions {
  region?: string;
  severities?: string[];
  customJiraFields?: { [id: string]: any };
  epicKey?: string;
}

interface UpdateForReturn {
  action: string;
  webUrl: string;
  summary: string;
}

export interface LabelConfig {
  labelField: string;
  labelPrefix?: string;
  labelDelimiter?: string;
}

export class SecurityHubJiraSync {
  private readonly jira: Jira;
  private readonly securityHub: SecurityHub;
  private readonly customJiraFields;
  private readonly region;
  private readonly epicKey;
  constructor(options: SecurityHubJiraSyncOptions = {}) {
    const {
      region = "us-east-1",
      severities = ["MEDIUM", "HIGH", "CRITICAL"],
      customJiraFields = {},
    } = options;
    this.securityHub = new SecurityHub({ region, severities });
    this.region = region;
    this.jira = new Jira();
    this.customJiraFields = customJiraFields;
    this.epicKey = options.epicKey;
  }

  async sync() {
    const updatesForReturn: UpdateForReturn[] = [];
    // Step 0. Gather and set some information that will be used throughout this function
    const accountId = await this.getAWSAccountID();
    const identifyingLabels: string[] = [accountId, this.region];

    // Step 1. Get all open Security Hub issues from Jira
    const jiraIssues = await this.jira.getAllSecurityHubIssuesInJiraProject(
      identifyingLabels
    );

    // Step 2. Get all current findings from Security Hub
    const shFindingsObj = await this.securityHub.getAllActiveFindings();
    const shFindings = Object.values(shFindingsObj);
    console.log(shFindings);
    // Step 3. Close existing Jira issues if their finding is no longer active/current
    updatesForReturn.push(
      ...(await this.closeIssuesForResolvedFindings(jiraIssues, shFindings))
    );

    // Step 4. Create Jira issue for current findings that do not already have a Jira issue
    updatesForReturn.push(
      ...(await this.createJiraIssuesForNewFindings(
        jiraIssues,
        shFindings,
        identifyingLabels
      ))
    );

    console.log(JSON.stringify(updatesForReturn));
  }

  async getAWSAccountID() {
    const client = new STSClient({
      region: this.region,
    });
    const command = new GetCallerIdentityCommand({});
    let response;
    try {
      response = await client.send(command);
    } catch (e: any) {
      throw new Error(`Error getting AWS Account ID: ${e.message}`);
    }
    let accountID: string = response.Account || "";
    if (!accountID.match("[0-9]{12}")) {
      throw new Error(
        "ERROR:  An issue was encountered when looking up your AWS Account ID.  Refusing to continue."
      );
    }
    return accountID;
  }
  async closeIssuesForResolvedFindings(
    jiraIssues: IssueObject[],
    shFindings: SecurityHubFinding[]
  ) {
    const updatesForReturn: UpdateForReturn[] = [];
    const expectedJiraIssueTitles = Array.from(
      new Set(
        shFindings.map((finding) => `SecurityHub Finding - ${finding.title}`)
      )
    );
    try {
      const makeComment = () =>
        `As of ${new Date(
          Date.now()
        ).toDateString()}, this Security Hub finding has been marked resolved`;
      // close all security-hub labeled Jira issues that do not have an active finding
      if (process.env.AUTO_CLOSE !== "false") {
        for (var i = 0; i < jiraIssues.length; i++) {
          if (!expectedJiraIssueTitles.includes(jiraIssues[i].fields.summary)) {
            await this.jira.closeIssue(jiraIssues[i].key);
            updatesForReturn.push({
              action: "closed",
              webUrl: `https://${process.env.JIRA_HOST}/browse/${jiraIssues[i].key}`,
              summary: jiraIssues[i].fields.summary,
            });
            const comment = await this.jira.addCommentToIssueById(
              jiraIssues[i].id,
              makeComment()
            );
          }
        }
      } else {
        console.log("Skipping auto closing...");
        for (var i = 0; i < jiraIssues.length; i++) {
          if (
            !expectedJiraIssueTitles.includes(jiraIssues[i].fields.summary) &&
            !jiraIssues[i].fields.summary.includes("Resolved") // skip already resolved issues
          ) {
            try {
              const res = await this.jira.updateIssueTitleById(
                jiraIssues[i].id,
                {
                  fields: {
                    summary: `Resolved ${jiraIssues[i].fields.summary}`,
                  },
                }
              );
              const comment = await this.jira.addCommentToIssueById(
                jiraIssues[i].id,
                makeComment()
              );
            } catch (e) {
              console.log(
                `Title of ISSUE with id ${
                  jiraIssues[i].id
                } is not changed with error: ${JSON.stringify(e)}`
              );
            }
          }
        }
      }
    } catch (e: any) {
      throw new Error(
        `Error closing Jira issue for resolved finding: ${e.message}`
      );
    }
    return updatesForReturn;
  }
  makeResourceList(resources: Resource[] | undefined) {
    if (!resources) {
      return `No Resources`;
    }
    const maxLength = Math.max(...resources.map(({ Id }) => Id?.length || 0));
    const title = "Resource Id".padEnd(maxLength + maxLength / 2 + 4);

    let Table = `${title}| Partition   | Region     | Type    \n`;
    resources.forEach(({ Id, Partition, Region, Type }) => {
      Table += `${Id.padEnd(maxLength + 2)}| ${(Partition ?? "").padEnd(
        11
      )} | ${(Region ?? "").padEnd(9)} | ${Type ?? ""} \n`;
    });

    Table += `------------------------------------------------------------------------------------------------`;
    return Table;
  }
  createSecurityHubFindingUrlThroughFilters(findingId: string) {
    let region, accountId;

    if (findingId.startsWith("arn:")) {
      // Extract region and account ID from the ARN
      const arnParts = findingId.split(":");
      if (arnParts.length >= 5) {
        region = arnParts[3];
        accountId = arnParts[4];
      } else {
        return "Invalid URL";
      }
    } else {
      // Extract region and account ID from the non-ARN format
      const parts = findingId.split("/");
      if (parts.length >= 3) {
        region = parts[1];
        accountId = parts[2];
      } else {
        return "Invalid URL";
      }
    }

    const baseUrl = `https://${region}.console.aws.amazon.com/securityhub/home?region=${region}`;
    const searchParam = `Id%3D%255Coperator%255C%253AEQUALS%255C%253A${findingId}`;
    const url = `${baseUrl}#/findings?search=${searchParam}`;

    return url;
  }
  createIssueBody(finding: SecurityHubFinding) {
    const {
      remediation: {
        Recommendation: {
          Url: remediationUrl = "",
          Text: remediationText = "",
        } = {},
      } = {},
      id = "",
      title = "",
      description = "",
      accountAlias = "",
      awsAccountId = "",
      severity = "",
      standardsControlArn = "",
    } = finding;

    return `----

      *This issue was generated from Security Hub data and is managed through automation.*
      Please do not edit the title or body of this issue, or remove the security-hub tag.  All other edits/comments are welcome.
      Finding Title: ${title}

      ----

      h2. Type of Issue:

      * Security Hub Finding

      h2. Title:

      ${title}

      h2. Description:

      ${description}

      ${
        remediationText || remediationUrl
          ? `h2. Remediation:

      ${remediationUrl}
      ${remediationText}`
          : ""
      }

      h2. AWS Account:
      ${awsAccountId} (${accountAlias})

      h2. Severity:
      ${severity}

      h2. SecurityHubFindingUrl:
      ${
        standardsControlArn
          ? this.createSecurityHubFindingUrl(standardsControlArn)
          : this.createSecurityHubFindingUrlThroughFilters(id)
      }

      h2. Resources:
      Following are the resources those were non-compliant at the time of the issue creation
      ${this.makeResourceList(finding.Resources)}

      To check the latest list of resources, kindly refer to the finding url

      h2. AC:

      * All findings of this type are resolved or suppressed, indicated by a Workflow Status of Resolved or Suppressed.  (Note:  this ticket will automatically close when the AC is met.)`;
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
  getSeverityMapping = (severity: string) => {
    switch (severity) {
      case "INFORMATIONAL":
        return "5";
      case "LOW":
        return "4";
      case "MEDIUM":
        return "3";
      case "HIGH":
        return "2";
      case "CRITICAL":
        return "1";
      default:
        throw new Error(`Invalid severity: ${severity}`);
    }
  };
  getPriorityId = (severity: string, priorities: any[]) => {
    const severityLevel = parseInt(this.getSeverityMapping(severity));
    if (severityLevel >= priorities.length) {
      return priorities[priorities.length - 1];
    }
    return priorities[severityLevel - 1];
  };
  getPriorityNumber = (
    severity: string,
    isEnterprise: boolean = false
  ): string => {
    if (isEnterprise) {
      return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
    }
    switch (severity) {
      case "INFORMATIONAL":
        return "5";
      case "LOW":
        return "4";
      case "MEDIUM":
        return "3";
      case "HIGH":
        return "2";
      case "CRITICAL":
        return "1";
      default:
        throw new Error(`Invalid severity: ${severity}`);
    }
  };
  createLabels(
    finding: SecurityHubFinding,
    identifyingLabels: string[],
    config: LabelConfig[]
  ): string[] {
    const labels: string[] = [];
    const fields = ["accountId", "region", "identify"];
    const values = [...identifyingLabels, "security-hub"];

    config.forEach(
      ({ labelField: field, labelDelimiter: delim, labelPrefix: prefix }) => {
        const delimiter = delim ?? "";
        const labelPrefix = prefix ?? "";

        if (fields.includes(field)) {
          const index = fields.indexOf(field);
          if (index >= 0) {
            labels.push(
              `${labelPrefix}${delimiter}${values[index]
                ?.trim()
                .replace(/ /g, "")}`
            );
          }
        } else {
          const value = (finding[field] ?? "")
            .toString()
            .trim()
            .replace(/ /g, "");
          labels.push(`${labelPrefix}${delimiter}${value}`);
        }
      }
    );

    return labels;
  }
  async createJiraIssueFromFinding(
    finding: SecurityHubFinding,
    identifyingLabels: string[]
  ) {
    const priorities = await this.jira.getPriorityIdsInDescendingOrder();
    console.log(priorities);
    const newIssueData: IssueObject = {
      fields: {
        summary: `SecurityHub Finding - ${finding.title}`.substring(0, 255),
        description: this.createIssueBody(finding),
        issuetype: { name: "Task" },
        labels: [
          "security-hub",
          finding.severity,
          finding.accountAlias,
          finding.ProductName?.trim().replace(/ /g, ""),
          ...identifyingLabels,
        ],
        priority: {
          id: finding.severity
            ? this.getPriorityId(finding.severity, priorities)
            : "3", // if severity is not specified, set 3 which is the middle of the default options.
        },
        ...this.customJiraFields,
      },
    };
    if (process.env.LABELS_CONFIG) {
      try {
        const config = JSON.parse(process.env.LABELS_CONFIG);
        newIssueData.fields.labels = this.createLabels(
          finding,
          identifyingLabels,
          config
        );
      } catch (e) {
        console.log("Invalid labels config - going with default labels");
      }
    }
    if (finding.severity && process.env.JIRA_HOST?.includes("jiraent")) {
      newIssueData.fields.priority = {
        name: this.getPriorityNumber(finding.severity, true),
      };
    }
    if (this.epicKey) {
      newIssueData.fields.parent = { key: this.epicKey };
    }
    let newIssueInfo;
    try {
      newIssueInfo = await this.jira.createNewIssue(newIssueData);
      const issue_id = process.env.JIRA_LINK_ID ?? "";
      if (issue_id) {
        let linkType = "Relates";
        if (process.env.JIRA_LINK_TYPE) {
          linkType = process.env.JIRA_LINK_TYPE;
        }
        const linkDirection = process.env.JIRA_LINK_DIRECTION ?? "inward";
        await this.jira.linkIssues(
          newIssueInfo.key,
          issue_id,
          linkType,
          linkDirection
        );
      }
    } catch (e: any) {
      throw new Error(`Error creating Jira issue from finding: ${e.message}`);
    }
    return {
      action: "created",
      webUrl: newIssueInfo.webUrl,
      summary: newIssueData.fields.summary,
    };
  }

  async createJiraIssuesForNewFindings(
    jiraIssues: IssueObject[],
    shFindings: SecurityHubFinding[],
    identifyingLabels: string[]
  ) {
    const updatesForReturn: UpdateForReturn[] = [];
    const existingJiraIssueTitles = jiraIssues.map((i) => i.fields.summary);
    const uniqueSecurityHubFindings = [
      ...new Set(shFindings.map((finding) => JSON.stringify(finding))),
    ].map((finding) => JSON.parse(finding));

    for (let i = 0; i < uniqueSecurityHubFindings.length; i++) {
      const finding = uniqueSecurityHubFindings[i];
      if (
        !existingJiraIssueTitles.includes(
          `SecurityHub Finding - ${finding.title}`
        )
      ) {
        const update = await this.createJiraIssueFromFinding(
          finding,
          identifyingLabels
        );
        updatesForReturn.push(update);
      }
    }

    return updatesForReturn;
  }
}
