import { searchPlaces } from "./searchPlaces";

async function runManualTests() {
  console.log("=== searchPlaces manual tests ===\n");

  console.log("1. Parks in Munich");
  console.log("   params: { city: 'Munich', category: 'park' }");
  const parks = await searchPlaces({ city: "Munich", category: "park" });
  console.log("   results:", parks.length);
  parks.forEach((p, i) => console.log(`   ${i + 1}. ${p.name} - ${p.description.slice(0, 60)}...`));
  console.log("");

  console.log("2. Parks for kids age 4");
  console.log("   params: { city: 'Munich', category: 'park', childAge: 4 }");
  const parksAge4 = await searchPlaces({
    city: "Munich",
    category: "park",
    childAge: 4,
  });
  console.log("   results:", parksAge4.length);
  parksAge4.forEach((p, i) => console.log(`   ${i + 1}. ${p.name} (ageRange: ${p.ageRange.join("-")})`));
  console.log("");

  console.log("3. Indoor places for kids");
  console.log("   params: { tags: ['kids', 'indoor'] }");
  const indoor = await searchPlaces({ tags: ["kids", "indoor"] });
  console.log("   results:", indoor.length);
  indoor.forEach((p, i) => console.log(`   ${i + 1}. ${p.name} - ${p.category}`));
  console.log("");


  console.log("Test 4 - Berlin (should be empty):")
  console.log(await searchPlaces({ city: "Berlin" }))

  console.log("=== done ===");
}

runManualTests();
