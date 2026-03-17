import { planAgentAction } from "./planner";

function runManualTests() {
  console.log("=== planAgentAction manual tests ===\n");

  const testCases = [
    {
      name: "1. Which parks in Munich are good for kids age 4-5?",
      input: {
        message: "Which parks in Munich are good for kids age 4-5?",
        tripId: "trip-123",
        destination: "Munich",
      },
    },
    {
      name: "2. Add the first one",
      input: {
        message: "Add the first one",
        tripId: "trip-123",
      },
    },
    {
      name: "3. Can you recommend family places?",
      input: {
        message: "Can you recommend family places?",
        tripId: "trip-123",
        destination: "Munich",
      },
    },
    {
      name: "4. Hello there",
      input: {
        message: "Hello there",
        tripId: "trip-123",
      },
    },
  ];

  for (const { name, input } of testCases) {
    console.log(name);
    console.log("  input:", JSON.stringify(input, null, 2));
    const output = planAgentAction(input);
    console.log("  output:", JSON.stringify(output, null, 2));
    console.log("");
  }

  console.log("=== done ===");
}

runManualTests();
