class MarkdownTableParser {


    parse(tableText) {


        const lines =
            tableText
                .split("\n")
                .map(line => line.trim())
                .filter(line => line);



        if (lines.length < 2) {

            return [];

        }



        const headers =
            this.parseRow(lines[0]);



        const rows = [];



        for (
            let i = 2;
            i < lines.length;
            i++
        ) {


            const values =
                this.parseRow(lines[i]);



            if (values.length !== headers.length) {

                continue;

            }



            const row = {};



            headers.forEach(
                (header, index) => {


                    row[header] =
                        values[index];


                }
            );



            rows.push(row);

        }



        return rows;

    }





    parseRow(line) {


        return line
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(cell =>
                cell.trim()
            );

    }


}


export default MarkdownTableParser;