import { useState } from "react";

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
});
const currentDate = new Date();
const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

export default function TodoItem({ todo, onToggle, onDelete, onEdit, priorityLabels, isPending = false }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editFields, setEditFields] = useState(() => ({
        title: todo.title,
        description: todo.description,
        priority: todo.priority,
        dueDate: todo.dueDate ?? "",
    }));
    const dueDateLabel = todo.dueDate
        ? dateFormatter.format(new Date(`${todo.dueDate}T00:00:00`))
        : "";
    const isOverdue = Boolean(todo.dueDate && todo.dueDate < today && !todo.completed);

    async function handleSave(event) {
        event.preventDefault();
        const result = await onEdit(todo.id, editFields);
        if (result?.ok) setIsEditing(false);
    }

    function cancelEdit() {
        setEditFields({ title: todo.title, description: todo.description, priority: todo.priority, dueDate: todo.dueDate ?? "" });
        setIsEditing(false);
    }

    function startEdit() {
        setEditFields({ title: todo.title, description: todo.description, priority: todo.priority, dueDate: todo.dueDate ?? "" });
        setIsEditing(true);
    }

    return (
        <li className={`task${todo.completed ? " completed" : ""}`}>
            <button
                className="check"
                type="button"
                aria-label={todo.completed ? "ทำเครื่องหมายว่ายังไม่เสร็จ" : "ทำเครื่องหมายว่าเสร็จแล้ว"}
                aria-pressed={todo.completed}
                onClick={() => onToggle(todo.id)}
                disabled={isPending}
            />
            <div className="task-info">
                {isEditing ? (
                    <form className="edit-form" onSubmit={handleSave}>
                        <input className="edit-input" value={editFields.title} maxLength={100} aria-label="แก้ไขชื่องาน" disabled={isPending}
                            onChange={(event) => setEditFields((fields) => ({ ...fields, title: event.target.value }))}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                        />
                        <textarea className="edit-input edit-description" value={editFields.description} maxLength={2000} aria-label="แก้ไขรายละเอียดงาน" placeholder="รายละเอียด (Shift+Enter เพื่อขึ้นบรรทัดใหม่)" disabled={isPending}
                            onChange={(event) => setEditFields((fields) => ({ ...fields, description: event.target.value }))} />
                        <select className="edit-input" value={editFields.priority} aria-label="แก้ไขความสำคัญ" disabled={isPending}
                            onChange={(event) => setEditFields((fields) => ({ ...fields, priority: event.target.value }))}>
                            <option value="low">ความสำคัญต่ำ</option><option value="medium">ความสำคัญกลาง</option><option value="high">ความสำคัญสูง</option>
                        </select>
                        <input className="edit-input" type="date" value={editFields.dueDate} aria-label="แก้ไขวันกำหนดส่ง" disabled={isPending}
                            onChange={(event) => setEditFields((fields) => ({ ...fields, dueDate: event.target.value }))} />
                        <button className="edit-action" type="submit" disabled={isPending}>{isPending ? "กำลังบันทึก..." : "บันทึก"}</button>
                        <button className="edit-action" type="button" onClick={cancelEdit} disabled={isPending}>ยกเลิก</button>
                    </form>
                ) : (
                    <div className="task-title" onDoubleClick={startEdit} title="ดับเบิลคลิกเพื่อแก้ไข">
                        {todo.title}
                    </div>
                )}
                {todo.description && <p className="task-description">{todo.description}</p>}
                <span className="priority" data-priority={todo.priority}>{priorityLabels[todo.priority]}</span>
                {dueDateLabel && (
                    <span className={`due-date${isOverdue ? " is-overdue" : ""}`}>
                        {isOverdue ? "เลยกำหนด" : "กำหนด"} {dueDateLabel}
                    </span>
                )}
            </div>
            <span className={`status-label ${todo.completed ? "status-done" : "status-active"}`}>
                {todo.completed ? "Done" : "Active"}
            </span>
            {!isEditing && <button className="delete-button" type="button" aria-label={`แก้ไขงาน ${todo.title}`} onClick={startEdit} disabled={isPending}>แก้ไข</button>}
            <button className="delete-button" type="button" aria-label={`ลบงาน ${todo.title}`} onClick={() => onDelete(todo.id)} disabled={isPending}>
                {isPending ? "กำลังส่ง..." : "ลบ"}
            </button>
        </li>
    );
}
