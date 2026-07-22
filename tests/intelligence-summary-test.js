import RequirementLoader 
from "../src/loaders/RequirementLoader.js";

import RequirementIntelligenceEngine
from "../src/engines/RequirementIntelligenceEngine.js";

import IntelligenceSummaryGenerator
from "../src/intelligence/IntelligenceSummaryGenerator.js";

import MarkdownParser
from "../src/parsers/MarkdownParser.js";


console.log(
`
=================================
 INTELLIGENCE SUMMARY TEST
=================================
`
);



const loader =
new RequirementLoader();



const markdown =
loader.load(
"REQUIREMENTS/thiet-bi.md"
);



const parser =
new MarkdownParser();



const requirement =
parser.parse(
markdown
);



console.log(
"Requirement Object:"
);

console.log(requirement);



const intelligenceEngine =
new RequirementIntelligenceEngine();



const knowledge =
intelligenceEngine.analyze(
requirement
);



const generator =
new IntelligenceSummaryGenerator();



const summary =
generator.generate(
requirement,
knowledge
);



console.log(
"Requirement Intelligence Summary:"
);


console.log(summary);



console.log(
JSON.stringify(
summary,
null,
2
)
);



console.log(
`
=================================
 INTELLIGENCE SUMMARY COMPLETED
=================================
`
);