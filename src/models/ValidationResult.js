/*
=====================================================

 ValidationResult

 Purpose:

 - Lưu kết quả kiểm tra RequirementObject
 - Phân biệt lỗi nghiêm trọng và cảnh báo
 - Cho phép pipeline quyết định có tiếp tục hay không

 Error:

 - Dữ liệu không hợp lệ
 - Pipeline không nên tiếp tục

 Warning:

 - Dữ liệu chưa đầy đủ
 - Pipeline vẫn có thể tiếp tục

=====================================================
*/


export default class ValidationResult {


    constructor() {

        /*
        =============================================
        Validation Status
        =============================================
        */


        this.valid = true;


        /*
        =============================================
        Validation Messages
        =============================================
        */


        this.errors = [];

        this.warnings = [];


        /*
        =============================================
        Validation Statistics
        =============================================
        */


        this.errorCount = 0;

        this.warningCount = 0;

    }


    /*
    =================================================
    Add Error
    =================================================
    */


    addError(
        code,
        message,
        path = ""
    ) {

        this.errors.push({
            code,
            message,
            path
        });


        this.valid = false;


        this.refreshStatistics();

    }


    /*
    =================================================
    Add Warning
    =================================================
    */


    addWarning(
        code,
        message,
        path = ""
    ) {

        this.warnings.push({
            code,
            message,
            path
        });


        this.refreshStatistics();

    }


    /*
    =================================================
    Status Helpers
    =================================================
    */


    hasErrors() {

        return this.errors.length > 0;

    }


    hasWarnings() {

        return this.warnings.length > 0;

    }


    isValid() {

        return !this.hasErrors();

    }


    /*
    =================================================
    Statistics
    =================================================
    */


    refreshStatistics() {

        this.errorCount =
            this.errors.length;


        this.warningCount =
            this.warnings.length;


        this.valid =
            this.errorCount === 0;

    }


    /*
    =================================================
    Summary
    =================================================
    */


    getSummary() {

        return {
            valid:
                this.isValid(),

            errorCount:
                this.errors.length,

            warningCount:
                this.warnings.length
        };

    }


    /*
    =================================================
    JSON Output
    =================================================
    */


    toJSON() {

        return {
            valid:
                this.isValid(),

            errorCount:
                this.errors.length,

            warningCount:
                this.warnings.length,

            errors:
                this.errors,

            warnings:
                this.warnings
        };

    }

}