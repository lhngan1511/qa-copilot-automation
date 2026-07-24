import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import MarkdownParser from "../src/parsers/MarkdownParser.js";


/*
=====================================================

 Test MarkdownParser

 Purpose:

 - Đọc file requirement Markdown
 - Gửi nội dung vào MarkdownParser
 - Kiểm tra RequirementObject được tạo ra
 - Hiển thị kết quả dưới dạng JSON

 Test file:

 requirements/thiet-bi.md

=====================================================
*/


const __filename =
    fileURLToPath(import.meta.url);


const __dirname =
    path.dirname(__filename);


/*
=====================================================
 Resolve Project Paths
=====================================================
*/


const projectRoot =
    path.resolve(
        __dirname,
        ".."
    );


const requirementFile =
    path.join(
        projectRoot,
        "requirements",
        "thiet-bi.md"
    );


/*
=====================================================
 Utility Functions
=====================================================
*/


function printSection(title) {

    console.log("");

    console.log(
        "====================================================="
    );

    console.log(title);

    console.log(
        "====================================================="
    );

}


function validateRequirementFile(filePath) {

    if (!fs.existsSync(filePath)) {

        throw new Error(
            [
                "Requirement file not found.",
                `Expected path: ${filePath}`,
                "",
                "Please verify that thiet-bi.md exists inside:",
                path.dirname(filePath)
            ].join("\n")
        );

    }

}


function readRequirementFile(filePath) {

    return fs.readFileSync(
        filePath,
        "utf-8"
    );

}


function validateParserResult(result) {

    if (!result) {

        throw new Error(
            "MarkdownParser returned an empty result."
        );

    }


    if (typeof result !== "object") {

        throw new Error(
            "MarkdownParser result must be an object."
        );

    }


    if (!Array.isArray(result.features)) {

        console.warn(
            "⚠ Warning: result.features is not an array."
        );

    }


    if (!Array.isArray(result.commonInputs)) {

        console.warn(
            "⚠ Warning: result.commonInputs is not an array."
        );

    }


    if (!Array.isArray(result.relationships)) {

        console.warn(
            "⚠ Warning: result.relationships is not an array."
        );

    }

}


/*
=====================================================
 Run Test
=====================================================
*/


function runTest() {

    printSection(
        "QA Copilot V2 - MarkdownParser Test"
    );


    console.log(
        `Project root     : ${projectRoot}`
    );

    console.log(
        `Requirement file : ${requirementFile}`
    );


    /*
    =========================
    Step 1
    Validate Requirement File
    =========================
    */


    console.log("");

    console.log(
        "[1/4] Checking requirement file..."
    );


    validateRequirementFile(
        requirementFile
    );


    console.log(
        "      ✓ Requirement file found"
    );


    /*
    =========================
    Step 2
    Read Markdown
    =========================
    */


    console.log(
        "[2/4] Reading Markdown content..."
    );


    const markdown =
        readRequirementFile(
            requirementFile
        );


    if (!markdown.trim()) {

        throw new Error(
            "Requirement Markdown file is empty."
        );

    }


    console.log(
        `      ✓ Markdown loaded (${markdown.length} characters)`
    );


    /*
    =========================
    Step 3
    Parse Markdown
    =========================
    */


    console.log(
        "[3/4] Parsing Markdown..."
    );


    const parser =
        new MarkdownParser();


    const requirementObject =
        parser.parse(
            markdown
        );


    console.log(
        "      ✓ Markdown parsed"
    );


    /*
    =========================
    Step 4
    Validate Result
    =========================
    */


    console.log(
        "[4/4] Validating parser result..."
    );


    validateParserResult(
        requirementObject
    );


    console.log(
        "      ✓ Parser result is valid"
    );


    /*
    =========================
    Print Summary
    =========================
    */


    printSection(
        "Requirement Summary"
    );


    console.log(
        "Module           :",
        requirementObject.module ?? ""
    );


    console.log(
        "Purpose          :",
        requirementObject.purpose ?? ""
    );


    console.log(
    "Permissions      :",
    requirementObject.permissions?.length ?? 0
);


    console.log(
        "Common inputs    :",
        requirementObject.commonInputs?.length ?? 0
    );


    console.log(
        "Features         :",
        requirementObject.features?.length ?? 0
    );


    console.log(
        "Relationships    :",
        requirementObject.relationships?.length ?? 0
    );


    /*
    =========================
    Print Full Object
    =========================
    */


    printSection(
        "RequirementObject JSON"
    );


    console.log(
        JSON.stringify(
            requirementObject,
            null,
            2
        )
    );


    printSection(
        "TEST COMPLETED SUCCESSFULLY"
    );

}


/*
=====================================================
 Error Handler
=====================================================
*/


try {

    runTest();

}
catch (error) {

    printSection(
        "TEST FAILED"
    );


    console.error(
        error.message
    );


    if (error.stack) {

        console.error("");

        console.error(
            error.stack
        );

    }


    process.exitCode = 1;

}