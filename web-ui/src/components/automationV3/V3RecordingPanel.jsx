/*
 V3RecordingPanel — Banner ghi cố định khi đang ghi.
 "Đang ghi TCxxx — tên [Dừng ghi]".
 Vùng "Dán code Playwright CodeGen" để thu source (record), rồi Dừng ghi.
*/

export default function V3RecordingPanel({ active, source = "", onSourceChange, busy = false, onStop }) {
    if (!active) return null;

    const label = active.title ? `${active.testCaseId} — ${active.title}` : active.testCaseId;

    return (
        <div className="v3-recording">
            <div className="v3-rec-banner">
                <span className="v3-rec-banner__dot" aria-hidden="true" />
                <span className="v3-rec-banner__text">
                    Đang ghi <b>{label}</b>
                </span>
                <button
                    type="button"
                    className="v3-btn v3-btn--stop"
                    disabled={busy}
                    onClick={() => onStop?.(source)}
                >
                    ■ Dừng ghi
                </button>
            </div>
            <div className="v3-rec-source">
                <label htmlFor="v3-rec-code">Dán code đã ghi (Playwright recorder)</label>
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
