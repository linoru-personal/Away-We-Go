import { runAgent } from "./runAgent";

async function runManualTests() {
  console.log("=== runAgent manual tests ===\n");

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
      name: "2. Can you recommend family places in Munich?",
      input: {
        message: "Can you recommend family places in Munich?",
        tripId: "trip-123",
        destination: "Munich",
      },
    },
    {
      name: "3. Hello there",
      input: {
        message: "Hello there",
        tripId: "trip-123",
      },
    },
  ];

  for (const { name, input } of testCases) {
    console.log(name);
    console.log("  input:", JSON.stringify(input, null, 2));
    const response = await runAgent(input);
    console.log("  response:", JSON.stringify(response, null, 2));
    console.log("");
  }

  console.log("=== done ===");
}

runManualTests();
