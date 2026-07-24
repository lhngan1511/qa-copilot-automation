class RequirementObject {


    constructor() {


        // =====================================
        // Requirement Identity
        // =====================================

        this.id = "";



        // =====================================
        // Module Information
        // Ví dụ: Thiết bị
        // =====================================

        this.module = "";



        // Giữ tương thích tạm thời với code cũ.
        // Giá trị này sẽ bằng module.
        this.feature = "";



        // =====================================
        // General Information
        // =====================================

        this.purpose = "";

        this.description = "";



        // =====================================
        // Module-level Permissions
        // =====================================

        this.permissions = [];



        // =====================================
        // Shared Data Definitions
        // Dữ liệu dùng chung cho các tính năng
        // =====================================

        this.commonInputs = [];



        // Giữ tương thích với pipeline cũ.
        // Sau khi parse, inputDefinitions sẽ trỏ
        // đến cùng dữ liệu với commonInputs.
        this.inputDefinitions = [];



        // =====================================
        // Data Relationships
        // =====================================

        this.relationships = [];



        // =====================================
        // Features
        // Ví dụ:
        // - Thêm thiết bị
        // - Sửa thiết bị
        // - Xóa thiết bị
        // - Tìm kiếm thiết bị
        // =====================================

        this.features = [];



        // =====================================
        // Compatibility Fields
        // Các field này được tổng hợp từ features
        // để những analyzer cũ vẫn có thể hoạt động.
        // =====================================

        this.actions = [];

        this.businessRules = [];

        this.expectedResults = [];

        this.edgeCases = [];

        this.conditions = [];



        // =====================================
        // Intelligence Metadata
        // =====================================

        this.questions = [];

        this.notes = [];



        // =====================================
        // Version
        // =====================================

        this.version = "2.0";


    }



    addFeature(feature) {


        if (!feature) {

            return;

        }


        this.features.push(feature);


        if (
            feature.name
            &&
            !this.actions.includes(feature.name)
        ) {

            this.actions.push(feature.name);

        }


        this.mergeUnique(
            this.businessRules,
            feature.businessRules
        );


        this.mergeUnique(
            this.expectedResults,
            feature.expectedResults
        );


        this.mergeUnique(
            this.edgeCases,
            feature.exceptions
        );


        this.mergeUnique(
            this.conditions,
            feature.preconditions
        );


    }



    addCommonInput(input) {


        if (!input) {

            return;

        }


        this.commonInputs.push(input);


        // Giữ đồng bộ cho code cũ.
        this.inputDefinitions =
            this.commonInputs;


    }



    addRelationship(relationship) {


        if (!relationship) {

            return;

        }


        this.relationships.push(
            relationship
        );


    }



    mergeUnique(
        target,
        source
    ) {


        if (
            !Array.isArray(target)
            ||
            !Array.isArray(source)
        ) {

            return;

        }


        source.forEach(item => {


            if (
                item !== undefined
                &&
                item !== null
                &&
                item !== ""
                &&
                !target.includes(item)
            ) {

                target.push(item);

            }


        });


    }


}


export default RequirementObject;