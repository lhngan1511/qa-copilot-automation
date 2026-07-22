import RequirementLoader from "../src/loaders/RequirementLoader.js";


console.log("\n=================================");
console.log(" REQUIREMENT LOADER TEST");
console.log("=================================\n");



const loader = new RequirementLoader();



const filePath = 
    "./requirements/thiet-bi.md";



console.log("Loading file:");

console.log(filePath);



try {


    const content = loader.load(filePath);



    console.log("\nContent loaded:\n");


    console.log(content);



    console.log("\n=================================");
    console.log(" LOADER TEST COMPLETED");
    console.log("=================================\n");


}
catch(error){


    console.error(
        "\nLOADER ERROR:"
    );


    console.error(
        error.message
    );


}