export interface LiveAttendance {
  id: number;
  live_id: string;
  start_time: string;
  class: {
    id: number;
    department: string;
    year: string;
    subject: string;
    teacher: {
      id: number;
      name: string;
      employee_id: string;
    };
  };
  already_marked: boolean;
  attendance_record: any;
}
