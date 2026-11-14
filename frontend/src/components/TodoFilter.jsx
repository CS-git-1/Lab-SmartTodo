const statuses = [
    { value: "all", label: "ทั้งหมด" },
    { value: "active", label: "ยังไม่เสร็จ" },
    { value: "completed", label: "เสร็จแล้ว" },
];

export default function TodoFilter({
    currentStatus,
    currentPriority,
    counts,
    onStatusChange,
    onPriorityChange,
    onClearCompleted,
    isClearing = false,
}) {
    return (
        <div className="filter-panel">
            <div className="todo-filters" role="group" aria-label="กรองตามสถานะ">
                {statuses.map((status) => (
                    <button
                        key={status.value}
                        className={`filter-button${currentStatus === status.value ? " is-selected" : ""}`}
                        type="button"
                        aria-pressed={currentStatus === status.value}
                        onClick={() => onStatusChange(status.value)}
                    >
                        {status.label} <span className="filter-count">{counts[status.value]}</span>
                    </button>
                ))}
            </div>
            <div className="priority-filter-row">
                <label className="priority-filter-field">
                    <span>ความสำคัญ</span>
                    <select value={currentPriority} onChange={(event) => onPriorityChange(event.target.value)} aria-label="กรองตามระดับความสำคัญ">
                        <option value="all">ทุกระดับ</option>
                        <option value="high">สูง</option>
                        <option value="medium">กลาง</option>
                        <option value="low">ต่ำ</option>
                    </select>
                </label>
                {counts.completed > 0 && (
                    <button className="clear-completed-button" type="button" onClick={onClearCompleted} disabled={isClearing}>
                        {isClearing ? "กำลังลบ..." : "ล้างงานที่เสร็จแล้ว"}
                    </button>
                )}
            </div>
        </div>
    );
}
