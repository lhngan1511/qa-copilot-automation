class InputDefinition {


    constructor(){

        this.name = "";

        this.type = "UNKNOWN";

        this.required = false;

        this.format = "";

        this.minLength = null;

        this.maxLength = null;

        this.minValue = null;

        this.maxValue = null;


        // thông tin từ Markdown

        this.controlType = "";

        this.source = "";

        this.description = "";

    }


}


export default InputDefinition;