import fs from "fs";
import path from "path";

import MarkdownParser from "../src/parsers/MarkdownParser.js";

console.log("");
console.log("=================================");
console.log(" Markdown Parser Test");
console.log("=================================");
console.log("");

const requirementFile = path.join("requirements", "dang-nhap.md");

const markdown = fs.readFileSync(requirementFile, "utf8");

const parser = new MarkdownParser();

const requirement = parser.parse(markdown);

console.log("Module:");
console.log(requirement.module);

console.log("");

console.log("Purpose:");
console.log(requirement.purpose);

console.log("");

console.log("Number of Features:");
console.log(requirement.features.length);

console.log("");

requirement.features.forEach((feature, index) => {
    console.log("---------------------------------");
    console.log(`Feature ${index + 1}`);
    console.log("---------------------------------");

    console.log("Name:");
    console.log(feature.name);

    console.log("");

    console.log("Description:");
    console.log(feature.description);

    console.log("");

    console.log("Preconditions:");
    console.log(feature.preconditions);

    console.log("");

    console.log("Inputs:");
    console.log(feature.inputs);

    console.log("");

    console.log("Flow:");
    console.log(feature.flow);

    console.log("");

    console.log("Business Rules:");
    console.log(feature.businessRules);

    console.log("");

    console.log("Expected Results:");
    console.log(feature.expectedResults);

    console.log("");

    console.log("Automation:");
    console.log(feature.automation);

    console.log("");
});

console.log("=================================");
console.log(" Parser Test Completed");
console.log("=================================");
