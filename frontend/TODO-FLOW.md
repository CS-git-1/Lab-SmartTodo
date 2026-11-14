# Smart Todo: Add, List, Toggle, Delete

Source repository: [github.com/CS-git-1/smart-todo-curd](https://github.com/CS-git-1/smart-todo-curd)

> Historical UI-only flow from before API integration. The current app requires sign-in and loads/saves tasks through the authenticated backend; localStorage and the Undo flow described below are no longer the active data flow.

เอกสารนี้อธิบาย data flow ของ task และขั้นตอนทดสอบบนหน้าเว็บตามลำดับ **Add → List → Toggle → Delete จน Empty**.

## Component structure

```text
App (owns todos state)
├── TodoSearch
├── TodoForm
├── TodoFilter
└── TodoList
    └── TodoItem (หนึ่งรายการต่อ task)
```

`App` เป็นเจ้าของ `todos` ใน React state และเป็นผู้เปลี่ยนข้อมูลผ่าน handlers. `TodoForm` และ `TodoItem` ส่ง user actions กลับผ่าน callbacks; `TodoList` แสดงแต่ละ task หรือ empty state. แอปซิงก์ `todos` กับ `localStorage` เพื่อเก็บข้อมูลหลัง reload.

## Data and event flow

1. **Add:** `TodoForm` ส่งข้อมูลฟอร์มผ่าน `onAddTodo(payload)`; `App` ตรวจข้อมูล สร้าง ID และเพิ่ม task ใหม่ด้วย `completed: false`.
2. **List:** `App` ส่งรายการที่ผ่าน search/filter ให้ `TodoList`; `TodoList` map รายการเป็น `TodoItem`.
3. **Toggle:** `TodoItem` เรียก `onToggle(todo.id)`; `App` สลับ `completed` เฉพาะ task ที่ ID ตรงกัน แล้ว React render สถานะใหม่.
4. **Delete:** `TodoItem` เรียก `onDelete(todo.id)`; `App` ซ่อน task จากรายการทันที เก็บสำเนาไว้ใน `undoBatch` และแสดงปุ่ม Undo 10 วินาที.
5. **Empty:** เมื่อ `TodoList` ได้ array ว่าง จะแสดงข้อความ empty state.

```text
TodoForm --onAddTodo(payload)--> App state --todos--> TodoList --> TodoItem
TodoItem --onToggle(id)-------> App state --updated todos--> TodoList
TodoItem --onDelete(id)-------> App state --hide task--> TodoList
                                  └── undoBatch + Undo (10 seconds)
TodoList --empty array--------> Empty state
```

## Manual verification: Add → List → Toggle → Delete until Empty

เริ่มจากรายการว่างเพื่อให้ตรวจผลได้ชัด หากมี task เก่าหรือข้อมูลตัวอย่าง ให้ลบออกก่อนเริ่ม และคืน search เป็นค่าว่าง รวมทั้ง status/priority เป็น `all`.

| ลำดับ | ทำบนหน้าเว็บ | ผลที่ต้องเห็น |
| --- | --- | --- |
| Add | กรอก title เช่น `ทดลอง Todo` แล้วกดเพิ่ม | มีข้อความยืนยัน และ task ใหม่มีสถานะ Active |
| List | มองหาแถว `ทดลอง Todo` ในรายการ | title ปรากฏเป็น task ใน TodoList |
| Toggle | กดปุ่มวงกลมหน้ารายการนั้นหนึ่งครั้ง | แถวนั้นแสดง Done และรูปแบบ completed |
| Delete | กดปุ่มลบของแถวนั้น | task `ทดลอง Todo` หายทันที และมีข้อความ Undo 10 วินาที |
| Undo | กด Undo ก่อนครบ 10 วินาที | task ที่ลบใน batch ปัจจุบันกลับมา |
| Expire | ไม่กด Undo จนครบ 10 วินาที | ปุ่ม Undo หาย และ task คงถูกลบจาก state/localStorage |
| Empty | ลบ task ที่เหลือและปล่อยให้ Undo หมดเวลา | TodoList แสดงข้อความ empty state |

ตรวจว่า Toggle เปลี่ยนเฉพาะรายการเป้าหมาย และตรวจ Empty หลังตั้ง filter เป็น `all`; empty ที่เกิดจาก search/filter ไม่ยืนยันว่าไม่มี task ใน state.

## Screenshot evidence

บันทึกภาพหน้าจอจริงจาก browser หลัง Add/List, หลัง Toggle และเมื่อถึง Empty. ภาพควรแสดง task หรือ empty state ที่กำลังยืนยัน และเก็บไว้ใน `Doc/` ของโปรเจกต์. อย่าติ๊กผลในตารางหรือนับว่าทดสอบผ่านจนกว่าจะทำ action บนหน้าเว็บและเห็นผลจริง.

| Evidence | ไฟล์ screenshot | ผล |
| --- | --- | --- |
| Add + List | — | ☐ ยังไม่ได้ทดสอบ |
| Toggle | — | ☐ ยังไม่ได้ทดสอบ |
| Delete จน Empty | — | ☐ ยังไม่ได้ทดสอบ |

## Implementation check (source review)

- Create: `TodoForm` ส่ง payload ให้ `App.handleAddTodo` ซึ่งเพิ่ม task ใน state.
- Read: `TodoList` render `todos` ที่ `App` ส่งให้.
- Toggle: `handleToggle(id)` เปลี่ยน `completed` ของ ID ที่ตรงกัน.
- Delete: `handleDelete(id)` เอา ID ที่เลือกออกจากรายการทันทีและเก็บ task ใน `undoBatch` ชั่วคราว.
- Undo: ปุ่ม Undo คืน task ที่ลบใน batch ปัจจุบัน; timer หมดอายุใน 10 วินาที และ cleanup timer เมื่อ component unmount.
- Clear completed: ล้างงานที่เสร็จแล้วเข้ากลไก Undo batch เดียวกัน.
- Empty: `TodoList` แสดง empty state เมื่อ `todos.length === 0`.

รายการข้างต้นเป็นการตรวจจาก source code; ไม่ใช่ผล browser test. บันทึกสถานะ screenshot ด้านบนหลังทดสอบจริงเท่านั้น.
