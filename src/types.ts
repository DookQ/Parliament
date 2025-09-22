export type Member = {
  id: string;
  prefix: 'นาย' | 'นาง' | 'นางสาว' | 'อื่นๆ';
  firstName: string;
  lastName: string;
  photo?: string; // data URL
  workHistory: string; // ประวัติการทำงาน/ผลงาน
  ministerPosition?: string; // ตำแหน่งรัฐมนตรี
  ministry?: string;         // กระทรวง
  party: string;             // สังกัดพรรค
};
