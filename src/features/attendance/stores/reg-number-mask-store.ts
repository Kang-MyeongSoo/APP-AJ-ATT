import { create } from "zustand";

type RegNumberMaskStore = {
  remaskVersion: number;
  remask: () => void;
};

/** 전송 성공 등 이후 등록번호 입력란 마스킹 복구 */
export const useRegNumberMaskStore = create<RegNumberMaskStore>((set) => ({
  remaskVersion: 0,
  remask: () => set((state) => ({ remaskVersion: state.remaskVersion + 1 })),
}));
