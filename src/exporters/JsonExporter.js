import fs from "fs";

class JsonExporter {

    export(testCases, outputPath) {

        const json =
            JSON.stringify(
                testCases,
                null,
                2
            );

        fs.writeFileSync(
            outputPath,
            json,
            "utf8"
        );

        console.log(
            `✓ JSON exported: ${outputPath}`
        );

    }

}

export default JsonExporter;