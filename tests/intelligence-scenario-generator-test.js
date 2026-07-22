import RequirementLoader from "../src/loaders/RequirementLoader.js";
import MarkdownParser from "../src/parsers/MarkdownParser.js";

import RequirementIntelligenceEngine 
from "../src/engines/RequirementIntelligenceEngine.js";

import ScenarioRecommendationEngine
from "../src/recommenders/ScenarioRecommendationEngine.js";

import IntelligenceScenarioGenerator
from "../src/generators/IntelligenceScenarioGenerator.js";


console.log(`
=================================
 INTELLIGENCE SCENARIO TEST
=================================
`);


const loader =
new RequirementLoader();


const markdown =
loader.load(
"REQUIREMENTS/thiet-bi.md"
);



const parser =
new MarkdownParser();



const requirement =
parser.parse(markdown);



const intelligence =
new RequirementIntelligenceEngine();



const knowledge =
intelligence.analyze(
requirement
);



const recommender =
new ScenarioRecommendationEngine();



const recommended =
recommender.generate(
knowledge
);



const generator =
new IntelligenceScenarioGenerator();



const scenarios =
generator.generate(
recommended,
requirement
);



console.log(scenarios);


console.log(
JSON.stringify(
scenarios,
null,
2
)
);


console.log(`
=================================
 INTELLIGENCE SCENARIO COMPLETED
=================================
`);