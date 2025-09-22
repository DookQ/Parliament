import { z } from 'zod';

export const memberSchema = z.object({
  prefix: z.enum(['นาย', 'นาง', 'นางสาว', 'อื่นๆ']),
  firstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล'),
  photoFile: z.instanceof(File).nullable().optional(), // ⬅️ รับเป็น File หรือ null
  workHistory: z.string().min(1, 'ใส่ประวัติ/ผลงาน'),
  ministerPosition: z.string().optional(),
  ministry: z.string().optional(),
  party: z.string().min(1, 'ใส่ชื่อพรรค'),
});

export type MemberFormValues = z.infer<typeof memberSchema>;
