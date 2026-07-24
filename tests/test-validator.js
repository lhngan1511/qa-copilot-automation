import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import MarkdownParser from "../src/parsers/MarkdownParser.js";
import RequirementValidator from "../src/validators/RequirementValidator.js";


/*
=====================================================

 QA Copilot V2 - RequirementValidator Test

 Flow:

 Requirement Markdown
        ↓
 MarkdownParser
        ↓
 RequirementObject
        ↓
 RequirementValidator
        ↓
 ValidationResult

=====================================================
*/


const currentFile =
    fileURLToPath(
        import.meta.url
    );


const currentDirectory =
    path.dirname(
        currentFile
    );


const projectRoot =
    path.resolve(
        currentDirectory,
        ".."
    );


const requirementFile =
    path.join(
        projectRoot,
        "requirements",
        "thiet-bi.md"
    );


console.log(
    "====================================================="
);

console.log(
    "QA Copilot V2 - RequirementValidator Test"
);

console.log(
    "====================================================="
);

console.log(
    `Project root     : ${projectRoot}`
);

console.log(
    `Requirement file : ${requirementFile}`
);

console.log("");


/*
=====================================================
Step 1 - Check Requirement File
=====================================================
*/


console.log(
    "[1/4] Checking requirement file..."
);


if (
    !fs.existsSync(
        requirementFile
    )
) {

    throw new Error(
        `Requirement file not found: ${requirementFile}`
    );

}


console.log(
    "      ✓ Requirement file found"
);


/*
=====================================================
Step 2 - Read Markdown
=====================================================
*/


console.log(
    "[2/4] Reading Markdown content..."
);


const markdown =
    fs.readFileSync(
        requirementFile,
        "utf-8"
    );


console.log(
    `      ✓ Markdown loaded (${markdown.length} characters)`
);


/*
=====================================================
Step 3 - Parse Requirement
=====================================================
*/


console.log(
    "[3/4] Parsing Markdown..."
);


const parser =
    new MarkdownParser();


const requirement =
    parser.parse(
        markdown
    );


console.log(
    "      ✓ RequirementObject created"
);


/*
=====================================================
Step 4 - Validate Requirement
=====================================================
*/


console.log(
    "[4/4] Validating RequirementObject..."
);


const validator =
    new RequirementValidator();


const validationResult =
    validator.validate(
        requirement
    );


console.log(
    "      ✓ Validation completed"
);


/*
=====================================================
Validation Summary
=====================================================
*/


console.log("");

console.log(
    "====================================================="
);

console.log(
    "Validation Summary"
);

console.log(
    "====================================================="
);

console.log(
    `Valid            : ${validationResult.isValid()}`
);

console.log(
    `Errors           : ${validationResult.errorCount}`
);

console.log(
    `Warnings         : ${validationResult.warningCount}`
);


/*
=====================================================
Errors
=====================================================
*/


if (
    validationResult.errors.length > 0
) {

    console.log("");

    console.log(
        "====================================================="
    );

    console.log(
        "Errors"
    );

    console.log(
        "====================================================="
    );


    validationResult.errors.forEach(
        (
            error,
            index
        ) => {

            console.log(
                `${index + 1}. [${error.code}] ${error.message}`
            );

            console.log(
                `   Path: ${error.path || "(root)"}`
            );

        }
    );

}


/*
=====================================================
Warnings
=====================================================
*/


if (
    validationResult.warnings.length > 0
) {

    console.log("");

    console.log(
        "====================================================="
    );

    console.log(
        "Warnings"
    );

    console.log(
        "====================================================="
    );


    validationResult.warnings.forEach(
        (
            warning,
            index
        ) => {

            console.log(
                `${index + 1}. [${warning.code}] ${warning.message}`
            );

            console.log(
                `   Path: ${warning.path || "(root)"}`
            );

        }
    );

}


/*
=====================================================
ValidationResult JSON
=====================================================
*/


console.log("");

console.log(
    "====================================================="
);

console.log(
    "ValidationResult JSON"
);

console.log(
    "====================================================="
);

console.log(
    JSON.stringify(
        validationResult,
        null,
        2
    )
);


/*
=====================================================
Final Status
=====================================================
*/


console.log("");

console.log(
    "====================================================="
);


if (
    validationResult.isValid()
) {

    console.log(
        "TEST COMPLETED SUCCESSFULLY"
    );

} else {

    console.log(
        "TEST FAILED - REQUIREMENT IS INVALID"
    );

    process.exitCode = 1;

}


console.log(
    "====================================================="
);