import { SecurityHubJiraSync } from "./macpro-security-hub-sync";

new SecurityHubJiraSync({
  region: "us-east-1",
  severities: ["CRITICAL", "HIGH"],
  customJiraFields: {
    customfield_14117: [{ value: "Dev Team" }],
    customfield_14151: [{ value: "OneMac" }],
  },
}).sync();
