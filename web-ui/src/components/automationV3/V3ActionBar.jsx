/*
 V3ActionBar — Thanh hành động khi có testcase được chọn.
 "Đã chọn N testcase" + primary "Tiếp tục ghi testcase" (disabled, chú thích bước sau).
 Không hiển thị nhiều nút batch / Export / Run.
*/

export default function V3ActionBar({ selectedCount = 0, busy = false }) {
    return (
        <div className="v3-actionbar">
            <div className="v3-actionbar__count">
                Đã chọn <b>{selectedCount}</b> testcase
            </div>
            <div className="v3-actionbar__right">
                <span className="v3-actionbar__note">Triển khai ở bước tiếp theo</span>
                <button
                    type="button"
                    className="v3-btn v3-btn--primary v3-btn--disabled"
                    disabled={busy || selectedCount === 0}
                >
                    Tiếp tục ghi testcase
                </button>
            </div>
        </div>
    );
}
