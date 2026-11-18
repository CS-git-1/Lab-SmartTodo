import { useEffect, useRef, useState } from "react";
import AuthForm from "./components/AuthForm.jsx";
import TodoFilter from "./components/TodoFilter.jsx";
import TodoForm from "./components/TodoForm.jsx";
import TodoList from "./components/TodoList.jsx";
import TodoSearch from "./components/TodoSearch.jsx";
import { getCurrentUser, logout } from "./api/authApi.js";
import { createTask, deleteTask, listTasks, replaceTask } from "./api/taskApi.js";
import "./App.css";

const priorityLabels = { low: "ความสำคัญน้อย", medium: "ความสำคัญปานกลาง", high: "ความสำคัญมาก", urgent: "เร่งด่วน" };
const allowedPriorities = ["low", "medium", "high", "urgent"];

function isValidDateString(value) {
    if (value === null || value === "") return true;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [todos, setTodos] = useState([]);
    const [pendingTaskIds, setPendingTaskIds] = useState(() => new Set());
    const [isClearing, setIsClearing] = useState(false);
    const pendingTaskIdsRef = useRef(new Set());
    const clearInProgressRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [messageType, setMessageType] = useState("");
    const titleInputRef = useRef(null);

    useEffect(() => {
        if (!isAuthenticated) return undefined;

        const controller = new AbortController();

        // FIX #4: แยก getCurrentUser กับ listTasks ออกจากกัน
        // เพื่อให้ setUser ถูกเรียกได้แม้ listTasks จะ fail
        getCurrentUser()
            .then((currentUser) => {
                setUser(currentUser);
                return listTasks({}, { signal: controller.signal });
            })
            .then((tasks) => {
                setTodos(tasks);
                setLoadError("");
                setMessage("");
                setMessageType("");
            })
            .catch((error) => {
                if (error.name === "AbortError") return;
                setLoadError(error.message || "โหลดรายการไม่สำเร็จ");
                if (error.status === 401) signOut();
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [isAuthenticated, loadAttempt]);

    function signOut() {
        logout().catch(() => {});
        setIsAuthenticated(false);
        setUser(null);
        setTodos([]);
        setIsLoading(false);
    }
    function acceptAuthentication(result) {
        setUser(result.user);
        setLoadError("");
        setIsLoading(true);
        setIsAuthenticated(true);
    }

    function retryLoad() {
        setLoadError("");
        setIsLoading(true);
        setLoadAttempt((attempt) => attempt + 1);
    }

    function showMessage(text, error = false) {
        setMessage(text);
        setIsError(error);
        setMessageType(error ? "error" : "success");
    }

    function showPendingMessage(text) {
        setMessage(text);
        setIsError(false);
        setMessageType("pending");
    }

    function actionErrorMessage(error, action, fallback) {
        const reason = error?.message || fallback;
        if (error?.status === 400 || error?.status === 422) {
            return `${reason} ตรวจข้อมูลตามข้อความแล้วลอง${action}อีกครั้ง`;
        }
        if (error?.status === 401) {
            return `${reason} เซสชันอาจหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง`;
        }
        if (error?.status === 404) {
            return `${reason} โหลดรายการล่าสุดก่อน แล้วลอง${action}อีกครั้ง`;
        }
        if (error?.status === 409) {
            return `${reason} ตรวจสอบรายการล่าสุดแล้วลอง${action}อีกครั้ง`;
        }
        return `${reason} ตรวจสอบการเชื่อมต่อแล้วลอง${action}อีกครั้ง`;
    }

    function beginTaskRequest(id) {
        if (pendingTaskIdsRef.current.has(id)) return false;
        pendingTaskIdsRef.current.add(id);
        setPendingTaskIds(new Set(pendingTaskIdsRef.current));
        return true;
    }

    function finishTaskRequest(id) {
        pendingTaskIdsRef.current.delete(id);
        setPendingTaskIds(new Set(pendingTaskIdsRef.current));
    }

    async function handleAddTodo({ title, description, priority, dueDate }) {
        const cleanTitle = typeof title === "string" ? title.trim() : "";
        // FIX #7: title max 300 ตรงกับ backend
        if (!cleanTitle || cleanTitle.length > 300 || !allowedPriorities.includes(priority)
            || typeof description !== "string" || !isValidDateString(dueDate)) {
            showMessage("ตรวจสอบชื่อ รายละเอียด ระดับความสำคัญ และวันกำหนดส่ง", true);
            return { ok: false };
        }
        showPendingMessage("กำลังบันทึกงาน...");
        try {
            const todo = await createTask({ title: cleanTitle, description: description.trim(), priority, dueDate: dueDate || null });
            setTodos((items) => [...items, todo]);
            showMessage(`เพิ่มงาน "${cleanTitle}" แล้ว`);
            return { ok: true };
        } catch (error) {
            showMessage(actionErrorMessage(error, "เพิ่มงาน", "เพิ่มงานไม่สำเร็จ"), true);
            return { ok: false };
        }
    }

    async function handleToggle(id) {
        const current = todos.find((todo) => todo.id === id);
        if (!current || !beginTaskRequest(id)) return;
        showPendingMessage("กำลังบันทึกสถานะงาน...");
        try {
            const saved = await replaceTask(id, { ...current, completed: !current.completed });
            setTodos((items) => items.map((todo) => todo.id === id ? saved : todo));
            showMessage("อัปเดตสถานะงานแล้ว");
        } catch (error) { showMessage(actionErrorMessage(error, "เปลี่ยนสถานะ", "อัปเดตสถานะไม่สำเร็จ"), true); }
        finally { finishTaskRequest(id); }
    }

    async function handleDelete(id) {
        if (!beginTaskRequest(id)) return;
        showPendingMessage("กำลังลบงาน...");
        try {
            await deleteTask(id);
            setTodos((items) => items.filter((todo) => todo.id !== id));
            showMessage("ลบงานแล้ว");
        } catch (error) { showMessage(actionErrorMessage(error, "ลบงาน", "ลบงานไม่สำเร็จ"), true); }
        finally { finishTaskRequest(id); }
    }

    async function handleEdit(id, changes) {
        const current = todos.find((todo) => todo.id === id);
        const cleanTitle = typeof changes.title === "string" ? changes.title.trim() : "";
        // FIX #7: title max 300 ตรงกับ backend
        if (!current || !cleanTitle || cleanTitle.length > 300 || typeof changes.description !== "string"
            || changes.description.length > 2000 || !allowedPriorities.includes(changes.priority)
            || !isValidDateString(changes.dueDate)) {
            showMessage("ข้อมูล task ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง", true);
            return { ok: false };
        }
        if (!beginTaskRequest(id)) return { ok: false };
        showPendingMessage("กำลังบันทึกการแก้ไข...");
        try {
            const saved = await replaceTask(id, {
                ...changes,
                title: cleanTitle,
                dueDate: changes.dueDate || null,
                completed: current.completed,
            });
            setTodos((items) => items.map((todo) => todo.id === id ? saved : todo));
            showMessage("บันทึกการแก้ไขแล้ว");
            return { ok: true };
        } catch (error) {
            showMessage(actionErrorMessage(error, "บันทึกการแก้ไข", "แก้ไขงานไม่สำเร็จ"), true);
            return { ok: false };
        } finally { finishTaskRequest(id); }
    }

    async function handleClearCompleted() {
        const completed = todos.filter((todo) => todo.completed);
        if (!completed.length || clearInProgressRef.current || completed.some((todo) => pendingTaskIdsRef.current.has(todo.id))) return;
        clearInProgressRef.current = true;
        setIsClearing(true);
        showPendingMessage("กำลังลบงานที่เสร็จแล้ว...");
        completed.forEach((todo) => pendingTaskIdsRef.current.add(todo.id));
        setPendingTaskIds(new Set(pendingTaskIdsRef.current));
        try {
            const results = await Promise.allSettled(completed.map((todo) => deleteTask(todo.id)));
            const failedRequest = results.find((result) => result.status === "rejected");
            if (failedRequest) {
                const latestTodos = await listTasks().catch(() => null);
                if (latestTodos) setTodos(latestTodos);
                throw failedRequest.reason;
            }
            const deleted = new Set(completed.map((todo) => todo.id));
            setTodos((items) => items.filter((todo) => !deleted.has(todo.id)));
            showMessage(`ลบงานที่เสร็จแล้ว ${completed.length} รายการ`);
        } catch (error) {
            showMessage(actionErrorMessage(error, "ล้างงานที่เสร็จแล้ว", "ล้างรายการไม่สำเร็จ"), true);
        } finally {
            completed.forEach((todo) => pendingTaskIdsRef.current.delete(todo.id));
            setPendingTaskIds(new Set(pendingTaskIdsRef.current));
            clearInProgressRef.current = false;
            setIsClearing(false);
        }
    }

    const query = searchKeyword.trim().toLocaleLowerCase();
    const filteredTodos = todos.filter((todo) => {
        // FIX #3 (null guard): ใช้ optional chaining กัน crash ถ้า description เป็น null
        const matchesSearch = !query || [todo.title, todo.description].some((value) => value?.toLocaleLowerCase().includes(query));
        const matchesStatus = statusFilter === "all"
            || (statusFilter === "active" && !todo.completed)
            || (statusFilter === "completed" && todo.completed);
        return matchesSearch && matchesStatus && (priorityFilter === "all" || todo.priority === priorityFilter);
    });
    const counts = {
        all: todos.length,
        active: todos.filter((todo) => !todo.completed).length,
        completed: todos.filter((todo) => todo.completed).length,
    };

    if (!isAuthenticated) return <AuthForm onAuthenticated={acceptAuthentication} />;
    if (isLoading && !user) return <main className="app"><p role="status">กำลังเชื่อมต่อ...</p></main>;

    return (
        <main className="app">
            <p className="eyebrow">จัดระเบียบวันของคุณ</p>
            <h1><span className="title-gradient">รายการที่ต้องทำ</span></h1>
            <p className="intro">ค่อย ๆ ทำทีละอย่าง แล้ววันนี้จะไปได้ไกลกว่าที่คิด</p>
            <section className="panel" aria-label="จัดการรายการงาน">
                <div className="section-head">
                    <h2>งานของฉัน</h2>
                    <span>{user?.displayName || user?.email}</span>
                    <button className="filter-button" type="button" onClick={signOut}>ออกจากระบบ</button>
                </div>
                <div className="search-section">
                    <TodoSearch keyword={searchKeyword} onSearchChange={setSearchKeyword} />
                    <span className="section-divider" aria-hidden="true">หรือเพิ่มงานใหม่</span>
                </div>
                <TodoForm onAddTodo={handleAddTodo} titleInputRef={titleInputRef} />
                <p className={`form-message${messageType ? ` ${messageType}` : ""}`}
                    role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"}>{message}</p>
                <div className="section-head">
                    {/* FIX #2: ลบ h2 ซ้ำออก เหลือแค่ count */}
                    <span className="count">{filteredTodos.length} รายการที่ตรงเงื่อนไข</span>
                </div>
                <TodoFilter currentStatus={statusFilter} currentPriority={priorityFilter} counts={counts}
                    onStatusChange={setStatusFilter} onPriorityChange={setPriorityFilter} onClearCompleted={handleClearCompleted}
                    isClearing={isClearing} />
                {isLoading ? <p role="status">กำลังโหลดรายการ...</p> : loadError ? (
                    <div className="form-message error" role="alert">
                        <span>{loadError}</span>
                        <button className="filter-button" type="button" onClick={retryLoad}>ลองโหลดอีกครั้ง</button>
                    </div>
                ) : (
                    <TodoList todos={filteredTodos} hasTasks={todos.length > 0}
                        onStartCreate={() => titleInputRef.current?.focus()}
                        onToggle={handleToggle} onDelete={handleDelete}
                        pendingTaskIds={pendingTaskIds}
                        onEdit={handleEdit} priorityLabels={priorityLabels} />
                )}
            </section>
        </main>
    );
}
