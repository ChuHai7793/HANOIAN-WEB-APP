export type RelationshipStatus = 'dating' | 'crush' | 'ex' | 'married';

export interface Girlfriend {
  id: string;
  name: string;
  nickname: string;
  avatarUrl: string;
  birthday: string; // 'yyyy-MM-dd'
  phone: string;
  status: RelationshipStatus;
  startedDate: string; // ngày quen nhau, 'yyyy-MM-dd'
  hobbies: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

export const RELATIONSHIP_STATUSES: {
  value: RelationshipStatus;
  label: string;
  classes: string;
}[] = [
  { value: 'dating', label: 'Đang hẹn hò', classes: 'bg-rose-100 text-rose-700' },
  { value: 'crush', label: 'Đang crush', classes: 'bg-amber-100 text-amber-700' },
  { value: 'married', label: 'Đã cưới', classes: 'bg-emerald-100 text-emerald-700' },
  { value: 'ex', label: 'Người cũ', classes: 'bg-slate-200 text-slate-600' },
];

export function statusMeta(value: RelationshipStatus) {
  return (
    RELATIONSHIP_STATUSES.find((s) => s.value === value) ?? RELATIONSHIP_STATUSES[0]
  );
}
