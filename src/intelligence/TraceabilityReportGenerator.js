import TraceabilityReport from "../models/TraceabilityReport.js";


class TraceabilityReportGenerator {


    generate(
        requirement,
        testCases
    ){


        const report =
            new TraceabilityReport();



        report.feature =
            requirement.feature;



        const requirementList =
            this.collectRequirements(
                requirement
            );



        report.totalRequirements =
            requirementList.length;



        requirementList.forEach(
            item => {


                const matched =
                    testCases.filter(
                        tc =>
                            tc.requirementReference === item
                    );



                report.items.push({

                    requirementReference:item,

                    testCases:
                        matched.map(
                            tc=>tc.id
                        )

                });


                if(
                    matched.length > 0
                ){

                    report.coveredRequirements++;

                }


            }
        );



        if(
            report.totalRequirements > 0
        ){

            report.coveragePercentage =
                Math.round(
                    (
                    report.coveredRequirements /
                    report.totalRequirements
                    )
                    *100
                );

        }



        return report;

    }





    collectRequirements(requirement){


        return [

            ...(requirement.expectedResults || []),

            ...(requirement.businessRules || []),

            ...(requirement.edgeCases || []),


        ];


    }



}


export default TraceabilityReportGenerator;