import { SecurityHubJiraSync } from "@enterprise-cmcs/macpro-security-hub-sync";

await new SecurityHubJiraSync({
  region: "us-east-1",
  severities: ["HIGH", "CRITICAL"], // ["MEDIUM","HIGH","CRITICAL"]
  customJiraFields: {
    customfield_14117: [{ value: "Platform Team" }],
    customfield_14151: [{ value: "Not Applicable" }],
  },
  jiraLabelsConfig: [
    { labelField: "ProductName", labelPrefix: "product", labelDelimiter: ":" },
    { labelField: "severity" },
  ],
  includeAllProducts: true,
  assignee: "notben",
  jiraLinkType: "Relates",
  jiraLinkDirection: "inward",
}).sync();
