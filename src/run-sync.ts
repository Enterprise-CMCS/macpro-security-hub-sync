import { SecurityHubJiraSync } from "./macpro-security-hub-sync";

new SecurityHubJiraSync({
  region: "us-east-1",
  severities: ["CRITICAL", "HIGH"],
  customJiraFields: {
    "Working Team": [{ value: "Dev Team" }],
    "Product Supported": [{ value: "OneMac" }],
  },
}).sync();
