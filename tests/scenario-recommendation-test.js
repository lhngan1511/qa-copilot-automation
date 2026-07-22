import ScenarioRecommendationEngine
from "../src/recommenders/ScenarioRecommendationEngine.js";

import RequirementKnowledge
from "../src/models/RequirementKnowledge.js";



console.log(
`
=================================
 SCENARIO RECOMMENDATION TEST
=================================
`
);



const knowledge =
new RequirementKnowledge();



knowledge.positiveCases = [
    "Thêm thiết bị với dữ liệu hợp lệ"
];


knowledge.negativeCases = [
    "Mã thiết bị đã tồn tại"
];


knowledge.boundaryCases = [
    "Tên thiết bị vượt quá độ dài tối đa"
];


knowledge.dataIntegrityCases = [
    "Mã thiết bị bị trùng"
];



const engine =
new ScenarioRecommendationEngine();



const scenarios =
engine.generate(
    knowledge
);



console.log(scenarios);



console.log(
JSON.stringify(
scenarios,
null,
2
)
);



console.log(
`
=================================
 SCENARIO RECOMMENDATION COMPLETED
=================================
`
);