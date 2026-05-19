import { z } from 'zod';

const TIME_HM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const attendanceFormSchema = z.object({
  companyName: z.string().min(1, '업체명을 입력해 주세요.'),
  fullName: z.string().min(1, '이름을 입력해 주세요.'),
  regNumber: z
    .string()
    .regex(/^\d{13}$/, '외국인등록번호 13자리를 입력해 주세요.'),
  phone: z.string().min(1, '휴대폰 번호를 입력해 주세요.'),
  /** ATT_ETC_FORM `c_attr2` 괄호 안에 정의된 저장값만 사용 */
  gender: z.string().min(1, '성별을 선택해 주세요.'),
  workDate: z.string().min(1, '날짜를 선택해 주세요.'),
  /** ATT_ETC_FORM `c_attr2`에 정의된 저장값만 사용 */
  shift: z.string().min(1, '주간/야간을 선택해 주세요.'),
  startTime: z
    .string()
    .refine((v) => v.length === 0 || TIME_HM_REGEX.test(v), {
      message: '출근시간은 HH:MM(00:00~23:59) 형식이어야 합니다.',
    }),
  endTime: z
    .string()
    .refine((v) => v.length === 0 || TIME_HM_REGEX.test(v), {
      message: '퇴근시간은 HH:MM(00:00~23:59) 형식이어야 합니다.',
    }),
  /** 30분 단위 (분) */
  overtimeMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(12 * 60),
  dinner: z.enum(['Y', 'N']),
  /** 서버 마스터 `c_code` (예: 01, 02, 99) */
  department: z.string().min(1, '근무부서를 선택해 주세요.'),
});

export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

export const OVERTIME_MINUTE_OPTIONS = Array.from(
  { length: 12 * 2 + 1 },
  (_, i) => i * 30,
) as number[];
