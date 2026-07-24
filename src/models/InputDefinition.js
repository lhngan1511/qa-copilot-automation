class InputDefinition {


    constructor(){

        // Tên field trên màn hình
        this.name = "";


        // Kiểu dữ liệu
        // STRING, NUMBER, DATE, BOOLEAN, ARRAY...
        this.dataType = "UNKNOWN";


        // Control trên UI
        // TEXTBOX
        // SELECT
        // CHECKBOX
        // RADIO
        // DATE_PICKER
        // FILE_UPLOAD
        // AUTOCOMPLETE
        this.controlType = "";


        // Bắt buộc nhập hay không
        this.required = false;



        // ==============================
        // Validation Rules
        // ==============================

        this.validation = {

            minLength: null,

            maxLength: null,

            minValue: null,

            maxValue: null,

            format: ""

        };



        // ==============================
        // Option data
        // Dùng cho:
        // SELECT
        // RADIO
        // CHECKBOX
        // ==============================

        this.options = [];



        // ==============================
        // Nguồn dữ liệu
        // Ví dụ:
        // - Master data
        // - API
        // - Database
        // - Static list
        // ==============================

        this.source = "";



        // Mô tả từ file Markdown

        this.description = "";

    }


}


export default InputDefinition;