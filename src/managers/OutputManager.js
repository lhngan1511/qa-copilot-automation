import fs from "fs";

import JsonExporter from "../exporters/JsonExporter.js";
import MarkdownExporter from "../exporters/MarkdownExporter.js";
import ExcelExporter from "../exporters/ExcelExporter.js";

import FileNameGenerator from "../utils/FileNameGenerator.js";

class OutputManager {

    constructor() {

        this.exporters = {

            json: new JsonExporter(),

            markdown: new MarkdownExporter(),

            excel: new ExcelExporter()

        };

        this.fileNameGenerator =
            new FileNameGenerator();

    }

    export(
        testCases,
        format,
        feature
    ) {

        const exporter =
            this.exporters[format];

        if (!exporter) {

            throw new Error(
                `Unsupported format: ${format}`
            );

        }

        if (!fs.existsSync("./output")) {

            fs.mkdirSync("./output");

        }

        const extension = {

            json: "json",

            markdown: "md",

            excel: "xlsx"

        };

        const fileName =
            this.fileNameGenerator.generate(
                feature,
                "testcases",
                extension[format]
            );

        const outputPath =
            `./output/${fileName}`;

        exporter.export(
            testCases,
            outputPath
        );

        return outputPath;

    }

}

export default OutputManager;