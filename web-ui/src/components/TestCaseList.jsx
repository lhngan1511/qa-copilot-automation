import TestDataReadinessBadge from "./TestDataReadinessBadge.jsx";
import { groupTestCases, testCaseId } from "../utils/testCaseReview.js";

export default function TestCaseList({ testCases, selectedId, dirtyIds, onSelect }) {
    const groups = groupTestCases(testCases);

    return (
        <nav className="testcase-list" aria-label="Danh sách testcase">
            {Object.entries(groups).map(([module, features]) => (
                <section key={module}>
                    <h5>{module}</h5>
                    {Object.entries(features).map(([feature, types]) => (
                        <div className="testcase-group" key={`${module}-${feature}`}>
                            <h6>{feature}</h6>
                            {Object.entries(types).map(([type, cases]) => (
                                <div key={`${module}-${feature}-${type}`}>
                                    <p className="testcase-group__type">{type}</p>
                                    <ul>
                                        {cases.map(testCase => {
                                            const id = testCaseId(testCase);
                                            const selected = id === selectedId;
                                            return (
                                                <li key={id}>
                                                    <button
                                                        className={`testcase-list__item ${
                                                            selected
                                                                ? "testcase-list__item--selected"
                                                                : ""
                                                        }`}
                                                        type="button"
                                                        aria-current={selected ? "true" : undefined}
                                                        onClick={() => onSelect(id)}
                                                    >
                                                        <span>
                                                            <strong>{id}</strong>
                                                            {dirtyIds.has(id) && <em>Chưa lưu</em>}
                                                        </span>
                                                        <span>
                                                            {testCase.title || "Chưa có tiêu đề"}
                                                        </span>
                                                        <TestDataReadinessBadge
                                                            status={testCase.executionReadiness}
                                                        />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ))}
                </section>
            ))}
        </nav>
    );
}
