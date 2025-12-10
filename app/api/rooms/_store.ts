// app/api/rooms/_store.ts
export interface Room {
  id: number;
  number: string;
  name?: string;
  contact?: string;
  carNo?: string;
  isActive: boolean;
}

// 데모용 인메모리 저장소 (실서비스는 DB로 대체)
export const rooms: Room[] = [
  { id: 1, number: "101", name: "홍길동", contact: "010-1111-2222", carNo: "12가3456", isActive: true },
  { id: 2, number: "102", isActive: true },
];