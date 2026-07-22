import fs from "fs";


class RequirementLoader {


    load(filePath) {


        if (!fs.existsSync(filePath)) {

            throw new Error(
                `Requirement file not found: ${filePath}`
            );

        }


        return fs.readFileSync(
            filePath,
            "utf-8"
        );

    }


}


export default RequirementLoader;