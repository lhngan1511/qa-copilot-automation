export default function errorHandler(error, _req, res, _next) {
    const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400 ? error.statusCode : 500;

    res.status(statusCode).json({
        success: false,
        data: null,
        error: {
            code: error?.code ?? "INTERNAL_SERVER_ERROR",
            message:
                statusCode === 500
                    ? "Internal server error."
                    : (error?.message ?? "Request failed."),
            details: error?.details ?? null
        }
    });
}
