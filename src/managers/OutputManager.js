class OutputManager {

    constructor() {

        this.exporters = new Map();

    }

    registerExporter(format, exporter) {

        if (!format || !exporter) {

            throw new Error(
                "Format và Exporter không được để trống."
            );

        }

        this.exporters.set(
            format.toLowerCase(),
            exporter
        );

    }

    getExporter(format) {

        return this.exporters.get(
            format.toLowerCase()
        );

    }

    export(data, format, outputPath) {

        const exporter =
            this.getExporter(format);

        if (!exporter) {

            throw new Error(
                `Exporter '${format}' chưa được đăng ký.`
            );

        }

        return exporter.export(
            data,
            outputPath
        );

    }

    getSupportedFormats() {

        return Array.from(
            this.exporters.keys()
        );

    }

}

export default OutputManager;