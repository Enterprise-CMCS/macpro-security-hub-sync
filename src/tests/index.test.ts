import { it, describe, expect, vi, beforeEach } from "vitest";
// import { SecurityHubSync } from "../index";
// import {
//   CloudFormationClient,
//   DescribeStacksCommand,
// } from "@aws-sdk/client-cloudformation";
import { mockClient } from "aws-sdk-client-mock";

// const cfnMock = mockClient(CloudFormationClient);

// beforeEach(() => {
//   cfnMock.reset();
// });

// describe("getAllFindings command's tests", () => {
//   process.env.PROJECT = "myProject";
//   const sampleStackResponse = {
//     StackName: "Bob",
//     CreationTime: new Date(0),
//     StackStatus: "Great",
//   };

//   it("happy path", async () => {
//     cfnMock.on(DescribeStacksCommand, {}).resolves({
//       Stacks: [
//         {
//           ...sampleStackResponse,
//           Tags: [
//             { Key: "PROJECT", Value: "myProject" },
//             { Key: "STAGE", Value: "myStage" },
//             { Key: "SERVICE", Value: "myService" },
//           ],
//         },
//       ],
//     });
//     const workflowFunction = vi.fn((region) =>
//       SecurityHubSync.getAllFindings(region)
//     );

//     const runningStages = await workflowFunction("my-region");

//     expect(workflowFunction).toHaveBeenCalledWith("my-region");
//     expect(runningStages).toStrictEqual(["myStage"]);
//     expect(workflowFunction).toReturnWith(["myStage"]);
//     expect(runningStages).toHaveLength(1);
//   });

//   it("test without tags", async () => {
//     cfnMock.on(DescribeStacksCommand, {}).resolves({
//       Stacks: [sampleStackResponse],
//     });
//     const workflowFunction = vi.fn((region) =>
//       SecurityHubSync.getAllFindings(region)
//     );

//     const runningStages = await workflowFunction("my-region");

//     expect(workflowFunction).toHaveBeenCalledWith("my-region");
//     expect(runningStages).toStrictEqual([]);
//     expect(workflowFunction).toReturnWith([]);
//     expect(runningStages).toHaveLength(0);
//   });
// });
