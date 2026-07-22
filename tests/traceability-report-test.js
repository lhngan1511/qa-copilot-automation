import RequirementLoader from "../src/loaders/RequirementLoader.js";
import MarkdownParser from "../src/parsers/MarkdownParser.js";
import RequirementIntelligenceEngine from "../src/engines/RequirementIntelligenceEngine.js";
import ScenarioRecommendationEngine from "../src/recommenders/ScenarioRecommendationEngine.js";
import TestCaseGenerator from "../src/generators/TestCaseGenerator.js";
import TraceabilityReportGenerator from "../src/intelligence/TraceabilityReportGenerator.js";


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


const scenarios =
recommender.generate(
    knowledge
);



const generator =
new TestCaseGenerator();


const testCases =
generator.generate(
    scenarios
);



const reportGenerator =
new TraceabilityReportGenerator();


const report =
reportGenerator.generate(
    requirement,
    testCases
);


console.log(report);


console.log(
JSON.stringify(
    report,
    null,
    2
)
);