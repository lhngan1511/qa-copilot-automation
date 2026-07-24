import fs from "fs";
import path from "path";

class JsonExporter {

    export(testCases, featureName) {

        const outputDir = "./outputs/json";

        if (!fs.existsSync(outputDir)) {

            fs.mkdirSync(
                outputDir,
                { recursive: true }
            );

        }

        const safeName =
            (featureName || "testcases")
                .replace(/[\\/:*?"<>|]/g, "_")
                .replace(/\s+/g, "_");

        const filePath =
            path.join(
                outputDir,
                `${safeName}_testcases.json`
            );

        fs.writeFileSync(

            filePath,

            JSON.stringify(
                testCases,
                null,
                2
            ),

            "utf8"

        );

        console.log(
            `✓ JSON exported: ${filePath}`
        );

        return filePath;

    }

}

export default JsonExporter;