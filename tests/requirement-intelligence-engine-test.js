import RequirementIntelligenceEngine from "../src/engines/RequirementIntelligenceEngine.js";
import RequirementObject from "../src/models/RequirementObject.js";


console.log("\n=================================");
console.log(" REQUIREMENT INTELLIGENCE TEST ");
console.log("=================================\n");


// Tạo requirement giả lập

const requirement = new RequirementObject();


requirement.feature =
    "Thiết bị";


requirement.businessRules = [

    "Mã thiết bị không được trùng.",
    "Không được bỏ trống các trường bắt buộc."

];


requirement.edgeCases = [

    "Mã thiết bị đã tồn tại."

];

requirement.inputDefinitions = [

    {
        name: "Mã thiết bị",
        required: true,
        controlType: "TextBox",
        description: "Mã duy nhất của thiết bị"
    },


    {
        name: "Tên thiết bị",
        required: true,
        controlType: "TextBox",
        description: "Tên thiết bị"
    },


    {
        name: "Loại thiết bị",
        required: true,
        controlType: "Dropdown",
        description: "Danh mục loại thiết bị"
    },

    {
        name: "Tên thiết bị",
        required: true,
        controlType: "TextBox",
        description: "Tên thiết bị",
        minLength: 3,
        maxLength: 100
    }, 

{
    name: "Số lượng",
    required: true,
    type: "NUMBER",
    minValue: 1,
    maxValue: 100
},

{
    name: "Mô tả thiết bị",
    required: false,
    controlType: "TextBox",
    format: "TEXT",
    description: "Thông tin mô tả"
}


];

requirement.edgeCases = [

    "Mã thiết bị đã tồn tại."

];

requirement.feature = "Thêm thiết bị";

requirement.expectedResults = [

    "Hiển thị thông báo thêm thiết bị thành công.",
    "Thiết bị xuất hiện trong danh sách."
];

requirement.conditions = [

    "Người dùng có quyền quản lý thiết bị"

];


requirement.actions = [

    "Thêm thiết bị",
    "Sửa thiết bị",
    "Xóa thiết bị"

];


// Khởi tạo Engine

const engine =
    new RequirementIntelligenceEngine();


// Phân tích

const knowledge =
    engine.analyze(requirement);



console.log("Requirement Knowledge:");

console.log(knowledge);



console.log("\nJSON:");

console.log(
    JSON.stringify(
        knowledge,
        null,
        2
    )
);



console.log("\n=================================");
console.log(" REQUIREMENT INTELLIGENCE COMPLETED ");
console.log("=================================\n");