import { SecurityHubJiraSync } from "./macpro-security-hub-sync";

new SecurityHubJiraSync({
  region: "us-east-1",
  severities: ["CRITICAL", "HIGH"],
}).sync();
