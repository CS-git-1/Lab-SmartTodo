import { useRef, useState } from "react";

const initialFields = { title: "", description: "", priority: "medium", dueDate: "" };

export default function TodoForm({ onAddTodo, titleInputRef }) {
    const [fields, setFields] = useState(initialFields);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const descriptionRef = useRef(null);
    const submissionInProgress = useRef(false);

    function handleChange(event) {
        const { name, value } = event.target;
        setFields((current) => ({ ...current, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (submissionInProgress.current) return;
        submissionInProgress.current = true;
        setIsSubmitting(true);
        try {
            const result = await onAddTodo(fields);
            if (result?.ok) setFields(initialFields);
        } finally {
            submissionInProgress.current = false;
            setIsSubmitting(false);
        }
    }

    function insertBullet() {
        const input = descriptionRef.current;
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const before = fields.description.slice(0, start);
        const after = fields.description.slice(end);
        const prefix = start === 0 || before.endsWith("\n") ? "" : "\n";
        const insertion = `${prefix}• `;
        const nextDescription = `${before}${insertion}${after}`;
        setFields((current) => ({ ...current, description: nextDescription }));
        requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(start + insertion.length, start + insertion.length);
        });
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <input
                ref={titleInputRef}
                id="new-task-title"
                name="title"
                type="text"
                placeholder="เพิ่มงานใหม่..."
                maxLength={300}
                aria-label="ชื่องาน"
                value={fields.title}
                onChange={handleChange}
                disabled={isSubmitting}
                required
            />
            <textarea
                ref={descriptionRef}
                name="description"
                placeholder="รายละเอียด (ไม่บังคับ) — Shift+Enter เพื่อขึ้นบรรทัดใหม่"
                maxLength={2000}
                aria-label="รายละเอียดงาน"
                value={fields.description}
                onChange={handleChange}
                disabled={isSubmitting}
            />
            <button className="bullet-button" type="button" onClick={insertBullet} disabled={isSubmitting}>• เพิ่มรายการ</button>
            <select name="priority" value={fields.priority} onChange={handleChange} aria-label="ระดับความสำคัญ" disabled={isSubmitting}>
                <option value="low">ความสำคัญต่ำ</option>
                <option value="medium">ความสำคัญกลาง</option>
                <option value="high">ความสำคัญสูง</option>
                <option value="urgent">เร่งด่วน</option>
            </select>
            <label className="due-date-field">
                <span>กำหนดเสร็จ</span>
                <input name="dueDate" type="date" value={fields.dueDate} onChange={handleChange} aria-label="วันที่ควรเสร็จ" disabled={isSubmitting} />
            </label>
            <button className="add-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "กำลังบันทึก..." : "＋ เพิ่มงาน"}
            </button>
        </form>
    );
}
