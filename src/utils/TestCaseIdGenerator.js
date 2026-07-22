class TestCaseIdGenerator {

    constructor(prefix = "TC") {

        this.prefix = prefix;

        this.counter = 1;

    }


    generate() {

        const id = `${this.prefix}${String(this.counter).padStart(3, "0")}`;

        this.counter++;

        return id;

    }


    reset(){

        this.counter = 1;

    }

}


export default TestCaseIdGenerator;