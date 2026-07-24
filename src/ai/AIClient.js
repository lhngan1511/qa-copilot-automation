import AIProviderFactory from "../providers/AIProviderFactory.js";

class AIClient {

    constructor() {

        this.provider =
            AIProviderFactory.create();

    }

    async generate(promptObject) {

        return await this.provider.generate(
            promptObject
        );

    }

    getProviderName() {

        return this.provider.constructor.name;

    }

}

export default AIClient;