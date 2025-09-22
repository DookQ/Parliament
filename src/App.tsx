import React, { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

/* -------------------- Types & Schema -------------------- */
type Member = {
  id: string;
  prefix: "นาย" | "นาง" | "นางสาว" | "อื่นๆ";
  firstName: string;
  lastName: string;
  photo?: string; // dataURL
  workHistory: string;
  ministerPosition?: string;
  ministry?: string;
  party: string;
};

const memberSchema = z.object({
  prefix: z.enum(["นาย", "นาง", "นางสาว", "อื่นๆ"]),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  // รับเป็น File | null
  photoFile: z.instanceof(File).nullable().optional(),
  workHistory: z.string().min(1, "ใส่ประวัติ/ผลงาน"),
  ministerPosition: z.string().optional(),
  ministry: z.string().optional(),
  party: z.string().min(1, "ใส่ชื่อพรรค"),
});
type MemberFormValues = z.infer<typeof memberSchema>;

/* -------------------- Utils -------------------- */
const safeUUID = () => {
  try {
    // บางเครื่อง/HTTP อาจไม่มี randomUUID
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* -------------------- Error Boundary กันจอขาว -------------------- */
class Boundary extends React.Component<
  { children: React.ReactNode },
  { err?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = {};
  }
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.error("UI crashed:", err);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen grid place-items-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6">
          <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-sm mb-4">
              หน้าแอปหยุดทำงานชั่วคราว: {this.state.err.message}
            </p>
            <button
              onClick={() => (window.location.href = window.location.href)}
              className="rounded-lg px-4 py-2 bg-black text-white dark:bg-white dark:text-black"
            >
              รีเฟรชหน้า
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------------------- App -------------------- */
const initialValues: MemberFormValues = {
  prefix: "นาย",
  firstName: "",
  lastName: "",
  photoFile: null,
  workHistory: "",
  ministerPosition: "",
  ministry: "",
  party: "",
};

export default function App() {
  return (
    <Boundary>
      <InnerApp />
    </Boundary>
  );
}

function InnerApp() {
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const raw = localStorage.getItem("members");
      return raw ? (JSON.parse(raw) as Member[]) : [];
    } catch {
      return [];
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("members", JSON.stringify(members));
    } catch (e) {
      console.error("Failed to persist members:", e);
    }
  }, [members]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: initialValues,
  });

  // พรีวิวไฟล์: ป้องกันจอขาวด้วยการเช็คว่าค่าเป็น File จริงๆ
  const file = watch("photoFile");
  const objectUrlRef = useRef<string | null>(null);

  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      // cleanup จะรันตอนไฟล์เปลี่ยนหรือคอมโพเนนต์ unmount -> ค่อย revoke ตอนนั้น
      return () => URL.revokeObjectURL(url);
    } else {
      setPreview(null);
    }
  }, [file]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    try {
      let dataUrl: string | undefined;
      if (values.photoFile instanceof File) {
        dataUrl = await fileToDataUrl(values.photoFile);
      }

      if (editingId) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === editingId
              ? {
                ...m,
                prefix: values.prefix,
                firstName: values.firstName,
                lastName: values.lastName,
                workHistory: values.workHistory,
                ministerPosition: values.ministerPosition || "",
                ministry: values.ministry || "",
                party: values.party,
                photo: dataUrl ?? m.photo,
              }
              : m
          )
        );
        setEditingId(null);
      } else {
        setMembers((prev) => [
          ...prev,
          {
            id: safeUUID(),
            prefix: values.prefix,
            firstName: values.firstName,
            lastName: values.lastName,
            workHistory: values.workHistory,
            ministerPosition: values.ministerPosition || "",
            ministry: values.ministry || "",
            party: values.party,
            photo: dataUrl, // อาจว่างได้ถ้าไม่ได้ตั้ง rules บังคับ
          },
        ]);
      }

      reset(initialValues);
      clearErrors();
    } catch (e) {
      // ถ้าเกิด exception ระหว่างอ่านไฟล์/แปลง dataURL
      console.error("submit error:", e);
      alert("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    }
  });

  const onEdit = (m: Member) => {
    setEditingId(m.id);
    reset({
      prefix: m.prefix,
      firstName: m.firstName,
      lastName: m.lastName,
      photoFile: null, // ไม่บังคับต้องเลือกใหม่
      workHistory: m.workHistory,
      ministerPosition: m.ministerPosition ?? "",
      ministry: m.ministry ?? "",
      party: m.party,
    });
  };

  const onDelete = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    if (editingId === id) {
      setEditingId(null);
      reset(initialValues);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6">
        {/* FORM */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
          <h1 className="text-xl font-semibold mb-4">
            สมาชิกผู้แทนราษฎร
          </h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">คำนำหน้า</label>
              <select
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                {...register("prefix")}
              >
                <option>นาย</option>
                <option>นาง</option>
                <option>นางสาว</option>
                <option>อื่นๆ</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">ชื่อ</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                  {...register("firstName")}
                  placeholder="ชื่อ"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">นามสกุล</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                  {...register("lastName")}
                  placeholder="นามสกุล"
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Upload รูปแบบปลอดภัย */}
            <div>
              <label className="block text-sm mb-1">รูปถ่าย 2 นิ้ว</label>
              <Controller
                name="photoFile"
                control={(/* from useForm */ { control } as any).control}
                rules={{ required: !editingId ? "กรุณาอัปโหลดรูป" : false }}
                render={({ field }) => (
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-200 dark:file:bg-gray-700 file:px-3 file:py-2"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      field.onChange(f);
                    }}
                  />
                )}
              />
              {preview && (
                <div className="mt-2">
                  <img
                    src={preview}
                    alt="preview"
                    className="h-24 w-20 object-cover rounded-md border border-gray-300 dark:border-gray-700 bg-white"
                    onError={(e) => {
                      console.error('Preview failed:', preview);
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {errors.photoFile && (
                <p className="text-red-500 text-sm">
                  {String(errors.photoFile.message)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm mb-1">
                ประวัติการทำงาน / ผลงานที่ผ่านมา
              </label>
              <textarea
                rows={4}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                {...register("workHistory")}
                placeholder="สรุปประสบการณ์/ผลงาน"
              />
              {errors.workHistory && (
                <p className="text-red-500 text-sm">
                  {errors.workHistory.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">ตำแหน่งรัฐมนตรี</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                  {...register("ministerPosition")}
                  placeholder="เช่น รัฐมนตรีว่าการ"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">กระทรวง</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                  {...register("ministry")}
                  placeholder="เช่น กระทรวงศึกษาธิการ"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">สังกัดพรรคการเมือง</label>
              <input
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                {...register("party")}
                placeholder="ชื่อพรรค"
              />
              {errors.party && (
                <p className="text-red-500 text-sm">{errors.party.message}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2 bg-black text-white dark:bg-white dark:text-black disabled:opacity-60"
              >
                {editingId ? "บันทึกการแก้ไข" : "เพิ่มสมาชิก"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  reset(initialValues);
                }}
                className="rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-700"
              >
                ล้างฟอร์ม
              </button>
            </div>
          </form>
        </div>

        {/* LIST */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">รายชื่อสมาชิกผู้แทนราษฎร</h2>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีข้อมูล</p>
          ) : (
            <ul className="space-y-3">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
                >
                  <div className="h-16 w-12 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    {m.photo ? (
                      <img
                        src={m.photo}
                        alt={`${m.firstName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-500">No Photo</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {m.prefix} {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      พรรค: {m.party}
                      {m.ministerPosition
                        ? ` • ${m.ministerPosition}${m.ministry ? ` (${m.ministry})` : ""
                        }`
                        : ""}
                    </p>
                    <p className="text-xs mt-1 line-clamp-2">{m.workHistory}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-sm px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700"
                      onClick={() => onEdit(m)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="text-sm px-3 py-1 rounded-lg bg-red-600 text-white"
                      onClick={() => onDelete(m.id)}
                    >
                      ลบ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
