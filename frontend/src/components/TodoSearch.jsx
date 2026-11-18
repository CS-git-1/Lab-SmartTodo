import { useEffect, useState } from "react";

export default function TodoSearch({ keyword, onSearchChange }) {
    const [draft, setDraft] = useState(keyword);

    // FIX #5: sync draft กับ keyword prop เมื่อ parent reset ค่า (เช่น ตอน logout)
    useEffect(() => {
        setDraft(keyword);
    }, [keyword]);

    function handleSubmit(event) {
        event.preventDefault();
        onSearchChange(draft);
    }

    return (
        <form className="search-form" onSubmit={handleSubmit}>
            <input
                className="search-input"
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="ค้นหางาน..."
                aria-label="ค้นหาในชื่องานหรือรายละเอียด"
            />
            <button className="search-button" type="submit">ค้นหา</button>
        </form>
    );
}
