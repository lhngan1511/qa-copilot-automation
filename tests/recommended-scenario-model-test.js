import RecommendedScenario
from "../src/models/RecommendedScenario.js";


console.log(
`
=================================
 RECOMMENDED SCENARIO MODEL TEST
=================================
`
);



const scenario =
new RecommendedScenario({

    id:"SC001",

    title:"Kiểm tra mã thiết bị bị trùng",

    type:"NEGATIVE",

    priority:"HIGH",

    reason:"Data Integrity Risk",

    source:"BR01"

});



console.log(scenario);



console.log(
JSON.stringify(
scenario,
null,
2
)
);



console.log(
`
=================================
 RECOMMENDED SCENARIO MODEL COMPLETED
=================================
`
);