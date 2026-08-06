/*
 V3RecordingPanel — Banner nhập bản ghi cố định.
 "Nhập bản ghi testcase TCxxx — tên [Nhập xong]".
 Vùng "Dán mã Playwright đã ghi cho TCxxx" để thu source, rồi Nhập xong.
 (Chưa điều khiển Playwright Recorder thật — chỉ dán source.)
*/

export default function V3RecordingPanel({ active, source = "", onSourceChange, busy = false, onStop }) {
    if (!active) return null;

    const label = active.title ? `${active.testCaseId} — ${active.title}` : active.testCaseId;

    return (
        <div className="v3-recording">
            <div className="v3-rec-banner">
                <span className="v3-rec-banner__dot" aria-hidden="true" />
                <span className="v3-rec-banner__text">
                    Nhập bản ghi testcase <b>{label}</b>
                </span>
                <button
                    type="button"
                    className="v3-btn v3-btn--stop"
                    disabled={busy}
                    onClick={() => onStop?.(source)}
                >
                    Nhập xong
                </button>
            </div>
            <div className="v3-rec-source">
                <label htmlFor="v3-rec-code">Dán mã Playwright đã ghi cho {active.testCaseId}</label>
                <textarea
                    id="v3-rec-code"
                    className="v3-rec-source__input"
                    value={source}
                    onChange={e => onSourceChange?.(e.target.value)}
                    placeholder={"await page.goto('...');\nawait page.getByRole('textbox', ...).fill('...');\n..."}
                    spellCheck={false}
                />
            </div>
        </div>
    );
}
