import RequirementLoader from "../src/loaders/RequirementLoader.js";
import MarkdownParser from "../src/parsers/MarkdownParser.js";


console.log("\n=================================");
console.log(" MARKDOWN PARSER TEST");
console.log("=================================\n");



const loader = new RequirementLoader();

const parser = new MarkdownParser();



const filePath = "./requirements/thiet-bi.md";



try {


    // 1. Load markdown file

    const markdown = loader.load(filePath);



    // 2. Parse markdown

    const requirement =
        parser.parse(markdown);



    console.log("Feature:");

    console.log(
        requirement.feature
    );



    console.log("\nPurpose:");

    console.log(
        requirement.purpose
    );



    console.log("\nBusiness Rules:");

    console.log(
        requirement.businessRules
    );



    console.log("\nExpected Results:");

    console.log(
        requirement.expectedResults
    );



    console.log("\nEdge Cases:");

    console.log(
        requirement.edgeCases
    );



    console.log("\nFull Requirement Object:");

    console.log(
        requirement
    );



    console.log("\n=================================");
    console.log(" PARSER TEST COMPLETED");
    console.log("=================================\n");


}
catch(error){


    console.error(
        "\nPARSER ERROR:"
    );


    console.error(
        error.message
    );


}