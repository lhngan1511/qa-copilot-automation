class DateTimeUtils {


    static now() {

        return new Date();

    }



    static getDate() {


        const now = new Date();


        const year = now.getFullYear();


        const month = String(
            now.getMonth() + 1
        ).padStart(2, "0");


        const day = String(
            now.getDate()
        ).padStart(2, "0");


        return `${year}-${month}-${day}`;

    }



    static getTime() {


        const now = new Date();


        const hour = String(
            now.getHours()
        ).padStart(2, "0");


        const minute = String(
            now.getMinutes()
        ).padStart(2, "0");


        const second = String(
            now.getSeconds()
        ).padStart(2, "0");


        return `${hour}:${minute}:${second}`;

    }



    static getTimestamp() {


        const now = new Date();


        const year = now.getFullYear();


        const month = String(
            now.getMonth() + 1
        ).padStart(2, "0");


        const day = String(
            now.getDate()
        ).padStart(2, "0");


        const hour = String(
            now.getHours()
        ).padStart(2, "0");


        const minute = String(
            now.getMinutes()
        ).padStart(2, "0");


        const second = String(
            now.getSeconds()
        ).padStart(2, "0");


        return `${year}${month}${day}_${hour}${minute}${second}`;

    }


}


export default DateTimeUtils;