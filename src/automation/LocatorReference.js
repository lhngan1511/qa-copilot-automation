/**
 * Model Locator Reference.
 * Locator phải đến từ Reference hoặc được người dùng xác nhận.
 * AI chỉ được đề xuất locator draft (strategy/value).
 */
export default class LocatorReference {
    constructor({
        locatorKey = "",
        strategy = "",
        value = "",
        confirmed = false,
        source = "USER"
    } = {}) {
        this.locatorKey = locatorKey;
        this.strategy = strategy; // getByLabel | getByTestId | getByRole | getByPlaceholder | getByText | css
        this.value = value;
        this.confirmed = confirmed; // false => draft cần duyệt
        this.source = source; // USER | AI_PROPOSAL
    }

    get isDraft() {
        return !this.confirmed;
    }

    toJSON() {
        return {
            locatorKey: this.locatorKey,
            strategy: this.strategy,
            value: this.value,
            confirmed: this.confirmed,
            source: this.source
        };
    }
}
