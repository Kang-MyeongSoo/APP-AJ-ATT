export const ATTENDANCE_FORM_TEXTS_STORAGE_KEY = "attendanceFormTexts";

export type AttendanceFormTexts = {
  tableHeaderCategory: string;
  tableHeaderCategoryRu: string;
  tableHeaderContent: string;
  tableHeaderContentRu: string;
  tableHeaderNote: string;
  tableHeaderNoteRu: string;
  companyLabel: string;
  companyLabelRu: string;
  nameLabel: string;
  nameLabelRu: string;
  regNumberLabel: string;
  regNumberLabelRu: string;
  phoneLabel: string;
  phoneLabelRu: string;
  genderLabel: string;
  genderLabelRu: string;
  dateLabel: string;
  dateLabelRu: string;
  shiftLabel: string;
  shiftLabelRu: string;
  startTimeLabel: string;
  startTimeLabelRu: string;
  endTimeLabel: string;
  endTimeLabelRu: string;
  overtimeLabel: string;
  overtimeLabelRu: string;
  dinnerLabel: string;
  departmentLabel: string;
  departmentLabelRu: string;
};

export const defaultAttendanceFormTexts: AttendanceFormTexts = {
  tableHeaderCategory: "구분(Категория)",
  tableHeaderCategoryRu: "(Категория)",
  tableHeaderContent: "내용(Содержание)",
  tableHeaderContentRu: "(Содержание)",
  tableHeaderNote: "비고(Примечание)",
  tableHeaderNoteRu: "(Примечание)",
  companyLabel: "업체명(Название фирмы)",
  companyLabelRu: "(Название фирмы)",
  nameLabel: "이름(Имя)",
  nameLabelRu: "(Имя)",
  regNumberLabel: "생년월일(등록번호)(Дата рождения)",
  regNumberLabelRu: "(Дата рождения)",
  phoneLabel: "휴대폰(Телефон)",
  phoneLabelRu: "(Телефон)",
  genderLabel: "성별(Пол)",
  genderLabelRu: "(Пол)",
  dateLabel: "날짜(Дата)",
  dateLabelRu: "(Дата)",
  shiftLabel: "주간/야간(Дневное/Ночное)",
  shiftLabelRu: "(Дневное/Ночное)",
  startTimeLabel: "출근시간(Время начала)",
  startTimeLabelRu: "(Время начала)",
  endTimeLabel: "퇴근시간(Время окончания)",
  endTimeLabelRu: "(Время окончания)",
  overtimeLabel: "잔업시간(Время переработки)",
  overtimeLabelRu: "(Время переработки)",
  dinnerLabel: "석식여부",
  departmentLabel: "근무부서(Отдел)",
  departmentLabelRu: "(Отдел)",
};

export function mergeAttendanceFormTexts(
  incoming?: Partial<AttendanceFormTexts>,
): AttendanceFormTexts {
  return {
    ...defaultAttendanceFormTexts,
    ...incoming,
  };
}

export function parseAttendanceFormTexts(
  raw: string | null,
): AttendanceFormTexts | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AttendanceFormTexts>;
    return mergeAttendanceFormTexts(parsed);
  } catch {
    return null;
  }
}
