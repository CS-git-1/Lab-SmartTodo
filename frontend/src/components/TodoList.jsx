import TodoItem from "./TodoItem.jsx";

export default function TodoList({ todos, hasTasks = todos.length > 0, onStartCreate, onToggle, onDelete, onEdit, priorityLabels, pendingTaskIds }) {
    if (todos.length === 0) {
        return (
            <ul className="todo-list">
                <li className="empty" role="status">
                    {hasTasks ? (
                        <p>ไม่พบงานที่ตรงกับคำค้นหาหรือตัวกรอง ลองปรับคำค้นหาหรือตัวกรองแล้วดูอีกครั้ง</p>
                    ) : (
                        <>
                            <p>ยังไม่มีงาน เริ่มสร้างงานแรกของคุณได้เลย</p>
                            <button className="filter-button empty-action" type="button" onClick={onStartCreate}>
                                เริ่มสร้างงานแรก
                            </button>
                        </>
                    )}
                </li>
            </ul>
        );
    }

    return (
        <ul className="todo-list">
            {todos.map((todo) => (
                <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    priorityLabels={priorityLabels}
                    isPending={pendingTaskIds?.has(todo.id) ?? false}
                />
            ))}
        </ul>
    );
}
